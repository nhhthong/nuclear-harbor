import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import { loadedDroneAsset, proceduralDroneGeometry, proceduralDroneMaterial } from '@/assets/droneAsset';
import type { DamageInfo, DamageResult, SimLevel } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { forgetTarget, markAware, type Perception } from '../perception';
import { chooseOpening, insideWarehouse, openingRoute } from './openings';
import {
  altitudeBand,
  chooseDirection,
  clampStep,
  clampToBand,
  freeDistance,
  keepOutOf,
  resolveTarget,
  standoffTarget,
  StuckMonitor,
  type Band,
  type Probe,
  type SteerMemory,
  type V3,
} from './steering';
import { addWreck } from './wrecks';
import { DRONE, DRONE_NO_FLY } from './tunables';

const UP: V3 = { x: 0, y: 1, z: 0 };
const DOWN: V3 = { x: 0, y: -1, z: 0 };
const tmpDir = new Vector3();
const tmpEye = new Vector3();
const tmpFrom = new Vector3();
const tmpAim = new Vector3();
const tmpTarget = { x: 0, y: 0, z: 0 };
const tmpFeet = { x: 0, y: 0, z: 0 };

/** Alternates the orbit direction between drones. */
let orbitCounter = 0;

export type DroneMode = 'patrol' | 'engage' | 'opening';

/**
 * Flying dragonfly drone (enemy type `drone`, spec 29). No nav grid: it flies straight at a target point with
 * sphere-cast obstacle avoidance (`steering.ts`), cruises 3 to 6 m above the floor under it, keeps 5 to 10 m from
 * the player and orbits, and fires the boss-style plasma bolt after a glow telegraph when it sees the player.
 * When the player and the drone are on different sides of the warehouse walls it flies through the nearest
 * flyable opening (`openings.ts`). A drone without a patrol is a hunter (call-in, test hook): always aware.
 */
export class Drone extends BaseEnemy {
  private readonly hunter: boolean;
  private readonly orbitDir: number = orbitCounter++ % 2 === 0 ? 1 : -1;
  private readonly probe: Probe;
  private readonly model: Mesh;
  private readonly glow: Mesh;

  private mode: DroneMode = 'patrol';
  private aware = false;
  private readonly target = new Vector3();
  private readonly steer = new Vector3(0, 0, -1);
  private readonly steerMem: SteerMemory = { side: 0 };
  /** The path to the target was free at the last think: steer straight at it every step. */
  private direct = true;
  private readonly vel = new Vector3();
  private cruiseSpeed: number = DRONE.patrolSpeed;
  private readonly band: Band = { min: 0, max: 0 };
  private floorY = 0;

  private route: V3[] | null = null;
  private routeIndex = 0;
  private routeFromInside = false;

  private readonly stuck = new StuckMonitor(DRONE.stuck);
  private climbLeft = 0;
  private turnLeft = 0;

