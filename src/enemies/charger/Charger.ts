import { BoxGeometry, Mesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { CHARGER_ROBOT } from '@/config/tunables';
import { isOnLand } from '@/config/level';
import type { DamageInfo, DamageResult } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { forgetTarget, markAware, type Perception } from '../perception';
import { ENEMY_LOCAL } from '../tunables';
import { canStartCharge, planCharge, playerTouchesBody, zoneForHit, type ChargePlan, type ChargeProbes } from './chargePlan';
import { decideCharger, timedNext, type ChargerState } from './chargerBrain';
import { CHARGER_LOCAL } from './tunables';

const DOWN = { x: 0, y: -1, z: 0 };
const probeOrigin = new Vector3();
const impulse = new Vector3();
const probes: ChargeProbes = { obstacleDistance: null, edgeDistance: null };
const awayDir = new Vector3();
const facing = new Vector3();

const ZONE_PROFILE = {
  body: 1,
  armor: CHARGER_ROBOT.frontDamageMultiplier,
  critical: CHARGER_ROBOT.rearCritMultiplier,
} as const;

/**
 * Charger robot (GDD 6.3): patrol -> detect -> windup (1 s telegraph) -> charge (locked line) ->
 * stunned (wall) | recover (edge / range) -> detect. 90% front armour, rear and flanks crit.
 */
export class Charger extends BaseEnemy {
  private cooldownLeft = 0;
  private readonly route: ChargePlan = { maxDistance: 0, endsAt: 'range' };
  private readonly lockDir = new Vector3(0, 0, -1);
  private travelled = 0;
  private chargeSpeed: number = CHARGER_ROBOT.chargeSpeedMin;
  private hitPlayerThisCharge = false;
  private pendingCommand = false;
  private readonly pendingTarget = new Vector3();
  private readonly strip: Mesh;
  private readonly lightMeshes: Mesh[] = [];
  private readonly lightMats: MeshStandardMaterial[];
  private readonly ventMesh: Mesh;
  private readonly ventMat: MeshStandardMaterial;
  private readonly ventHotMat: MeshStandardMaterial;
  private lightLevel = -1;
  private ventHot = false;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'charger',
        maxHp: CHARGER_ROBOT.hp,
        centerHeight: CHARGER_ROBOT.halfExtents.y,
        radius: CHARGER_ROBOT.halfExtents.z,
        speed: CHARGER_ROBOT.walkSpeed,
        perceptionRange: CHARGER_ROBOT.detectionRange,
        zoneProfile: ZONE_PROFILE,
      },
      'patrol',
    );

    const { shared } = deps;
    const h = CHARGER_ROBOT.halfExtents;
    const bodyGeo = shared.get('charger:body-geo', () => new BoxGeometry(h.x * 2, h.y * 1.4, h.z * 2));
    const shieldGeo = shared.get(
      'charger:shield-geo',
      () => new BoxGeometry(h.x * 2.05, h.y * 1.7, CHARGER_LOCAL.shieldThickness),
    );
    const lightGeo = shared.get('charger:light-geo', () => new BoxGeometry(0.16, 0.16, 0.5));
    const ventGeo = shared.get('charger:vent-geo', () => new BoxGeometry(h.x * 0.9, h.y * 0.5, 0.12));
    const stripGeo = shared.get('charger:strip-geo', () => {
      const g = new PlaneGeometry(1, 1);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0, 0.5);
      return g;
    });
    const bodyMat = shared.get(
      'charger:body-mat',
      () => new MeshStandardMaterial({ color: 0x6b5b3a, metalness: 0.7, roughness: 0.5 }),
    );
    const shieldMat = shared.get(
      'charger:shield-mat',
      () => new MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }),
    );
    this.lightMats = CHARGER_LOCAL.lightLevels.map((level, i) =>
      shared.get(
        `charger:light-mat-${i}`,
        () => new MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a1a, emissiveIntensity: level }),
      ),
    );
    this.ventMat = shared.get(
      'charger:vent-mat',
      () => new MeshStandardMaterial({ color: 0x401000, emissive: 0xff7a1a, emissiveIntensity: CHARGER_LOCAL.ventBase }),
    );
    this.ventHotMat = shared.get(
      'charger:vent-hot-mat',
      () => new MeshStandardMaterial({ color: 0x401000, emissive: 0xffd24a, emissiveIntensity: CHARGER_LOCAL.ventStunned }),
    );
    const stripMat = shared.get(
      'charger:strip-mat',
      () => new MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.45, depthWrite: false }),
    );

    // forward is -Z in local space (yaw 0 faces north, like the player)
    const body = new Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    const shield = new Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 0.05, -h.z - 0.05);
    shield.rotation.x = -CHARGER_LOCAL.shieldTilt;
    shield.castShadow = true;
    this.ventMesh = new Mesh(ventGeo, this.ventMat);
    this.ventMesh.position.set(0, 0.05, h.z + 0.04);
    for (const side of [-1, 1]) {
      const light = new Mesh(lightGeo, this.lightMats[0]);
      light.position.set(side * (h.x + 0.04), 0.35, -h.z * 0.45);
      this.lightMeshes.push(light);
      this.root.add(light);
    }
    this.root.add(body, shield, this.ventMesh);

    this.strip = new Mesh(stripGeo, stripMat);
    this.strip.visible = false;
    this.strip.position.y = CHARGER_LOCAL.stripY;
    this.strip.renderOrder = 1;
    deps.ctx.scene.add(this.strip);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    this.addHitVolume(ColliderDesc.cuboid(h.x, h.y, h.z), 'body');
    this.setLightLevel(0);
  }

  get brainState(): ChargerState {
    return this.fsm.state as ChargerState;
  }

  /** Remaining cooldown before the next charge may start (s). */
  get cooldownRemaining(): number {
    return this.cooldownLeft;
  }

  /** Locked charge direction (valid during a charge). */
  get chargeDirection(): Vector3 {
    return this.lockDir;
  }

  get currentPlan(): Readonly<ChargePlan> {
    return this.route;
  }

  get stripVisible(): boolean {
    return this.strip.visible;
  }

  private get busy(): boolean {
    const s = this.brainState;
    return s === 'windup' || s === 'charge' || s === 'stunned';
  }

  // ---- damage ---------------------------------------------------------------------------

  override applyDamage(info: DamageInfo): DamageResult {
    if (!this.alive) return { dealt: 0, zone: info.zone, killed: false, absorbed: true };
    const d = info.direction;
    if (d === undefined) return super.applyDamage(info);
    facing.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const zone = zoneForHit(facing, d, this.brainState === 'stunned');
    return super.applyDamage({ ...info, zone });
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  // ---- decisions (scheduled) --------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const previous = this.brainState;
    const next = decideCharger({
      state: previous,
      timeInState: this.fsm.timeInState,
      distance: p.distance,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      cooldownLeft: this.cooldownLeft,
      playerAlive: p.playerAlive,
    });
    this.transition(next);

    const { ctx } = this.deps;
    this.lockFacing = false;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick();
        break;
      case 'detect': {
        this.lockFacing = true;
        const tracking = p.hasLos || p.timeSinceSeen < CHARGER_LOCAL.loseTargetTime;
        if (!tracking) {
          this.lockFacing = false;
          this.moveSpeed = 0;
          break;
        }
        if (!p.hasLos) {
          this.lockFacing = false;
          this.setGoal(p.lastSeenPos.x, p.lastSeenPos.z);
          this.moveSpeed = CHARGER_ROBOT.walkSpeed;
        } else if (p.distance < CHARGER_ROBOT.chargeTriggerMin) {
          // too close to charge: walk away to open the distance
          this.lockFacing = false;
          awayDir.set(this.position.x - ctx.player.position.x, 0, this.position.z - ctx.player.position.z);
          if (awayDir.lengthSq() < 1e-6) awayDir.set(1, 0, 0);
          awayDir.normalize();
          this.setGoal(
            this.position.x + awayDir.x * CHARGER_LOCAL.backOffDistance,
            this.position.z + awayDir.z * CHARGER_LOCAL.backOffDistance,
          );
          this.moveSpeed = CHARGER_ROBOT.walkSpeed;
        } else {
          // in the window (or waiting out the cooldown): face the player and hold
          this.face(ctx.player.position.x, ctx.player.position.z);
          this.moveSpeed = 0;
        }
        break;
      }
      default:
        this.moveSpeed = 0;
    }
  }

  private patrolTick(): void {
    const wp = this.currentWaypoint();
    if (!wp) {
      this.clearGoal();
      this.moveSpeed = 0;
      return;
    }
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= ENEMY_LOCAL.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = CHARGER_ROBOT.walkSpeed;
  }

  /** Applies a state change and its side effects. */
  private transition(next: ChargerState): void {
    const previous = this.brainState;
    if (!this.fsm.set(next)) return;
    const { ctx } = this.deps;
    this.forceHighRate = next === 'windup' || next === 'charge';
    if (previous === 'charge') this.strip.visible = false;
    switch (next) {
      case 'windup': {
        this.clearGoal();
        this.moveSpeed = 0;
        this.lockFacing = true;
        this.face(ctx.player.position.x, ctx.player.position.z);
        this.planFromYaw(this.desiredYaw);
        this.showStrip();
        ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
        ctx.events.emit('charger:windup', {
          id: this.id,
          position: this.position,
          direction: this.lockDir.clone(),
          duration: CHARGER_ROBOT.telegraphDuration,
        });
        break;
      }
      case 'charge': {
        // lock: face the player's current bearing once, then never steer again
        this.face(ctx.player.position.x, ctx.player.position.z);
        this.yaw = this.desiredYaw;
        this.planFromYaw(this.yaw);
        this.showStrip();
        this.travelled = 0;
        this.hitPlayerThisCharge = false;
        this.chargeSpeed =
          CHARGER_ROBOT.chargeSpeedMin + Math.random() * (CHARGER_ROBOT.chargeSpeedMax - CHARGER_ROBOT.chargeSpeedMin);
        ctx.events.emit('charger:chargeStarted', {
          id: this.id,
          position: this.position,
          direction: this.lockDir.clone(),
        });
        break;
      }
      case 'stunned':
        this.clearGoal();
        this.moveSpeed = 0;
        break;
      default:
        break;
    }
    if (next === 'stunned') this.setVent(true);
    else if (previous === 'stunned') this.setVent(false);
    this.setLightLevel(next === 'charge' ? CHARGER_LOCAL.lightLevels.length - 1 : 0);
  }

  private planFromYaw(yaw: number): void {
    this.lockDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.probeCharge(this.lockDir);
    const plan = planCharge(this.position, this.lockDir, probes);
    this.route.maxDistance = plan.maxDistance;
    this.route.endsAt = plan.endsAt;
  }

  /** Fills `probes` with the first obstacle and first missing ground along `d`. */
  private probeCharge(d: Vector3): void {
    const { physics } = this.deps.ctx;
    const h = CHARGER_ROBOT.halfExtents;
    const reach = CHARGER_ROBOT.maxChargeDistance + h.z + 1;
    let obstacle: number | null = null;
    const side = h.x * CHARGER_LOCAL.sideRayFactor;
    for (let i = -1; i <= 1; i++) {
      // rays from the centre line and both flanks of the body, so a wall corner is not missed
      probeOrigin.set(this.position.x + d.z * side * i, this.position.y, this.position.z - d.x * side * i);
      const hit = physics.raycast(probeOrigin, d, reach, { groups: QueryGroups.worldOnly });
      if (hit) {
        const gap = Math.max(0, hit.distance - h.z);
        if (obstacle === null || gap < obstacle) obstacle = gap;
      }
    }
    probes.obstacleDistance = obstacle;

    let edge: number | null = null;
    const limit = obstacle ?? CHARGER_ROBOT.maxChargeDistance + CHARGER_LOCAL.edgeSafetyMargin;
    for (let s = CHARGER_LOCAL.edgeSampleStep; s <= limit + CHARGER_LOCAL.edgeSafetyMargin; s += CHARGER_LOCAL.edgeSampleStep) {
      if (!this.groundAt(this.position.x + d.x * s, this.position.z + d.z * s)) {
        edge = s;
        break;
      }
    }
    probes.edgeDistance = edge;
  }

  private groundAt(x: number, z: number): boolean {
    if (!isOnLand(x, z)) return false;
    probeOrigin.set(x, this.position.y, z);
    const depth = this.position.y + CHARGER_ROBOT.edgeProbeDepth;
    return this.deps.ctx.physics.raycast(probeOrigin, DOWN, depth, { groups: QueryGroups.worldOnly }) !== null;
  }

  private showStrip(): void {
    const len = this.route.maxDistance;
    this.strip.visible = true;
    this.strip.position.set(this.position.x, CHARGER_LOCAL.stripY, this.position.z);
    this.strip.rotation.y = Math.atan2(this.lockDir.x, this.lockDir.z);
    this.strip.scale.set(CHARGER_LOCAL.stripWidth, 1, Math.max(len, 0.01));
  }

  // ---- fixed-step actions ------------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    const state = this.brainState;
    if (state === 'windup') {
      const { player } = this.deps.ctx;
      this.lockFacing = true;
      this.face(player.position.x, player.position.z);
      this.planFromYaw(this.desiredYaw);
      this.showStrip();
      this.setLightLevel(
        Math.min(
          CHARGER_LOCAL.lightLevels.length - 1,
          Math.floor((this.fsm.timeInState / CHARGER_ROBOT.telegraphDuration) * CHARGER_LOCAL.lightLevels.length),
        ),
      );
    }
    const timed = timedNext(state, this.fsm.timeInState);
    if (timed !== state) this.transition(timed);
    if (this.brainState === 'charge') this.chargeStep(dt);
    super.step(dt);
    if (this.pendingCommand && !this.busy) this.applyCommand(this.pendingTarget);
  }

  private chargeStep(dt: number): void {
    const { ctx } = this.deps;
    const { physics } = ctx;
    const h = CHARGER_ROBOT.halfExtents;
    let step = Math.min(this.chargeSpeed * dt, this.route.maxDistance - this.travelled);
    if (step < 0) step = 0;
    let hitWall = false;
    let hitEdge = false;

    // per-tick safety probes: obstacle ahead and ground ahead
    probeOrigin.copy(this.position);
    const wall = physics.raycast(probeOrigin, this.lockDir, h.z + step + CHARGER_LOCAL.wallContactGap, {
      groups: QueryGroups.worldOnly,
    });
    if (wall) {
      step = Math.max(0, Math.min(step, wall.distance - h.z - CHARGER_LOCAL.wallContactGap));
      hitWall = true;
    }
    const ax = this.position.x + this.lockDir.x * (step + CHARGER_ROBOT.edgeProbeDistance);
    const az = this.position.z + this.lockDir.z * (step + CHARGER_ROBOT.edgeProbeDistance);
    if (!this.groundAt(ax, az)) {
      hitEdge = true;
      step = 0;
    }

    this.position.x += this.lockDir.x * step;
    this.position.z += this.lockDir.z * step;
    this.travelled += step;
    this.placeBody();

    if (!this.hitPlayerThisCharge && ctx.player.alive) {
      const p = ctx.player.position;
      if (playerTouchesBody(p.x, p.y, p.z, this.position.x, this.position.y, this.position.z, this.yaw)) {
        this.hitPlayerThisCharge = true;
        ctx.player.applyDamage({
          amount: CHARGER_ROBOT.damage,
          zone: 'body',
          source: 'enemy',
          point: this.position,
          direction: this.lockDir,
        });
        impulse
          .copy(this.lockDir)
          .multiplyScalar(CHARGER_ROBOT.knockbackSpeed)
          .setY(CHARGER_ROBOT.knockbackUp);
        ctx.player.addImpulse(impulse);
        ctx.events.emit('charger:hitPlayer', { id: this.id, position: this.position });
        ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
      }
    }

    const reached = this.travelled >= this.route.maxDistance - 1e-4;
    if (hitWall || (reached && this.route.endsAt === 'wall')) {
      this.cooldownLeft = CHARGER_ROBOT.cooldown;
      this.transition('stunned');
      ctx.events.emit('charger:stunned', {
        id: this.id,
        position: this.position,
        duration: CHARGER_ROBOT.wallStunDuration,
      });
      ctx.events.emit('vfx:spawn', { kind: 'dust', position: this.position, scale: 2 });
      ctx.events.emit('vfx:spawn', { kind: 'spark', position: this.position, scale: 1.5 });
    } else if (hitEdge || reached) {
      this.cooldownLeft = CHARGER_ROBOT.cooldown;
      this.transition('recover');
    }
  }

  /** Pushes the logical position into the kinematic body and the visual root during a charge. */
  private placeBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  // ---- commands --------------------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    if (this.busy) {
      this.pendingCommand = true;
      this.pendingTarget.copy(target);
      return;
    }
    this.applyCommand(target);
  }

  private applyCommand(target: Vector3): void {
    this.pendingCommand = false;
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (this.brainState === 'detect' && !this.perception.hasLos) this.fsm.set('patrol');
    this.setGoal(target.x, target.z, true);
    this.moveSpeed = CHARGER_ROBOT.walkSpeed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.pendingCommand = false;
    this.strip.visible = false;
    if (this.brainState !== 'destroyed') this.transition('patrol');
    this.clearGoal();
    this.moveSpeed = 0;
    this.cooldownLeft = 0;
  }

  // ---- visuals --------------------------------------------------------------------------

  private setLightLevel(level: number): void {
    if (level === this.lightLevel) return;
    this.lightLevel = level;
    const mat = this.lightMats[level];
    if (!mat) return;
    for (const m of this.lightMeshes) m.material = mat;
  }

  private setVent(hot: boolean): void {
    if (hot === this.ventHot) return;
    this.ventHot = hot;
    this.ventMesh.material = hot ? this.ventHotMat : this.ventMat;
  }

  protected override onDestroyed(): void {
    this.strip.removeFromParent();
  }

  override dispose(): void {
    this.strip.removeFromParent();
    super.dispose();
  }

  /** Charger is only ever a robot that may start a charge when this holds (used by tests). */
  canChargeNow(): boolean {
    const p = this.perception;
    return canStartCharge(p.distance, p.hasLos, this.cooldownLeft);
  }
}
