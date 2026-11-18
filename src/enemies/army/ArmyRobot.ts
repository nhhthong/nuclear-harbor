import { Bone, Group, LOD, Mesh, Quaternion, Skeleton, SkinnedMesh, Vector3, type Material, type Matrix4 } from 'three';
import { createGaitPose, gaitPose, strideLength } from '../gait';
import { ARMY_ROBOT } from '@/config/tunables';
import type { DamageInfo, DamageResult, SimLevel } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { authoredModel, instantiate, type AuthoredInstance } from '../authored';
import { GlowCue } from '../glowCue';
import { forgetTarget, markAware, type Perception } from '../perception';
import { ENEMY_LOCAL } from '../tunables';
import { abortAttack, createAttack, podGlow, stepAttack, type Attack } from './attack';
import { decideArmy, engageGoal, radialIntent, type ArmyState, type XZ } from './armyBrain';
import { ARMY_BONE_PARENT, getArmyAssets } from './model';
import { stepMotion, type Motion, type MotionLimits } from './motion';
import { ARMY_LOCAL, STRIKER } from './tunables';

const aim = new Vector3();
const shotDir = new Vector3();
const shotFrom = new Vector3();
const boneTurn = new Quaternion();
const AXIS_X = new Vector3(1, 0, 0);
const dustAt = new Vector3();
const awayDir = new Vector3();
const dustUp = new Vector3(0, 1, 0);
const glowPoint = new Vector3();
const goal: XZ = { x: 0, z: 0 };
const mechXZ: XZ = { x: 0, z: 0 };
const playerXZ: XZ = { x: 0, z: 0 };

const LIMITS: MotionLimits = { accel: ARMY_ROBOT.accel, decel: ARMY_ROBOT.decel, turnRate: ARMY_ROBOT.turnRate };

/**
 * Medium Mech Striker (enemy type `army`, spec 26): slow wandering patrol, then disciplined combat movement (smooth
 * acceleration, limited turn rate) into a firing band, strafing, backing off under 8 m. It fires 3-round bursts of
 * bullets (5 damage each, small spread, muzzle flash and tracer) about every 1.6 s at 8 to 35 m and, every 6 to 9 s,
 * telegraphs (pods glow, it stands still) and launches a rocket with splash damage. Decisions run in `think`
 * (scheduled), motion and firing in `step`, animation in `animate`: the authored GLB is driven by an
 * `AnimationMixer` (idle / walk / run); without it the procedural mech with its stepping legs is used.
 */
export class ArmyRobot extends BaseEnemy {
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private readonly motion: Motion = { speed: 0, yaw: 0 };
  private readonly attack: Attack = createAttack();
  private recoil = 0;
  private flash = 0;
  private side: 1 | -1 = 1;
  private muzzleSide: 1 | -1 = 1;
  private podSide: 1 | -1 = 1;
  private flashSide: 1 | -1 = 1;

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
  private readonly bones: Bone[] = [];
  private readonly boneRestQuat: Quaternion[] = [];
  private legLength = 1;
  private readonly gait = createGaitPose();
  private walkAmount = 0;
  private glowMesh: Mesh | null = null;
  private glowMats: ReadonlyArray<Material> = [];
  private glowIndex = 0;
  // authored look (null: procedural fallback)
  private readonly inst: AuthoredInstance | null;
  private pods: GlowCue | null = null;
  private flashL: GlowCue | null = null;
  private flashR: GlowCue | null = null;
  private lastClip = '';
  private lastStepIndex = 0;
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

    const skin = authoredModel('striker');
    this.inst = skin ? instantiate(skin) : null;
    if (this.inst) this.buildAuthored(this.inst);
    else this.buildProcedural(deps);
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

  private buildAuthored(inst: AuthoredInstance): void {
    inst.root.updateMatrixWorld(true);
    const at = (x: number, y: number, z: number, radius: number, bone: string) => ({ bone, point: glowPoint.set(x, y, z).clone(), radius });
    const g = STRIKER.gun;
    const pd = STRIKER.pod;
    const sk = STRIKER.skin;
    // left bones are at -x, right bones at +x
    this.pods = new GlowCue(inst.root, [at(-pd.x, pd.y, pd.z, sk.glowRadius, sk.podBones[0]), at(pd.x, pd.y, pd.z, sk.glowRadius, sk.podBones[1])], sk.glowColor);
    this.flashL = new GlowCue(inst.root, [at(-g.x, g.y, g.z, 0.2, sk.gunBones[0])], 0xffd27a);
    this.flashR = new GlowCue(inst.root, [at(g.x, g.y, g.z, 0.2, sk.gunBones[1])], 0xffd27a);
    inst.player.play('idle', { randomPhase: true, fade: 0 });
    this.visual.position.y = -ARMY_LOCAL.centerHeight + sk.footLift;
    this.visual.add(inst.root);
  }

