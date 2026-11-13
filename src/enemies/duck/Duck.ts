import {
  Group,
  LOD,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { DamageInfo, DamageResult } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { forgetTarget, markAware, type Perception } from '../perception';
import type { SharedAssets } from '../SharedAssets';
import { blastDamage, countdownValue, fuseSpent } from './blast';
import { decideDuck, type DuckState } from './duckBrain';
import { hopArc, hopPhase, hopSpeedFactor, isGrounded } from './hop';
import { buildDuckModel, type DuckModel } from './model';
import { createVertexColorMaterial } from './modelKit';
import { DUCK } from './tunables';
import './events';

const AXIS_X = new Vector3(1, 0, 0);
const facing = new Vector3();
const impulse = new Vector3();
const blastDir = new Vector3();
const qDelta = new Quaternion();

const models = new WeakMap<SharedAssets, DuckModel>();

function modelFor(shared: SharedAssets): DuckModel {
  let m = models.get(shared);
  if (!m) {
    m = buildDuckModel();
    models.set(shared, m);
  }
  return m;
}

/**
 * Bomber Duck (internal type `charger`): patrol -> hop at the player -> stop at about 2.5 m and arm a
 * 3-2-1 countdown -> detonate for a fixed 15 damage inside the blast radius. Shot dead first = small pop only.
 */
export class Duck extends BaseEnemy {
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private baseSpeed = 0;
  private hopTime = 0;
  private lastBeep = -1;
  private readonly phase = Math.random() * Math.PI * 2;

  // visuals
  private readonly model = new Group();
  private readonly feet: Mesh;
  private readonly beakJoint = new Group();
  private readonly beakQuat: Quaternion;
  private readonly beacon: Mesh;
  private readonly beaconOn: MeshStandardMaterial;
  private readonly beaconOff: MeshStandardMaterial;
  private readonly ring: Mesh;
  private beaconLit = false;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'charger',
        maxHp: DUCK.hp,
        centerHeight: DUCK.centerHeight,
        radius: DUCK.radius,
        speed: DUCK.hopSpeed,
        perceptionRange: DUCK.detectionRange,
      },
      'patrol',
    );
    const { shared } = deps;
    const m = modelFor(shared);
    const mat = shared.get('duck:mat', () => createVertexColorMaterial(0.5, 0.12));
    const geo = (key: string, g: BufferGeometry): BufferGeometry => shared.get(`duck:${key}`, () => g);
    this.beaconOn = shared.get(
      'duck:beacon-on',
      () => new MeshStandardMaterial({ color: 0x401000, emissive: 0xff3b1f, emissiveIntensity: 4 }),
    );
    this.beaconOff = shared.get(
      'duck:beacon-off',
      () => new MeshStandardMaterial({ color: 0x401000, emissive: 0x551008, emissiveIntensity: 0.6 }),
    );

    const near = new Group();
    const body = new Mesh(geo('body', m.body), mat);
    body.castShadow = true;
    this.feet = new Mesh(geo('feet', m.feet), mat);
    const beak = new Mesh(geo('beak', m.beak), mat);
    this.beakJoint.position.copy(m.beakPosition);
    this.beakJoint.add(beak);
    this.beakQuat = m.beakQuaternion;
    this.beakJoint.quaternion.copy(this.beakQuat);
    this.beacon = new Mesh(
      shared.get('duck:beacon-geo', () => new SphereGeometry(0.09, 10, 8)),
      this.beaconOff,
    );
    this.beacon.position.copy(m.beaconPosition);
    near.add(body, this.feet, this.beakJoint, this.beacon);
    const far = new Mesh(geo('far', m.far), mat);
    const lod = new LOD();
    lod.addLevel(near, 0);
    lod.addLevel(far, DUCK.lodFar);
    this.model.add(lod);
    this.root.add(this.model);

    // blast radius ring, only visible while arming
    const ringMat = shared.get(
      'duck:ring-mat',
      () =>
        new MeshBasicMaterial({
          color: DUCK.ringColor,
          transparent: true,
          opacity: DUCK.ringOpacity,
          depthWrite: false,
        }),
    );
    const ringGeo = shared.get('duck:ring-geo', () => {
      const g = new RingGeometry(DUCK.blastRadius - 0.25, DUCK.blastRadius, 48);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    this.ring = new Mesh(ringGeo, ringMat);
    this.ring.position.y = -DUCK.centerHeight + DUCK.ringY;
    this.ring.visible = false;
    this.ring.renderOrder = 1;
    this.root.add(this.ring);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    this.addHitVolume(
      ColliderDesc.cuboid(DUCK.bodyHalf.x, DUCK.bodyHalf.y, DUCK.bodyHalf.z).setTranslation(0, DUCK.bodyCenterY, 0),
      'body',
    );
    this.addHitVolume(ColliderDesc.ball(DUCK.headRadius).setTranslation(0, DUCK.headUp, 0), 'critical');
  }

  get brainState(): DuckState {
    return this.fsm.state as DuckState;
  }

  /** Seconds left on the fuse (Infinity when not armed). */
  get fuseLeft(): number {
    return this.brainState === 'arming' ? DUCK.countdownCount * DUCK.countSeconds - this.fsm.timeInState : Infinity;
  }

  get ringVisible(): boolean {
    return this.ring.visible;
  }

  // ---- decisions (scheduled) --------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    const horizontal = Math.hypot(pl.x - this.position.x, pl.z - this.position.z);
    const previous = this.brainState;
    const arrived =
      this.commanded &&
      Math.hypot(this.commandTarget.x - this.position.x, this.commandTarget.z - this.position.z) <= DUCK.armDistance + 0.5;
    if (arrived) this.commanded = false;
    let next = decideDuck({
      state: previous,
      distance: horizontal,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      playerAlive: p.playerAlive,
    });
    if (next === 'patrol' && this.commanded) next = 'hop';
    this.transition(next);

    this.lockFacing = false;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick();
        break;
      case 'hop': {
        this.baseSpeed = DUCK.hopSpeed;
        const tracking = p.hasLos || p.timeSinceSeen < DUCK.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? pl : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        this.moveSpeed = this.baseSpeed;
        break;
      }
      case 'arming':
        this.lockFacing = true;
        this.face(pl.x, pl.z);
        this.moveSpeed = 0;
        break;
      default:
        this.moveSpeed = 0;
    }
    this.checkFuse();
  }

  private patrolTick(): void {
    this.baseSpeed = DUCK.patrolSpeed;
    const wp = this.currentWaypoint();
    if (!wp) {
      this.clearGoal();
      this.moveSpeed = 0;
      return;
    }
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= DUCK.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = DUCK.patrolSpeed;
  }

  private transition(next: DuckState): void {
    const previous = this.brainState;
    if (!this.fsm.set(next)) return;
    const { ctx } = this.deps;
    this.forceHighRate = next === 'arming';
    if (next === 'hop') {
      this.hopTime = 0;
      if (previous === 'patrol') ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
    } else if (next === 'arming') {
      this.clearGoal();
      this.moveSpeed = 0;
      this.lastBeep = -1;
      this.ring.visible = true;
      facing.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      ctx.events.emit('charger:windup', {
        id: this.id,
        position: this.position,
        direction: facing,
        duration: DUCK.countdownCount * DUCK.countSeconds,
      });
    }
    if (previous === 'arming') this.ring.visible = false;
  }

  // ---- fuse ---------------------------------------------------------------------------------

  /** Beeps at 3, 2, 1 and detonates when the fuse is spent. Called from the fixed step and from think. */
  private checkFuse(): void {
    if (!this.alive || this.brainState !== 'arming') return;
    const elapsed = this.fsm.timeInState;
    const count = countdownValue(elapsed, DUCK.countdownCount, DUCK.countSeconds);
    if (count !== this.lastBeep && count > 0) {
      this.lastBeep = count;
      this.deps.ctx.events.emit('duck:beep', { id: this.id, position: this.position, count });
    }
    if (fuseSpent(elapsed, DUCK.countdownCount, DUCK.countSeconds)) this.explode();
  }

  private explode(): void {
    const { ctx } = this.deps;
    const pl = ctx.player;
    const dx = pl.position.x - this.position.x;
    const dy = pl.position.y + DUCK.blastAimHeight - this.position.y;
    const dz = pl.position.z - this.position.z;
    const distance = Math.hypot(dx, dy, dz);
    const damage = pl.alive ? blastDamage(distance, DUCK.blastRadius, DUCK.blastDamage) : 0;
    const hit = damage > 0;
    if (hit) {
      blastDir.set(dx, 0, dz);
      if (blastDir.lengthSq() < 1e-6) blastDir.set(0, 0, -1);
      blastDir.normalize();
      pl.applyDamage({ amount: damage, zone: 'body', source: 'enemy', point: this.position, direction: blastDir });
      impulse.copy(blastDir).multiplyScalar(DUCK.blastKnockback).setY(DUCK.blastKnockbackUp);
      pl.addImpulse(impulse);
      ctx.events.emit('charger:hitPlayer', { id: this.id, position: this.position });
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
    ctx.events.emit('duck:explode', { id: this.id, position: this.position, radius: DUCK.blastRadius, hitPlayer: hit });
    ctx.events.emit('vfx:spawn', { kind: 'explosion', position: this.position, scale: DUCK.blastVfxScale });
    ctx.events.emit('vfx:spawn', { kind: 'smoke', position: this.position, scale: 1.4 });
    this.destroy();
  }

  // ---- fixed step ---------------------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    if (this.brainState === 'hop') {
      this.hopTime += dt;
      const u = hopPhase(this.hopTime, DUCK.hopPeriod);
      this.moveSpeed = this.baseSpeed * hopSpeedFactor(u, DUCK.landFraction);
    }
    super.step(dt);
    this.checkFuse();
  }

  override tickDormant(dt: number): void {
    super.tickDormant(dt);
    this.checkFuse();
  }

  // ---- commands / lifecycle -----------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    if (this.brainState === 'arming') return;
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    this.setGoal(target.x, target.z, true);
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') {
      this.fsm.set('patrol');
      this.forceHighRate = false;
      this.ring.visible = false;
    }
    this.clearGoal();
    this.moveSpeed = 0;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  protected override onDestroyed(): void {
    this.ring.visible = false;
  }

  // ---- animation ----------------------------------------------------------------------------

  override animate(_dt: number, time: number): void {
    if (!this.alive) return;
    const state = this.brainState;
    let lift = 0;
    let stride = 0;
    let beakDelta = 0;
    let pulse = 0;
    if (state === 'hop') {
      const u = hopPhase(this.hopTime, DUCK.hopPeriod);
      lift = hopArc(u, DUCK.landFraction, DUCK.hopHeight);
      stride = isGrounded(u, DUCK.landFraction) ? 0 : Math.sin(u * Math.PI * 2) * 0.06;
      beakDelta = isGrounded(u, DUCK.landFraction) ? -0.25 : 0.1;
    } else if (state === 'patrol' && this.moveSpeed > 0) {
      const w = time * 7 + this.phase;
      lift = Math.abs(Math.sin(w)) * 0.05;
      stride = Math.sin(w) * 0.04;
    } else if (state === 'arming') {
      const elapsed = this.fsm.timeInState;
      const countIndex = Math.min(DUCK.flashHz.length - 1, Math.floor(elapsed / DUCK.countSeconds));
      const hz = DUCK.flashHz[countIndex] ?? 2;
      this.setBeacon(Math.floor(elapsed * hz * 2) % 2 === 0);
      const frac = (elapsed / DUCK.countSeconds) % 1;
      pulse = Math.max(0, 1 - frac * 5) * DUCK.beepPulse;
      beakDelta = 0.35 * Math.sin(time * 30);
    } else {
      beakDelta = Math.sin(time * 1.6 + this.phase) * 0.05;
    }
    if (state !== 'arming') this.setBeacon(false);
    this.model.position.y = lift;
    this.model.scale.setScalar(1 + pulse);
    this.feet.position.y = Math.abs(stride) * 0.6;
    this.feet.rotation.z = stride * 2;
    this.beakJoint.quaternion.copy(this.beakQuat).multiply(qDelta.setFromAxisAngle(AXIS_X, beakDelta));
    this.root.position.y = this.position.y;
  }

  private setBeacon(lit: boolean): void {
    if (lit === this.beaconLit) return;
    this.beaconLit = lit;
    this.beacon.material = lit ? this.beaconOn : this.beaconOff;
  }
}
