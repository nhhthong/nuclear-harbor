import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { SPIDER_ROBOT } from '@/config/tunables';
import type { DamageInfo, DamageResult, SimLevel } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { forgetTarget, markAware, type Perception } from '../perception';
import { canHop, hopHeight, hopLerp } from './hop';
import { createGait, resetGait, updateGait, type Gait } from './legs';
import { computeFlankPoint, decideSpider, type SpiderState, type XZ } from './spiderBrain';
import { SPIDER_LOCAL } from './tunables';

const aim = new Vector3();
const shotDir = new Vector3();
const shotFrom = new Vector3();
const fwd = new Vector3();
const hopDir = { x: 0, y: 0, z: 0 };
const UP = new Vector3(0, 1, 0);
const segDir = new Vector3();

/** Alternates flank sides between spiders so groups split. */
let sideCounter = 0;

/**
 * Spider robot (GDD 6.2): patrol -> flank -> chase -> attack, with short hops over low obstacles.
 * Decisions in `think` (scheduled), movement/firing/hops in `step`, legs in `animate`.
 */
export class SpiderRobot extends BaseEnemy {
  private readonly side: 1 | -1 = sideCounter++ % 2 === 0 ? 1 : -1;
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private readonly flankPoint: XZ = { x: 0, z: 0 };
  private readonly flankPlayer: XZ = { x: 0, z: 0 };
  private readonly flankFwd: XZ = { x: 0, z: -1 };
  private flankReached = false;
  private fireCooldown = 0;
  private burstLeft = 0;
  private burstTimer = 0;
  private strafeSign: 1 | -1 = 1;
  private strafeTimer = 0;

  // hop
  private hopFromX = 0;
  private hopFromZ = 0;
  private hopToX = 0;
  private hopToZ = 0;
  private hopElapsed = 0;
  private hopReturn: SpiderState = 'chase';
  private hopCooldown = 0;