  private shotTimer: number;
  private tellLeft = -1;
  private phase = Math.random() * Math.PI * 2;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'drone',
        maxHp: DRONE.hp,
        centerHeight: spawn.position.y > 0 ? spawn.position.y : (DRONE.cruiseMin + DRONE.cruiseMax) / 2,
        radius: DRONE.bodyRadius,
        speed: DRONE.speed,
        perceptionRange: DRONE.detectionRange,
      },
      'patrol',
    );
    this.hunter = spawn.patrol.length === 0;
    this.shotTimer = DRONE.bolt.interval[0] + Math.random() * (DRONE.bolt.interval[1] - DRONE.bolt.interval[0]);
    const { ctx } = deps;
    const R = ctx.physics.rapier;

    // look: the shared dragonfly GLB, or the boss's procedural fallback
    const asset = loadedDroneAsset();
    let geometry: BufferGeometry;
    let material: Material;
    if (asset) {
      geometry = deps.shared.get('drone:glb-geometry', () => asset.geometry);
      material = deps.shared.get('drone:glb-material', () => asset.material);
    } else {
      geometry = deps.shared.get('drone:geometry', proceduralDroneGeometry);
      material = deps.shared.get('drone:material', proceduralDroneMaterial);
    }
    this.model = new Mesh(geometry, material);
    this.model.scale.setScalar(DRONE.modelScale);
    this.model.castShadow = true;
    this.root.add(this.model);
    const glowGeo = deps.shared.get('drone:glow-geometry', () => new SphereGeometry(1, 10, 8));
    const glowMat = deps.shared.get('drone:glow-material', () =>
      Object.assign(new MeshBasicMaterial({ color: new Color(3.2, 1.0, 0.5), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), { toneMapped: false }),
    );
    this.glow = new Mesh(glowGeo, glowMat);
    this.glow.position.set(0, 0, -0.7 * DRONE.modelScale);
    this.glow.visible = false;
    this.root.add(this.glow);

    this.addHitVolume(R.ColliderDesc.ball(DRONE.hitRadius), 'body');

    // sphere cast of the body against static geometry only (the drone's own ball is in Groups.enemy)
    const ball = new R.Ball(DRONE.bodyRadius);
    const rot = { x: 0, y: 0, z: 0, w: 1 };
    this.probe = (o, d, max) => {
      const hit = ctx.physics.world.castShape(o, rot, d, ball, 0, max, false, R.QueryFilterFlags.EXCLUDE_SENSORS, QueryGroups.worldOnly);
      return hit ? hit.time_of_impact : null;
    };

    this.target.copy(this.position);
    this.syncBody();
  }

  get flightMode(): DroneMode {
    return this.mode;
  }

  // ---- decisions (scheduled) ---------------------------------------------------------------

  protected think(dt: number, p: Perception): void {
    if (this.simLevel === 'dormant') return;
    const { ctx } = this.deps;
    const sees = p.playerAlive && p.hasLos && p.distance <= DRONE.detectionRange;
    const wasAware = this.aware;
    if (this.hunter && p.playerAlive) markAware(ctx, p);
    this.aware = p.playerAlive && (this.hunter || sees || p.timeSinceSeen < DRONE.memory);
    if (this.aware && !wasAware) ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });

    // altitude band from the floor under the drone and the ceiling over it
    const down = this.probe(this.position, DOWN, DRONE.probeDown);
    this.floorY = down === null ? 0 : this.position.y - down - DRONE.bodyRadius;
    const up = this.probe(this.position, UP, DRONE.probeUp);
    altitudeBand(this.floorY, up === null ? null : this.position.y + up + DRONE.bodyRadius, DRONE, this.band);

    if (this.aware) this.thinkHunt(p);
    else this.thinkPatrol();
    keepOutOf(DRONE_NO_FLY, this.target as V3);

    // steering towards the target
    tmpDir.copy(this.target).sub(this.position);
    const dist = tmpDir.length();
    const throughOpening = this.mode === 'opening' && this.routeIndex >= 1;
    if (dist < 1e-3) {
      this.direct = true;
    } else if (throughOpening) {
      // the last two legs go straight through the frame (the move clamp still keeps the body off it)
      this.direct = true;
    } else {
      chooseDirection(this.probe, this.position, tmpDir, DRONE, this.steer, this.steerMem);
      this.direct = Math.abs(this.steer.x * tmpDir.x + this.steer.y * tmpDir.y + this.steer.z * tmpDir.z - dist) < 1e-3 * dist;
    }

    // unstick: climb, then turn
    if (this.climbLeft <= 0 && this.turnLeft <= 0 && this.stuck.update(dt, this.position, dist > DRONE.opening.arrive * 2)) {
      this.climbLeft = DRONE.stuck.climbTime;
      this.turnLeft = DRONE.stuck.turnTime;
      // try the other side next time round
      this.steerMem.side = this.steerMem.side === 0 ? this.orbitDir : -this.steerMem.side;
    }

    // attack: telegraph when the player is in sight and in range
    if (this.mode === 'engage' && sees && p.distance <= DRONE.bolt.range && this.shotTimer <= 0 && this.tellLeft < 0) {
      this.tellLeft = DRONE.bolt.tell;
    }
    this.fsm.set(this.mode);
  }

  private thinkPatrol(): void {
    this.route = null;
    this.mode = 'patrol';
    this.cruiseSpeed = DRONE.patrolSpeed;
    const wp = this.currentWaypoint();
    if (!wp) {
      this.target.set(this.position.x, clampToBand(this.position.y, this.band), this.position.z);
      return;
    }
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) < 2) this.advanceWaypoint();
    const next = this.currentWaypoint() ?? wp;
    this.target.set(next.x, (this.band.min + this.band.max) / 2, next.z);
  }

  private thinkHunt(p: Perception): void {
    const { ctx } = this.deps;
    const feet = ctx.player.position;
    tmpFeet.x = feet.x;
    tmpFeet.y = feet.y + 0.5;
    tmpFeet.z = feet.z;
    // the sandbox has no warehouse: no opening routes there
    const harbor = !ctx.flags.sandbox;
    const playerIn = harbor && insideWarehouse(tmpFeet);
    const droneIn = harbor && insideWarehouse(this.position);

    // a route already past its approach point is flown to the end (the drone is in the frame)
    const committed = this.route !== null && this.routeIndex >= 1;
    if (playerIn !== droneIn || committed) {
      if (this.route === null || (!committed && this.routeFromInside !== droneIn)) {
        const o = chooseOpening(this.position, p.playerEye, droneIn, DRONE.opening);
        if (o) {
          this.route = openingRoute(o, droneIn, DRONE.opening);
          this.routeIndex = 0;
          this.routeFromInside = droneIn;
        }
      }
      const route = this.route;
      if (route) {
        let wp = route[this.routeIndex];
        if (wp && Math.hypot(wp.x - this.position.x, wp.y - this.position.y, wp.z - this.position.z) <= DRONE.opening.arrive) {
          this.routeIndex++;
          wp = route[this.routeIndex];
        }
        if (wp) {
          this.mode = 'opening';
          this.cruiseSpeed = this.routeIndex >= 1 ? DRONE.openingSpeed : DRONE.speed;
          this.target.set(wp.x, wp.y, wp.z);
          return;
        }
        this.route = null;
      }
    } else {
      this.route = null;
    }

    // engage: stand-off point around the player, resolved from the player's eye so it stays in the player's room
    this.mode = 'engage';
    this.cruiseSpeed = DRONE.speed;
    standoffTarget(this.position, feet, this.orbitDir, DRONE, tmpTarget);
    tmpTarget.y = clampToBand(p.playerEye.y + DRONE.aboveEye, this.band);
    tmpEye.copy(p.playerEye);
    resolveTarget(this.probe, tmpEye, tmpTarget, DRONE.skin + DRONE.bodyRadius, tmpTarget);
    this.target.set(tmpTarget.x, tmpTarget.y, tmpTarget.z);
  }

  protected onCommand(_target: Vector3): void {
    // defend phase: drones hunt the player anyway; just make sure they are aware
    markAware(this.deps.ctx, this.perception);
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.aware = false;
    this.route = null;
    this.tellLeft = -1;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  // ---- motion (every fixed tick) ------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.fsm.update(dt);
    const { ctx } = this.deps;
    this.shotTimer -= dt;

    // telegraph -> bolt
    if (this.tellLeft >= 0) {
      this.tellLeft -= dt;
      if (this.tellLeft < 0) this.fire();
    }

    // desired direction
    tmpDir.copy(this.target).sub(this.position);
    const dist = tmpDir.length();
    if (this.climbLeft > 0) {
      this.climbLeft -= dt;
      tmpDir.set(0, 1, 0);
    } else if (this.turnLeft > 0) {
      this.turnLeft -= dt;
      const yaw = Math.atan2(this.steer.x, this.steer.z) + DRONE.stuck.turnAngle * this.orbitDir;
      tmpDir.set(Math.sin(yaw), 0, Math.cos(yaw));
    } else if (this.direct && dist > 1e-4) {
      tmpDir.divideScalar(dist);
    } else {
      tmpDir.copy(this.steer);
    }
    const ease = this.climbLeft > 0 || this.turnLeft > 0 ? 1 : Math.min(1, dist / 2);
    const speed = this.cruiseSpeed * ease;

    // velocity eases towards the desired velocity
    const maxDv = DRONE.accel * dt;
    const dvx = tmpDir.x * speed - this.vel.x;
    const dvy = tmpDir.y * speed - this.vel.y;
    const dvz = tmpDir.z * speed - this.vel.z;
    const dv = Math.hypot(dvx, dvy, dvz);
    const k = dv > maxDv ? maxDv / dv : 1;
    this.vel.x += dvx * k;
    this.vel.y += dvy * k;
    this.vel.z += dvz * k;

    const v = this.vel.length();
    if (v > 1e-4) {
      tmpAim.copy(this.vel).divideScalar(v);
      const want = v * dt;
      const moved = clampStep(this.probe, this.position, tmpAim, want, DRONE.skin);
      this.position.addScaledVector(tmpAim, moved);
      if (moved < want) this.vel.multiplyScalar(moved / want);
    }

    // facing: the player while hunting, else the flight direction
    if (this.aware) {
      const pl = ctx.player.position;
      this.face(pl.x, pl.z);
    } else if (Math.hypot(this.vel.x, this.vel.z) > 0.3) {
      this.face(this.position.x + this.vel.x, this.position.z + this.vel.z);
    }
    let diff = this.desiredYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = DRONE.turnRate * dt;
    this.yaw += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    this.syncBody();
  }

  private fire(): void {
    const { ctx } = this.deps;
    this.shotTimer = DRONE.bolt.interval[0] + Math.random() * (DRONE.bolt.interval[1] - DRONE.bolt.interval[0]);
    if (!ctx.player.alive) return;
    tmpFrom.set(this.position.x - Math.sin(this.yaw) * 0.7, this.position.y, this.position.z - Math.cos(this.yaw) * 0.7);
    ctx.player.getEyePosition(tmpEye);
    tmpEye.y -= 0.35;
    if (!ctx.physics.hasLineOfSight(tmpFrom, tmpEye)) return;
    tmpAim.copy(tmpEye).sub(tmpFrom);
    if (tmpAim.lengthSq() < 1e-6) return;
    if (this.deps.projectiles.fire(tmpFrom, tmpAim, DRONE.bolt.speed, DRONE.bolt.damage, 'plasma')) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
  }

  private syncBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  override animate(_dt: number, time: number): void {
    // bob, bank into the turn and the telegraph glow at the nose
    this.model.position.y = Math.sin(time * 3 + this.phase) * 0.06;
    this.model.rotation.set(0.12 * Math.sin(time * 1.6 + this.phase), 0, this.orbitDir * -0.18 + Math.sin(time * 2.3 + this.phase) * 0.06);
    if (this.tellLeft >= 0) {
      const f = 1 - this.tellLeft / DRONE.bolt.tell;
      const flick = 0.75 + 0.25 * Math.sin(time * 40);
      this.glow.visible = true;
      this.glow.scale.setScalar(Math.max(0.05, (0.2 + 0.8 * f) * flick * DRONE.glowRadius));
    } else {
      this.glow.visible = false;
    }
  }

  protected override onSimLevelChanged(level: SimLevel, _previous: SimLevel): void {
    // flying: no nav snapping when waking up
    this.root.visible = level !== 'dormant';
  }

  protected override onDestroyed(): void {
    this.glow.visible = false;
    // the wreck falls from where it was shot, keeping some of its speed
    const floor = freeDistance(this.probe, this.position, DOWN, DRONE.probeDown);
    const floorY = this.position.y - floor - DRONE.bodyRadius;
    this.model.position.y = 0;
    addWreck(this.deps.ctx, this.model, this.vel.multiplyScalar(0.5), floorY);
  }

  /** Debug / tests. */
  debugState(): { mode: DroneMode; aware: boolean; target: V3; band: Band; floorY: number; route: number } {
    return {
      mode: this.mode,
      aware: this.aware,
      target: { x: this.target.x, y: this.target.y, z: this.target.z },
      band: { ...this.band },
      floorY: this.floorY,
      route: this.route ? this.route.length - this.routeIndex : 0,
    };
  }
}