  private buildProcedural(deps: EnemyDeps): void {
    const assets = getArmyAssets(deps.shared);
    const nearGroup = new Group();
    // walk rig: one skeleton per robot, the six merged meshes all bind to it
    for (let i = 0; i < assets.boneRest.length; i++) {
      const bone = new Bone();
      (assets.boneRest[i] as Matrix4).decompose(bone.position, bone.quaternion, bone.scale);
      this.boneRestQuat.push(bone.quaternion.clone());
      const parent = ARMY_BONE_PARENT[i] as number;
      (parent < 0 ? nearGroup : (this.bones[parent] as Bone)).add(bone);
      this.bones.push(bone);
    }
    this.legLength = assets.legLength;
    nearGroup.updateMatrixWorld(true);
    const skeleton = new Skeleton(this.bones);
    let glow: Mesh | null = null;
    for (const part of assets.near) {
      const mesh = new SkinnedMesh(part.geometry, part.material);
      mesh.bind(skeleton);
      // legs swing outside the rest bounds: cull by the robot's root instead
      mesh.frustumCulled = false;
      mesh.castShadow = part.id === 'armor';
      if (part.id === 'glow') glow = mesh;
      nearGroup.add(mesh);
    }
    if (!glow) throw new Error('army model has no glow part');
    this.glowMesh = glow;
    this.glowMats = assets.glow;
    glow.material = this.glowMats[0] as Material;
    const far = new Mesh(assets.far.geometry, assets.far.material);
    const lod = new LOD();
    lod.addLevel(nearGroup, 0);
    lod.addLevel(far, ARMY_LOCAL.lodFarDistance, 0.1);
    this.visual.add(lod);
  }

  get authoredLook(): boolean {
    return this.inst !== null;
  }

  get brainState(): ArmyState {
    return this.fsm.state as ArmyState;
  }

  /** Current forward speed (m/s); exposed for tests. */
  get speed(): number {
    return this.motion.speed;
  }

  get attackPhase(): string {
    return this.attack.phase;
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
      if (next === 'engage' || (previous === 'patrol' && next === 'advance')) this.fireDelay = Math.max(this.fireDelay, ARMY_LOCAL.firstShotDelay);
      if (next === 'patrol') abortAttack(this.attack);
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
    this.updateAttack(dt);
  }

