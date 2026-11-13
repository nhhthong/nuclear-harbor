import { Group, LOD, Mesh, Vector3, type Material } from 'three';
import { ARMY_ROBOT } from '@/config/tunables';
import type { DamageInfo, DamageResult, SimLevel } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { forgetTarget, markAware, type Perception } from '../perception';
import { ENEMY_LOCAL } from '../tunables';
import { decideArmy, engageGoal, radialIntent, type ArmyState, type XZ } from './armyBrain';
import { getArmyAssets } from './model';
import { stepMotion, type Motion, type MotionLimits } from './motion';
import { abortTelegraph, beginSalvo, createSalvo, glowLevel, stepSalvo, type Salvo, type SalvoConfig } from './salvo';
import { ARMY_LOCAL } from './tunables';

const aim = new Vector3();
const shotDir = new Vector3();
const shotFrom = new Vector3();
const dustAt = new Vector3();
const awayDir = new Vector3();
const dustUp = new Vector3(0, 1, 0);
const goal: XZ = { x: 0, z: 0 };
const mechXZ: XZ = { x: 0, z: 0 };
const playerXZ: XZ = { x: 0, z: 0 };

const LIMITS: MotionLimits = { accel: ARMY_ROBOT.accel, decel: ARMY_ROBOT.decel, turnRate: ARMY_ROBOT.turnRate };
const SALVO_CFG: SalvoConfig = {
  telegraphTime: ARMY_ROBOT.telegraphTime,
  shotInterval: ARMY_ROBOT.shotInterval,
  cooldown: ARMY_ROBOT.cooldown,
};

/**
 * Vanguard army mech (ROBOT-REFRESH T-20, enemy type `army`): slow wandering patrol, then
 * disciplined combat movement (smooth acceleration, limited turn rate) to an 18-25 m firing band,
 * strafing, backing off under 8 m, and telegraphed rocket salvos. Decisions run in `think`
 * (scheduled), motion/firing in `step`, body animation in `animate`.
 */
export class ArmyRobot extends BaseEnemy {
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private readonly motion: Motion = { speed: 0, yaw: 0 };
  private readonly salvo: Salvo = createSalvo();
  private salvoCounter = 0;
  private side: 1 | -1 = 1;
  private muzzleSide: 1 | -1 = 1;

  private targetSpeed = 0;
  private gateByHeading = true;
  private faceAim = false;
  private fireDelay = 0;
  private strafeTimer = 0;
  private stallTime = 0;
  private patrolPauseLeft = 0;
  private pauseStarted = false;
  private lastX: number;
  private lastZ: number;

