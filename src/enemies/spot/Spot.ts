import { Group, LOD, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import type { DamageInfo, DamageResult } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { createVertexColorMaterial } from '../duck/modelKit';
import { forgetTarget, markAware, type Perception } from '../perception';
import type { SharedAssets } from '../SharedAssets';
import { buildSpotModel, type SpotModel } from './model';
import { decideSpot, lungeTouchesPlayer, retreatDirection, type SpotState } from './spotBrain';
import { SPOT } from './tunables';

const impulse = new Vector3();
const away = { x: 0, z: 0 };
const retreatDir = { x: 0, z: 0 };

const models = new WeakMap<SharedAssets, SpotModel>();

function modelFor(shared: SharedAssets): SpotModel {
  let m = models.get(shared);
  if (!m) {
    m = buildSpotModel();
    models.set(shared, m);
  }
  return m;
}

/** Alternates the circling side between dogs so groups split. */
let sideCounter = 0;

/**
 * Spot dog (enemy type `spot`): patrol -> chase -> crouch telegraph -> leaping headbutt along a
 * locked line (10 damage + knockback) -> retreat and circle while the 2.5 s cooldown runs -> chase.
 */
export class Spot extends BaseEnemy {
  private readonly side: 1 | -1 = sideCounter++ % 2 === 0 ? 1 : -1;
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private cooldownLeft = 0;
  private readonly lockDir = new Vector3(0, 0, -1);
  private travelled = 0;
  private hitThisLunge = false;
  private lungeCount = 0;
  private lastX: number;
  private lastZ: number;
  private speedEstimate = 0;
  private gait = 0;

  private readonly model = new Group();
  private readonly legsA: Mesh;
  private readonly legsB: Mesh;
  private readonly lamps: Mesh;
  private readonly lampOn: MeshStandardMaterial;
  private readonly lampOff: MeshStandardMaterial;
  private lampLit = false;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'spot',
        maxHp: SPOT.hp,
        centerHeight: SPOT.centerHeight,
        radius: SPOT.radius,
        speed: SPOT.chaseSpeed,
        perceptionRange: SPOT.detectionRange,
      },
      'patrol',
    );
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    const { shared } = deps;
    const m = modelFor(shared);
    const mat = shared.get('spot:mat', () => createVertexColorMaterial(0.36, 0.62, { key: 'spot', wear: 0.45, bottomY: -0.6, height: 1.4 }));
    const geo = (key: string, g: BufferGeometry): BufferGeometry => shared.get(`spot:${key}`, () => g);
    this.lampOff = shared.get(
      'spot:lamp-off',
      () => new MeshStandardMaterial({ color: 0x0a141a, emissive: 0x38c8e8, emissiveIntensity: 1.6 }),
    );
    this.lampOn = shared.get(
      'spot:lamp-on',
      () => new MeshStandardMaterial({ color: 0x300000, emissive: 0xff2a1a, emissiveIntensity: 5 }),
    );

    const near = new Group();
    const body = new Mesh(geo('body', m.body), mat);
    body.castShadow = true;
    this.legsA = new Mesh(geo('legsA', m.legsA), mat);
    this.legsB = new Mesh(geo('legsB', m.legsB), mat);
    this.legsA.position.copy(m.legPivot);
    this.legsB.position.copy(m.legPivot);
    this.lamps = new Mesh(geo('lamps', m.lamps), this.lampOff);
    near.add(body, this.legsA, this.legsB, this.lamps);
    const far = new Mesh(geo('far', m.far), mat);
    const lod = new LOD();
    lod.addLevel(near, 0);
    lod.addLevel(far, SPOT.lodFar);
    this.model.add(lod);
    this.root.add(this.model);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    this.addHitVolume(
      ColliderDesc.cuboid(SPOT.bodyHalf.x, SPOT.bodyHalf.y, SPOT.bodyHalf.z).setTranslation(0, SPOT.bodyCenterY, 0),
      'body',
    );
    this.addHitVolume(
      ColliderDesc.cuboid(SPOT.noseHalf.x, SPOT.noseHalf.y, SPOT.noseHalf.z).setTranslation(0, SPOT.noseUp, -SPOT.noseForward),
      'critical',
    );
  }

  get brainState(): SpotState {
    return this.fsm.state as SpotState;
  }

  /** Remaining cooldown before the next lunge may be prepared (s). */
  get cooldownRemaining(): number {
    return this.cooldownLeft;
  }

  /** Number of lunges started so far (tests, diagnostics). */
  get lunges(): number {
    return this.lungeCount;
  }

  // ---- decisions (scheduled) --------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    if (this.brainState === 'lunge') return;
    const horizontal = Math.hypot(pl.x - this.position.x, pl.z - this.position.z);
    const arrived =
      this.commanded &&
      Math.hypot(this.commandTarget.x - this.position.x, this.commandTarget.z - this.position.z) <= SPOT.commandArriveRadius;
    if (arrived) this.commanded = false;
    const next = decideSpot({
      state: this.brainState,
      timeInState: this.fsm.timeInState,
      distance: horizontal,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      playerAlive: p.playerAlive,
      cooldownLeft: this.cooldownLeft,
      commanded: this.commanded,
    });
    this.transition(next);

    this.lockFacing = false;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick();
        break;
      case 'chase': {
        const tracking = p.hasLos || p.timeSinceSeen < SPOT.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? pl : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        this.moveSpeed = SPOT.chaseSpeed;
        break;
      }
      case 'telegraph':
        this.lockFacing = true;
        this.face(pl.x, pl.z);
        this.moveSpeed = 0;
        break;
      case 'retreat':
        this.retreatTick(horizontal, pl.x, pl.z);
        break;
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
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= SPOT.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = SPOT.patrolSpeed;
  }

  /** Back away first, then circle the player at the circle radius, always looking at the player. */
  private retreatTick(distance: number, px: number, pz: number): void {
    const d = distance || 1;
    away.x = (this.position.x - px) / d;
    away.z = (this.position.z - pz) / d;
    const t = this.fsm.timeInState;
    retreatDirection(t, away.x, away.z, this.side, retreatDir);
    if (t >= SPOT.backoffTime) {
      // keep the circle radius: drift inward when too far, outward when too close
      const k = Math.max(-1, Math.min(1, (SPOT.circleRadius - distance) / SPOT.circleRadius));
      retreatDir.x += away.x * k;
      retreatDir.z += away.z * k;
    }
    const len = Math.hypot(retreatDir.x, retreatDir.z) || 1;
    this.setGoal(this.position.x + (retreatDir.x / len) * 4, this.position.z + (retreatDir.z / len) * 4);
    this.moveSpeed = t < SPOT.backoffTime ? SPOT.backoffSpeed : SPOT.circleSpeed;
    this.lockFacing = true;
    this.face(px, pz);
  }

  private transition(next: SpotState): void {
    const previous = this.brainState;
    if (!this.fsm.set(next)) return;
    const { ctx } = this.deps;
    this.forceHighRate = next === 'telegraph' || next === 'lunge';
    switch (next) {
      case 'chase':
        if (previous === 'patrol') ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
        break;
      case 'telegraph':
        this.clearGoal();
        this.moveSpeed = 0;
        this.lockFacing = true;
        this.setLamps(true);
        break;
      case 'lunge': {
        const pl = ctx.player.position;
        this.face(pl.x, pl.z);
        this.yaw = this.desiredYaw;
        this.lockDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.travelled = 0;
        this.hitThisLunge = false;
        this.lungeCount++;
        this.clearGoal();
        this.moveSpeed = 0;
        this.setLamps(true);
        break;
      }
      case 'retreat':
        this.setLamps(false);
        break;
      default:
        break;
    }
    if (next === 'patrol') this.setLamps(false);
  }

  // ---- fixed step -------------------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    const state = this.brainState;
    if (state === 'telegraph' && this.fsm.timeInState >= SPOT.telegraphTime) this.transition('lunge');
    if (this.brainState === 'lunge') this.lungeStep(dt);
    super.step(dt);
  }

  private lungeStep(dt: number): void {
    const { ctx, nav } = this.deps;
    let step = Math.min(SPOT.lungeSpeed * dt, SPOT.lungeMaxDistance - this.travelled);
    if (step < 0) step = 0;
    const nx = this.position.x + this.lockDir.x * step;
    const nz = this.position.z + this.lockDir.z * step;
    let blocked = false;
    if (nav.isWalkable(nx, nz)) {
      this.position.x = nx;
      this.position.z = nz;
      this.travelled += step;
      this.placeBody();
    } else {
      blocked = true;
    }

    if (!this.hitThisLunge && ctx.player.alive) {
      const p = ctx.player.position;
      if (lungeTouchesPlayer(p.x - this.position.x, p.z - this.position.z, p.y, this.position.y - SPOT.centerHeight)) {
        this.hitThisLunge = true;
        ctx.player.applyDamage({
          amount: SPOT.damage,
          zone: 'body',
          source: 'enemy',
          point: this.position,
          direction: this.lockDir,
        });
        impulse.copy(this.lockDir).multiplyScalar(SPOT.knockbackSpeed).setY(SPOT.knockbackUp);
        ctx.player.addImpulse(impulse);
        ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
      }
    }
    if (this.hitThisLunge || blocked || this.travelled >= SPOT.lungeMaxDistance - 1e-4) {
      this.cooldownLeft = SPOT.cooldown;
      this.transition('retreat');
    }
  }

  private placeBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  // ---- commands / lifecycle -----------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    const busy = this.brainState === 'telegraph' || this.brainState === 'lunge';
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (busy) return;
    if (this.brainState === 'patrol') this.fsm.set('chase');
    this.setGoal(target.x, target.z, true);
    this.moveSpeed = SPOT.chaseSpeed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') {
      this.fsm.set('patrol');
      this.forceHighRate = false;
      this.setLamps(false);
    }
    this.clearGoal();
    this.moveSpeed = 0;
    this.cooldownLeft = 0;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  // ---- animation ----------------------------------------------------------------------------

  override animate(dt: number, _time: number): void {
    if (!this.alive) return;
    if (dt > 0) {
      const inst = Math.hypot(this.position.x - this.lastX, this.position.z - this.lastZ) / dt;
      this.speedEstimate += (inst - this.speedEstimate) * Math.min(1, dt * 10);
    }
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    const state = this.brainState;
    let swing = 0;
    let lift = 0;
    let drop = 0;
    if (state === 'lunge') {
      const w = Math.min(1, this.travelled / SPOT.lungeMaxDistance);
      lift = 4 * SPOT.lungeArcHeight * w * (1 - w);
      swing = -SPOT.lungeSwing;
    } else if (state === 'telegraph') {
      const k = Math.min(1, this.fsm.timeInState / SPOT.telegraphTime);
      drop = SPOT.crouchDrop * k;
    } else {
      const f = Math.min(1.4, this.speedEstimate / SPOT.chaseSpeed);
      this.gait += dt * SPOT.trotFrequency * Math.PI * 2 * (0.3 + f);
      swing = Math.sin(this.gait) * SPOT.trotSwing * Math.min(1, f * 2);
      lift = Math.abs(Math.cos(this.gait)) * 0.02 * Math.min(1, f * 2);
    }
    this.legsA.rotation.x = swing;
    this.legsB.rotation.x = state === 'lunge' ? SPOT.lungeSwing : -swing;
    this.model.position.y = lift - drop;
    this.root.position.y = this.position.y;
  }

  private setLamps(lit: boolean): void {
    if (lit === this.lampLit) return;
    this.lampLit = lit;
    this.lamps.material = lit ? this.lampOn : this.lampOff;
  }
}