  private updateMotion(dt: number): void {
    const { ctx } = this.deps;
    let want = this.motion.yaw;
    const phase = this.attack.phase;
    const aiming = this.faceAim || phase === 'telegraph' || phase === 'burst';
    if (aiming) {
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
    // the mech plants its feet while the pods charge for the rocket
    const target = this.hasGoal && phase !== 'telegraph' ? this.targetSpeed : 0;
    stepMotion(this.motion, target, want, dt, LIMITS, this.gateByHeading && !aiming);
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

  private updateAttack(dt: number): void {
    const { ctx } = this.deps;
    const p = this.perception;
    if (!ctx.player.alive) {
      this.attack.phase = 'idle';
      this.attack.shotsLeft = 0;
      return;
    }
    if (this.fireDelay > 0) this.fireDelay -= dt;
    const state = this.brainState;
    const horizontal = Math.hypot(ctx.player.position.x - this.position.x, ctx.player.position.z - this.position.z);
    const b = STRIKER.burst;
    const canFire =
      p.hasLos &&
      this.fireDelay <= 0 &&
      (state === 'engage' || state === 'advance' || state === 'retreat') &&
      horizontal >= b.minRange &&
      horizontal <= b.maxRange;
    const step = stepAttack(this.attack, dt, canFire);
    if (step.bullets > 0) this.fireBullet();
    if (step.rockets > 0) this.fireRocket();
  }

  /** Aim point: the player's chest, plus the spread of the burst. */
  private aimFrom(from: Vector3, spread: number): Vector3 {
    const { ctx } = this.deps;
    aim.set(ctx.player.position.x, ctx.player.position.y + ARMY_LOCAL.aimHeight, ctx.player.position.z);
    shotDir.subVectors(aim, from).normalize();
    if (spread > 0) {
      shotDir.x += (Math.random() - 0.5) * 2 * spread;
      shotDir.y += (Math.random() - 0.5) * 2 * spread;
      shotDir.z += (Math.random() - 0.5) * 2 * spread;
      shotDir.normalize();
    }
    return shotDir;
  }

  private muzzle(point: { x: number; y: number; z: number }, side: 1 | -1): Vector3 {
    return shotFrom
      .set(point.x * side, point.y - ARMY_LOCAL.centerHeight, point.z)
      .applyAxisAngle(dustUp, this.yaw)
      .add(this.position);
  }

  private fireBullet(): void {
    const { ctx, projectiles } = this.deps;
    this.muzzleSide = this.muzzleSide === 1 ? -1 : 1;
    const b = STRIKER.burst;
    this.muzzle(STRIKER.gun, this.muzzleSide);
    this.aimFrom(shotFrom, b.spread);
    if (projectiles.fire(shotFrom, shotDir, b.speed, b.damage)) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
    this.recoil = Math.min(0.07, this.recoil + STRIKER.recoil);
    this.flash = 1;
    this.flashSide = this.muzzleSide;
  }

  private fireRocket(): void {
    const { ctx, projectiles } = this.deps;
    this.podSide = this.podSide === 1 ? -1 : 1;
    const r = STRIKER.rocket;
    this.muzzle(STRIKER.pod, this.podSide);
    this.aimFrom(shotFrom, 0);
    if (projectiles.fireRocket(shotFrom, shotDir, r.speed, r.damage, r.splashRadius)) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
    this.recoil = Math.min(0.07, this.recoil + STRIKER.recoil * 3);
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
    this.attack.phase = 'idle';
    this.attack.shotsLeft = 0;
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
    // recoil kick of the body per round, decaying
    this.recoil = Math.max(0, this.recoil - this.recoil * STRIKER.recoilDecay * dt);
    this.flash = Math.max(0, this.flash - dt * 14);
    const inst = this.inst;
    if (inst) this.animateAuthored(inst, dt);
    else this.animateProcedural(dt, time);
    this.visual.rotation.x = this.recoil;
  }

  private animateAuthored(inst: AuthoredInstance, dt: number): void {
    const speed = this.motion.speed;
    const sk = STRIKER.skin;
    const state = this.brainState;
    let clip = 'idle';
    let scale = 1;
    if (speed > 0.25) {
      if (speed > sk.runAbove && state !== 'retreat') {
        clip = 'run';
        scale = speed / sk.runSpeed;
      } else {
        clip = 'walk';
        scale = speed / sk.walkSpeed;
      }
      scale = Math.max(sk.minScale, Math.min(sk.maxScale, scale));
      // backing away while facing the player: the walk cycle runs backwards
      if (state === 'retreat') scale = -scale;
    }
    if (clip !== this.lastClip) {
      this.lastClip = clip;
      inst.player.play(clip, { fade: 0.25, timeScale: scale, randomPhase: clip === 'idle' });
    } else {
      inst.player.setTimeScale(scale);
    }
    inst.player.update(dt);

    // heavy footfall: a dust puff at each foot-down (two per walk cycle), near the player only
    if (clip !== 'idle') {
      const k = Math.floor(inst.player.progress * 2);
      if (k !== this.lastStepIndex) {
        this.lastStepIndex = k;
        const { ctx } = this.deps;
        const d = Math.hypot(this.position.x - ctx.player.position.x, this.position.z - ctx.player.position.z);
        if (d < ARMY_LOCAL.footDustRange) {
          this.footSide = this.footSide === 1 ? -1 : 1;
          dustAt.set(0.6 * this.footSide, 0, 0).applyAxisAngle(dustUp, this.yaw);
          dustAt.x += this.position.x;
          dustAt.z += this.position.z;
          ctx.events.emit('vfx:spawn', { kind: 'dust', position: dustAt, normal: dustUp, scale: 1 });
        }
      }
    }

    // rocket pods glow during the telegraph; the muzzle of the gun that just fired flashes
    this.pods?.set(podGlow(this.attack));
    this.flashR?.set(this.flashSide === 1 ? this.flash : 0);
    this.flashL?.set(this.flashSide === -1 ? this.flash : 0);
  }

  private animateProcedural(dt: number, time: number): void {
    const speed = this.motion.speed;
    const f = Math.min(1, speed / ARMY_ROBOT.speed);
    // phase from the ground covered: one cycle per stride, so the feet do not slide
    this.stepPhase += ((speed * dt) / strideLength(this.legLength, f * 0.6)) * Math.PI * 2;
    this.walkAmount += ((speed > 0.2 ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 6);
    const pose = gaitPose(this.stepPhase, this.walkAmount, f * 0.6, this.legLength, this.gait);
    // the bones carry the reference's 180-degree turn, so forward is a negative X rotation
    this.setBone(1, -pose.left.hip);
    this.setBone(2, -pose.left.knee);
    this.setBone(3, -pose.right.hip);
    this.setBone(4, -pose.right.knee);
    // foot strikes happen at the extremes of the swing
    const s = Math.cos(this.stepPhase);
    this.visual.position.y = pose.bob * 0.8 + Math.sin(time * 2.1 + this.phase) * 0.012;
    this.visual.rotation.z = pose.sway * 0.8;
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
    const level = podGlow(this.attack);
    const index = Math.round(level * (this.glowMats.length - 1));
    if (index !== this.glowIndex && this.glowMesh) {
      this.glowIndex = index;
      this.glowMesh.material = this.glowMats[index] as Material;
    }
  }

  protected override onDestroyed(): void {
    this.releaseLook();
  }

  override dispose(): void {
    this.releaseLook();
    super.dispose();
  }

  private releaseLook(): void {
    this.pods?.dispose();
    this.flashL?.dispose();
    this.flashR?.dispose();
    this.inst?.dispose();
  }

  private setBone(index: number, angle: number): void {
    const bone = this.bones[index] as Bone;
    boneTurn.setFromAxisAngle(AXIS_X, angle);
    bone.quaternion.copy(this.boneRestQuat[index] as Quaternion).multiply(boneTurn);
  }
}