  private readonly visual = new Group();
  private readonly glowMesh: Mesh;
  private readonly glowMats: ReadonlyArray<Material>;
  private glowIndex = 0;
  private stepPhase = 0;
  private lastStepSign = 1;
  private footSide: 1 | -1 = 1;
  private readonly phase = Math.random() * Math.PI * 2;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'army',
        maxHp: ARMY_ROBOT.hp,
        centerHeight: ARMY_LOCAL.centerHeight,
        radius: ARMY_LOCAL.radius,
        speed: ARMY_ROBOT.speed,
        perceptionRange: ARMY_ROBOT.detectionRange,
      },
      'patrol',
    );
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    this.side = Math.random() < 0.5 ? 1 : -1;

    const assets = getArmyAssets(deps.shared);
    const nearGroup = new Group();
    let glow: Mesh | null = null;
    for (const part of assets.near) {
      const mesh = new Mesh(part.geometry, part.material);
      mesh.castShadow = part.id === 'armor';
      if (part.id === 'glow') glow = mesh;
      nearGroup.add(mesh);
    }
    if (!glow) throw new Error('army model has no glow part');
    this.glowMesh = glow;
    this.glowMats = assets.glow;
    this.glowMesh.material = this.glowMats[0] as Material;
    const far = new Mesh(assets.far.geometry, assets.far.material);
    const lod = new LOD();
    lod.addLevel(nearGroup, 0);
    lod.addLevel(far, ARMY_LOCAL.lodFarDistance, 0.1);
    this.visual.add(lod);
    this.root.add(this.visual);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    const h = ARMY_LOCAL.hit;
    this.addHitVolume(ColliderDesc.cuboid(h.torso.hx, h.torso.hy, h.torso.hz).setTranslation(0, h.torso.y, 0), 'body');
    this.addHitVolume(ColliderDesc.cuboid(h.legs.hx, h.legs.hy, h.legs.hz).setTranslation(0, h.legs.y, 0), 'body');
    this.addHitVolume(
      ColliderDesc.cuboid(h.head.hx, h.head.hy, h.head.hz).setTranslation(0, h.head.y, h.head.z),
      'critical',
    );
  }

  get brainState(): ArmyState {
    return this.fsm.state as ArmyState;
  }

  /** Current forward speed (m/s); exposed for tests. */
  get speed(): number {
    return this.motion.speed;
  }

  get salvoPhase(): string {
    return this.salvo.phase;
  }

  // ---- decisions (scheduled rate) -----------------------------------------------------------

  protected think(dt: number, p: Perception): void {
    const { ctx } = this.deps;
    const arrived = this.commanded && this.distanceTo(this.commandTarget) <= ENEMY_LOCAL.commandArriveRadius;
    if (arrived) this.commanded = false;
    const previous = this.brainState;
    const next = decideArmy({
      state: previous,
      distance: p.distance,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      commanded: this.commanded,
      playerAlive: p.playerAlive,
    });

    if (this.fsm.set(next)) {
      if (previous === 'patrol' && next === 'advance' && (p.hasLos || p.timeSinceSeen < ARMY_ROBOT.loseTargetTime)) {
        ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
      }
      if (next === 'engage') this.fireDelay = Math.max(this.fireDelay, ARMY_LOCAL.firstShotDelay);
      if (next !== 'engage' && next !== 'retreat') abortTelegraph(this.salvo);
    }

    this.faceAim = false;
    this.gateByHeading = true;
    const px = ctx.player.position.x;
    const pz = ctx.player.position.z;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick(dt);
        break;
      case 'advance': {
        const tracking = p.hasLos || p.timeSinceSeen < ARMY_ROBOT.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? ctx.player.position : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        // ease off as the firing band comes into reach
        const ease = Math.min(1, Math.max(0.35, (p.distance - ARMY_ROBOT.bandMax + 8) / 8));
        this.targetSpeed = ARMY_ROBOT.advanceSpeed * ease;
        break;
      }
      case 'engage': {
        this.faceAim = true;
        this.gateByHeading = false;
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0 || this.stallTime > 1) {
          this.side = this.side === 1 ? -1 : 1;
          this.strafeTimer = ARMY_LOCAL.strafeFlipMin + Math.random() * (ARMY_LOCAL.strafeFlipMax - ARMY_LOCAL.strafeFlipMin);
          this.stallTime = 0;
        }
        mechXZ.x = this.position.x;
        mechXZ.z = this.position.z;
        playerXZ.x = px;
        playerXZ.z = pz;
        engageGoal(goal, mechXZ, playerXZ, this.side, radialIntent(p.distance), ARMY_LOCAL.strafeStep);
        this.setGoal(goal.x, goal.z);
        this.targetSpeed = ARMY_ROBOT.strafeSpeed;
        break;
      }
      case 'retreat': {
        this.faceAim = true;
        this.gateByHeading = false;
        awayDir.set(this.position.x - px, 0, this.position.z - pz);
        if (awayDir.lengthSq() < 1e-6) awayDir.set(1, 0, 0);
        awayDir.normalize();
        this.setGoal(
          this.position.x + awayDir.x * ARMY_LOCAL.retreatGoalDistance,
          this.position.z + awayDir.z * ARMY_LOCAL.retreatGoalDistance,
        );
        this.targetSpeed = ARMY_ROBOT.retreatSpeed;
        break;
      }
      default:
        this.targetSpeed = 0;
    }
    // dormant robots are advanced by the base class from `moveSpeed`
    if (this.simLevel === 'dormant') {
      this.moveSpeed = this.hasGoal ? this.targetSpeed : 0;
      this.desiredYaw = this.motion.yaw;
    }
  }

  private patrolTick(dt: number): void {
    const wp = this.currentWaypoint();
    if (!wp) {
      this.clearGoal();
      this.targetSpeed = 0;
      return;
    }
    if (this.distanceTo(wp) <= ENEMY_LOCAL.arriveRadius) {
      if (!this.pauseStarted) {
        this.pauseStarted = true;
        this.patrolPauseLeft = ARMY_LOCAL.patrolPause;
      }
      this.patrolPauseLeft -= dt;
      this.targetSpeed = 0;
      if (this.patrolPauseLeft > 0 || this.patrol.length <= 1) return;
      this.pauseStarted = false;
      this.advanceWaypoint();
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.targetSpeed = ARMY_ROBOT.speed;
  }

  private distanceTo(v: Vector3): number {
    return Math.hypot(v.x - this.position.x, v.z - this.position.z);
  }

  // ---- actions (every fixed tick) -----------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.updateMotion(dt);
    super.step(dt);
    if (!this.alive) return;
    this.trackStall(dt);
    this.updateSalvo(dt);
  }

  private updateMotion(dt: number): void {
    const { ctx } = this.deps;
    let want = this.motion.yaw;
    if (this.faceAim) {
      const dx = ctx.player.position.x - this.position.x;
      const dz = ctx.player.position.z - this.position.z;
      if (dx * dx + dz * dz > 1e-4) want = Math.atan2(-dx, -dz);
    } else if (this.hasGoal) {
      let tx = this.goalX;
      let tz = this.goalZ;
      const wp = this.path?.[this.pathIndex];
      if (wp) {
        tx = wp.x;
        tz = wp.z;
      }
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      if (dx * dx + dz * dz > 1e-4) want = Math.atan2(-dx, -dz);
    }
    const target = this.hasGoal ? this.targetSpeed : 0;
    stepMotion(this.motion, target, want, dt, LIMITS, this.gateByHeading);
    this.moveSpeed = this.motion.speed;
    this.desiredYaw = this.motion.yaw;
    this.lockFacing = true; // yaw comes from the limited integrator, never from the base snap-turn
  }

  private trackStall(dt: number): void {
    const moved = Math.hypot(this.position.x - this.lastX, this.position.z - this.lastZ);
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    if (this.targetSpeed > 0.5 && this.hasGoal && moved < this.motion.speed * dt * 0.2) this.stallTime += dt;
    else if (this.stallTime > 0) this.stallTime = Math.max(0, this.stallTime - dt);
  }

  private updateSalvo(dt: number): void {
    const { ctx } = this.deps;
    const p = this.perception;
    if (!ctx.player.alive) {
      this.salvo.phase = 'idle';
      this.salvo.shotsLeft = 0;
      return;
    }
    if (this.fireDelay > 0) this.fireDelay -= dt;
    const fighting = this.brainState === 'engage' || (this.brainState === 'retreat' && this.stallTime > 1);
    if (fighting && p.hasLos && this.fireDelay <= 0 && this.salvo.phase === 'idle') {
      const span = ARMY_ROBOT.salvoMax - ARMY_ROBOT.salvoMin + 1;
      beginSalvo(this.salvo, ARMY_ROBOT.salvoMin + (this.salvoCounter++ % span));
    } else if (!fighting) {
      abortTelegraph(this.salvo);
    } else if (this.salvo.phase === 'telegraph' && !p.hasLos) {
      abortTelegraph(this.salvo);
    }
    if (stepSalvo(this.salvo, dt, SALVO_CFG) > 0) this.fireRocket();
  }

  private fireRocket(): void {
    const { ctx, projectiles } = this.deps;
    this.muzzleSide = this.muzzleSide === 1 ? -1 : 1;
    const m = ARMY_LOCAL.muzzle;
    shotFrom.set(m.x * this.muzzleSide, m.y, m.z).applyAxisAngle(dustUp, this.yaw).add(this.position);
    aim.set(ctx.player.position.x, ctx.player.position.y + ARMY_LOCAL.aimHeight, ctx.player.position.z);
    shotDir.subVectors(aim, shotFrom).normalize();
    if (projectiles.fireRocket(shotFrom, shotDir, ARMY_ROBOT.rocketSpeed, ARMY_ROBOT.damage, ARMY_ROBOT.splashRadius)) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
  }

  protected onCommand(target: Vector3): void {
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (this.brainState === 'patrol') this.fsm.set('advance');
    this.setGoal(target.x, target.z, true);
    this.targetSpeed = ARMY_ROBOT.advanceSpeed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') this.fsm.set('patrol');
    this.clearGoal();
    this.targetSpeed = 0;
    this.moveSpeed = 0;
    this.motion.speed = 0;
    this.salvo.phase = 'idle';
    this.salvo.shotsLeft = 0;
    this.faceAim = false;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  protected override onSimLevelChanged(level: SimLevel, previous: SimLevel): void {
    super.onSimLevelChanged(level, previous);
    if (previous === 'dormant') {
      this.motion.yaw = this.yaw;
      this.motion.speed = 0;
    }
  }

  // ---- visuals (active robots, per rendered frame) ------------------------------------------

  override animate(dt: number, time: number): void {
    const speed = this.motion.speed;
    this.stepPhase += (speed * dt * Math.PI) / ARMY_LOCAL.stepLength;
    const s = Math.sin(this.stepPhase);
    const walking = Math.min(1, speed / ARMY_ROBOT.speed);
    this.visual.position.y = Math.abs(s) * ARMY_LOCAL.bobAmplitude * walking + Math.sin(time * 2.1 + this.phase) * 0.012;
    this.visual.rotation.z = s * ARMY_LOCAL.rollAmplitude * walking;
    this.visual.rotation.y =
      this.brainState === 'patrol' && speed < 0.2
        ? Math.sin(time * 0.9 + this.phase) * 0.06 * (ARMY_LOCAL.scanAmplitude / 0.7)
        : 0;

    // heavy footfall: a dust puff at each foot-down, near the player only
    const sign = s >= 0 ? 1 : -1;
    if (sign !== this.lastStepSign && speed > 0.4) {
      const { ctx } = this.deps;
      const d = Math.hypot(this.position.x - ctx.player.position.x, this.position.z - ctx.player.position.z);
      if (d < ARMY_LOCAL.footDustRange) {
        this.footSide = this.footSide === 1 ? -1 : 1;
        dustAt.set(0.42 * this.footSide, 0, 0).applyAxisAngle(dustUp, this.yaw);
        dustAt.x += this.position.x;
        dustAt.z += this.position.z;
        ctx.events.emit('vfx:spawn', { kind: 'dust', position: dustAt, normal: dustUp, scale: 0.8 });
      }
    }
    this.lastStepSign = sign;

    // missile-cell glow (shared emissive materials, never cloned per robot)
    const level = glowLevel(this.salvo, SALVO_CFG);
    const index = Math.round(level * (this.glowMats.length - 1));
    if (index !== this.glowIndex) {
      this.glowIndex = index;
      this.glowMesh.material = this.glowMats[index] as Material;
    }
  }
}