  // legs
  private readonly gait: Gait = createGait(SPIDER_ROBOT.legCount);
  private readonly legMeshes: Mesh[] = [];
  private lastX: number;
  private lastZ: number;
  private speedEstimate = 0;
  private readonly phase = Math.random() * Math.PI * 2;
  private readonly bodyMesh: Mesh;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'spider',
        maxHp: SPIDER_ROBOT.hp,
        centerHeight: SPIDER_LOCAL.centerHeight,
        radius: SPIDER_ROBOT.bodyRadius,
        speed: SPIDER_ROBOT.speed,
        perceptionRange: SPIDER_ROBOT.detectionRange,
      },
      'patrol',
    );
    this.lastX = this.position.x;
    this.lastZ = this.position.z;

    const { shared } = deps;
    const bodyGeo = shared.get(
      'spider:body-geo',
      () => new BoxGeometry(SPIDER_ROBOT.bodyRadius * 1.6, SPIDER_LOCAL.bodyHalfHeight * 2, SPIDER_ROBOT.bodyRadius * 2),
    );
    const domeGeo = shared.get('spider:dome-geo', () => new SphereGeometry(SPIDER_LOCAL.domeRadius, 12, 8));
    const legGeo = shared.get('spider:leg-geo', () => {
      const g = new CylinderGeometry(SPIDER_LOCAL.legRadius, SPIDER_LOCAL.legRadius, 1, 6);
      return g;
    });
    const bodyMat = shared.get(
      'spider:body-mat',
      () => new MeshStandardMaterial({ color: SPIDER_LOCAL.bodyColor, metalness: 0.8, roughness: 0.4 }),
    );
    const legMat = shared.get(
      'spider:leg-mat',
      () => new MeshStandardMaterial({ color: SPIDER_LOCAL.legColor, metalness: 0.7, roughness: 0.5 }),
    );
    const domeMat = shared.get(
      'spider:dome-mat',
      () =>
        new MeshStandardMaterial({
          color: SPIDER_LOCAL.domeColor,
          emissive: SPIDER_LOCAL.domeEmissive,
          emissiveIntensity: 1.5,
        }),
    );

    this.bodyMesh = new Mesh(bodyGeo, bodyMat);
    this.bodyMesh.castShadow = true;
    const dome = new Mesh(domeGeo, domeMat);
    dome.position.set(0, SPIDER_LOCAL.domeUp, 0);
    this.root.add(this.bodyMesh, dome);
    for (let i = 0; i < this.gait.count * 2; i++) {
      const seg = new Mesh(legGeo, legMat);
      seg.castShadow = true;
      this.legMeshes.push(seg);
      this.root.add(seg);
    }

    const { ColliderDesc } = deps.ctx.physics.rapier;
    this.addHitVolume(
      ColliderDesc.cuboid(SPIDER_ROBOT.bodyRadius * 0.8, SPIDER_LOCAL.bodyHalfHeight, SPIDER_ROBOT.bodyRadius),
      'body',
    );
    this.addHitVolume(
      ColliderDesc.ball(SPIDER_LOCAL.domeRadius).setTranslation(0, SPIDER_LOCAL.domeUp, 0),
      'critical',
    );

    resetGait(this.gait, this.position.x, this.position.z, this.yaw);
    this.poseLegs();
  }

  get brainState(): SpiderState {
    return this.fsm.state as SpiderState;
  }

  /** Which side of the player this spider flanks (+1 left, -1 right). */
  get flankSide(): 1 | -1 {
    return this.side;
  }

  // ---- decisions ------------------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const { ctx } = this.deps;
    if (this.brainState === 'hop') return;

    const arrived = this.commanded && this.distanceTo(this.commandTarget.x, this.commandTarget.z) <= SPIDER_LOCAL.commandArriveRadius;
    const previous = this.brainState;
    this.flankReached =
      previous === 'flank' && Math.hypot(this.flankPoint.x - this.position.x, this.flankPoint.z - this.position.z) <= SPIDER_LOCAL.flankArriveRadius;
    const movedFar =
      previous === 'flank' &&
      Math.hypot(ctx.player.position.x - this.flankPlayer.x, ctx.player.position.z - this.flankPlayer.z) > SPIDER_LOCAL.flankPlayerMoveLimit;

    const next = decideSpider({
      state: previous,
      timeInState: this.fsm.timeInState,
      distance: p.distance,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      playerAlive: p.playerAlive,
      flankReached: this.flankReached,
      playerMovedFar: movedFar,
      commanded: this.commanded && !arrived,
      commandArrived: arrived,
    });
    if (arrived) this.commanded = false;

    if (this.fsm.set(next)) {
      if (next === 'flank') {
        this.beginFlank();
        if (previous === 'patrol') {
          ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
        }
      }
      if (next === 'attack') {
        this.fireCooldown = Math.max(this.fireCooldown, SPIDER_LOCAL.firstShotDelay);
        this.strafeTimer = 0;
      }
    }

    this.lockFacing = false;
    const full = SPIDER_ROBOT.speed;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick(this.currentWaypoint());
        break;
      case 'flank':
        this.setGoal(this.flankPoint.x, this.flankPoint.z);
        this.moveSpeed = full;
        break;
      case 'chase': {
        const tracking = p.hasLos || p.timeSinceSeen < SPIDER_ROBOT.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? ctx.player.position : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        this.moveSpeed = full;
        break;
      }
      case 'attack':
        this.attackTick();
        break;
      default:
        this.moveSpeed = 0;
    }
    this.tryHop();
  }

  private beginFlank(): void {
    const { ctx, nav } = this.deps;
    const player = ctx.player;
    player.getForward(fwd);
    this.flankFwd.x = fwd.x;
    this.flankFwd.z = fwd.z;
    this.flankPlayer.x = player.position.x;
    this.flankPlayer.z = player.position.z;
    computeFlankPoint(
      this.flankPlayer,
      this.flankFwd,
      this.position,
      this.side,
      SPIDER_ROBOT,
      (x, z, out) => nav.nearestWalkable(x, z, out) !== null,
      this.flankPoint,
    );
    this.flankReached = false;
    this.setGoal(this.flankPoint.x, this.flankPoint.z, true);
  }

  private attackTick(): void {
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    this.lockFacing = true;
    this.face(pl.x, pl.z);
    this.strafeTimer -= this.thinkDt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = SPIDER_LOCAL.strafeFlipTime;
      this.strafeSign = this.strafeSign === 1 ? -1 : 1;
    }
    // strafe perpendicular to the line to the player
    const dx = pl.x - this.position.x;
    const dz = pl.z - this.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const k = this.side * this.strafeSign * SPIDER_LOCAL.strafeDistance;
    this.setGoal(this.position.x + (-dz / d) * k, this.position.z + (dx / d) * k);
    this.moveSpeed = SPIDER_ROBOT.speed * SPIDER_LOCAL.strafeSpeedFactor;
  }

  private patrolTick(wp: Vector3 | null): void {
    if (!wp) {
      this.clearGoal();
      this.moveSpeed = 0;
      return;
    }
    if (this.distanceTo(wp.x, wp.z) <= SPIDER_LOCAL.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = SPIDER_ROBOT.speed * SPIDER_LOCAL.patrolSpeedFactor;
  }

  private distanceTo(x: number, z: number): number {
    return Math.hypot(x - this.position.x, z - this.position.z);
  }

  // ---- hop ------------------------------------------------------------------------------

  /** Starts a hop when the way to the goal is blocked only by a low obstacle with a landing cell. */
  private tryHop(): void {
    if (this.hopCooldown > 0 || this.moveSpeed <= 0 || !this.hasGoal) return;
    const state = this.brainState;
    if (state === 'attack' || state === 'destroyed' || state === 'hop') return;
    const nav = this.deps.nav;
    const dx = this.goalX - this.position.x;
    const dz = this.goalZ - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < SPIDER_LOCAL.hopProbeDistance + 0.5) return;
    const nx = dx / d;
    const nz = dz / d;
    // only consider hopping when the cell just ahead is not walkable (an obstacle in the way)
    if (nav.isWalkable(this.position.x + nx, this.position.z + nz)) return;
    const landX = this.position.x + nx * SPIDER_LOCAL.hopProbeDistance;
    const landZ = this.position.z + nz * SPIDER_LOCAL.hopProbeDistance;
    const landing = nav.isWalkable(landX, landZ);
    if (!landing) return;
    const { physics } = this.deps.ctx;
    hopDir.x = nx;
    hopDir.y = 0;
    hopDir.z = nz;
    const groundY = this.position.y - SPIDER_LOCAL.centerHeight;
    const dist = SPIDER_LOCAL.hopProbeDistance;
    const low = physics.raycast({ x: this.position.x, y: groundY + SPIDER_LOCAL.hopLowRayHeight, z: this.position.z }, hopDir, dist, {
      groups: QueryGroups.worldOnly,
    });
    const high = physics.raycast(
      { x: this.position.x, y: groundY + SPIDER_ROBOT.hopMaxObstacleHeight + SPIDER_LOCAL.hopClearMargin, z: this.position.z },
      hopDir,
      dist,
      { groups: QueryGroups.worldOnly },
    );
    if (!canHop(low !== null, high !== null, landing)) return;
    this.startHop(landX, landZ);
  }

  private startHop(toX: number, toZ: number): void {
    this.hopReturn = this.brainState === 'flank' ? 'flank' : this.brainState === 'patrol' ? 'patrol' : 'chase';
    this.hopFromX = this.position.x;
    this.hopFromZ = this.position.z;
    this.hopToX = toX;
    this.hopToZ = toZ;
    this.hopElapsed = 0;
    this.fsm.set('hop');
    this.face(toX, toZ);
    this.moveSpeed = 0;
  }

  private finishHop(): void {
    this.position.x = this.hopToX;
    this.position.z = this.hopToZ;
    this.position.y = SPIDER_LOCAL.centerHeight;
    this.syncBody();
    this.hopCooldown = SPIDER_LOCAL.hopCooldown;
    this.path = null;
    if (this.fsm.state === 'hop') this.fsm.set(this.hopReturn);
  }

  private syncBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
  }

  // ---- fixed step -----------------------------------------------------------------------

  override step(dt: number): void {
    this.hopCooldown -= dt;
    if (this.alive && this.brainState === 'hop') {
      this.hopElapsed += dt;
      const t = this.hopElapsed / SPIDER_LOCAL.hopDuration;
      this.position.x = hopLerp(this.hopFromX, this.hopToX, t);
      this.position.z = hopLerp(this.hopFromZ, this.hopToZ, t);
      this.position.y =
        SPIDER_LOCAL.centerHeight + hopHeight(t, SPIDER_ROBOT.hopMaxObstacleHeight + SPIDER_LOCAL.hopApexExtra);
      this.syncBody();
      super.step(dt);
      if (t >= 1) this.finishHop();
      return;
    }
    super.step(dt);
    if (!this.alive) return;
    this.fireTick(dt);
  }

  private fireTick(dt: number): void {
    this.fireCooldown -= dt;
    if (this.brainState !== 'attack') {
      this.burstLeft = 0;
      return;
    }
    const p = this.perception;
    if (this.burstLeft > 0) {
      this.burstTimer -= dt;
      if (this.burstTimer <= 0) {
        this.fireBolt();
        this.burstLeft--;
        this.burstTimer = SPIDER_LOCAL.burstGap;
      }
      return;
    }
    if (this.fireCooldown > 0 || !p.hasLos || p.distance > SPIDER_ROBOT.attackRange) return;
    this.fireCooldown = SPIDER_ROBOT.fireInterval;
    this.burstLeft = SPIDER_LOCAL.burstCount;
    this.burstTimer = 0;
  }

  private fireBolt(): void {
    const { ctx, projectiles } = this.deps;
    aim.set(ctx.player.position.x, ctx.player.position.y + SPIDER_LOCAL.aimHeight, ctx.player.position.z);
    shotDir.subVectors(aim, this.position).normalize();
    shotFrom.copy(this.position).addScaledVector(shotDir, SPIDER_ROBOT.bodyRadius + 0.2);
    if (projectiles.fire(shotFrom, shotDir, SPIDER_ROBOT.projectileSpeed, SPIDER_ROBOT.damage)) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
  }

  // ---- commands / lifecycle -------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (this.brainState === 'patrol') this.fsm.set('chase');
    this.setGoal(target.x, target.z, true);
    this.moveSpeed = SPIDER_ROBOT.speed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState === 'hop') this.finishHop();
    if (this.brainState !== 'destroyed') this.fsm.set('patrol');
    this.clearGoal();
    this.moveSpeed = 0;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  protected override onSimLevelChanged(level: SimLevel, previous: SimLevel): void {
    if (level === 'dormant' && this.brainState === 'hop') this.finishHop();
    super.onSimLevelChanged(level, previous);
    if (level === 'active' && previous !== 'active') {
      resetGait(this.gait, this.position.x, this.position.z, this.yaw);
      this.poseLegs();
    }
  }

  // ---- animation ------------------------------------------------------------------------

  override animate(dt: number, time: number): void {
    const level = this.simLevel;
    if (level === 'dormant' || !this.alive) return;
    if (this.brainState !== 'hop') {
      this.root.position.x = this.position.x;
      this.root.position.z = this.position.z;
    }
    if (level === 'simplified') {
      // legs stay planted; the body bobs slightly
      this.root.position.y = this.position.y + Math.sin(time * SPIDER_LOCAL.bobSpeed + this.phase) * SPIDER_LOCAL.bobAmplitude;
      return;
    }
    this.root.position.y = this.position.y;
    if (dt > 0) {
      const mx = this.position.x - this.lastX;
      const mz = this.position.z - this.lastZ;
      const inst = Math.hypot(mx, mz) / dt;
      this.speedEstimate += (inst - this.speedEstimate) * Math.min(1, dt * 10);
    }
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    updateGait(this.gait, this.position.x, this.position.z, this.yaw, this.speedEstimate, dt);
    this.poseLegs();
  }

  /** Places the two segments of every leg from hip to knee to foot (no allocation). */
  private poseLegs(): void {
    const g = this.gait;
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    const rootY = this.position.y;
    for (let i = 0; i < g.count; i++) {
      const hx = g.hipX[i] as number;
      const hz = g.hipZ[i] as number;
      const hy = SPIDER_LOCAL.hipY;
      const wx = (g.footX[i] as number) - this.position.x;
      const wz = (g.footZ[i] as number) - this.position.z;
      const fx = wx * c - wz * s;
      const fz = wx * s + wz * c;
      const fy = (g.footY[i] as number) - rootY;
      // knee: above the midpoint, pushed outward
      const outward = hx < 0 ? -1 : 1;
      const kx = (hx + fx) / 2 + outward * 0.25;
      const ky = Math.max(hy, fy) + SPIDER_LOCAL.kneeLift;
      const kz = (hz + fz) / 2;
      this.placeSegment(this.legMeshes[i * 2], hx, hy, hz, kx, ky, kz);
      this.placeSegment(this.legMeshes[i * 2 + 1], kx, ky, kz, fx, fy, fz);
    }
  }

  private placeSegment(mesh: Mesh | undefined, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
    if (!mesh) return;
    segDir.set(bx - ax, by - ay, bz - az);
    const len = segDir.length();
    mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    mesh.scale.y = len;
    if (len > 1e-5) mesh.quaternion.setFromUnitVectors(UP, segDir.multiplyScalar(1 / len));
  }

  /** Test/debug: current foot world positions are in the gait arrays. */
  get legGait(): Gait {
    return this.gait;
  }
}
