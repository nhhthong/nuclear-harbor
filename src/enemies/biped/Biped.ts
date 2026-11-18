import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { DamageInfo, DamageResult } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { authoredModel, instantiate, type AuthoredInstance } from '../authored';
import { approach } from '../gait';
import { GlowCue } from '../glowCue';
import { forgetTarget, markAware, type Perception } from '../perception';
import type { SharedAssets } from '../SharedAssets';
import { clawReaches, decideBiped, leapAt, nextTimed, planLeap, tickCooldown, type BipedState, type LeapPlan } from './brain';
import { BIPED } from './tunables';

const hitDir = new Vector3();
const impulse = new Vector3();
const fxPos = new Vector3();
const headPos = new Vector3();
const arc = { x: 0, y: 0, z: 0 };

/** Acceleration limits (m/s^2): it bursts into a run and stops short. */
const ACCEL = 14;
const DECEL = 26;

/**
 * Primitive stand-in used when the authored GLB cannot load: a boxy humanoid, not animated beyond a bob and a
 * crouch. One geometry and material per SharedAssets, shared by every biped.
 */
function buildFallback(shared: SharedAssets): Group {
  const mat = shared.get('biped:fallback-mat', () => new MeshStandardMaterial({ color: 0xc9781a, roughness: 0.6, metalness: 0.4 }));
  const part = (key: string, w: number, h: number, d: number, x: number, y: number, z: number): Mesh => {
    const m = new Mesh(shared.get(`biped:fallback-${key}`, () => new BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const g = new Group();
  g.add(
    part('torso', 0.7, 0.8, 0.4, 0, 1.55, 0),
    part('head', 0.34, 0.3, 0.34, 0, 2.05, -0.02),
    part('legL', 0.2, 1.0, 0.24, 0.17, 0.5, 0),
    part('legR', 0.2, 1.0, 0.24, -0.17, 0.5, 0),
    part('armL', 0.14, 0.8, 0.14, 0.46, 1.5, -0.12),
    part('armR', 0.14, 0.8, 0.14, -0.46, 1.5, -0.12),
  );
  return g;
}

/**
 * Biped robot (enemy type `biped`): patrols its posts; once it notices the player it runs at them, and from 3.5 to 13 m it
 * crouches (glow cue), leaps to where the player stood and claws on landing (14 damage within 2 m), then freezes
 * for 1.2 s. Next to the player it swipes with both claws (9 damage). Decisions are pure (`brain.ts`).
 */
export class Biped extends BaseEnemy {
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private leapCooldown = 0;
  private clawCooldown = 0;
  private readonly jump: LeapPlan = { fromX: 0, fromZ: 0, toX: 0, toZ: 0, distance: 0, airTime: 0.5, apex: 1 };
  private hitThisLeap = false;
  private clawStruck = false;
  private speedTarget = 0;
  private easedSpeed = 0;
  private speedEstimate = 0;
  private lastX: number;
  private lastZ: number;
  private leaps = 0;

  private readonly visual = new Group();
  private readonly inst: AuthoredInstance | null;
  private readonly glow: GlowCue | null = null;
  private readonly fallback: Group | null = null;
  private lastClip = '';

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      {
        type: 'biped',
        maxHp: BIPED.hp,
        centerHeight: BIPED.centerHeight,
        radius: BIPED.radius,
        speed: BIPED.chaseSpeed,
        perceptionRange: BIPED.detectionRange,
      },
      'patrol',
    );
    this.lastX = this.position.x;
    this.lastZ = this.position.z;

    const skin = authoredModel('biped');
    this.inst = skin ? instantiate(skin) : null;
    if (this.inst) {
      this.inst.root.updateMatrixWorld(true);
      const head = this.inst.root.getObjectByName(BIPED.skin.headBone);
      if (head) {
        head.getWorldPosition(headPos);
        this.glow = new GlowCue(this.inst.root, [{ bone: BIPED.skin.headBone, point: headPos, radius: BIPED.skin.glowRadius }], BIPED.skin.glowColor);
      }
      this.inst.player.play('idle', { randomPhase: true, fade: 0 });
      this.visual.add(this.inst.root);
    } else {
      this.fallback = buildFallback(deps.shared);
      this.visual.add(this.fallback);
    }
    this.visual.position.y = -BIPED.centerHeight + BIPED.skin.footLift;
    this.root.add(this.visual);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    const h = BIPED.hit;
    this.addHitVolume(ColliderDesc.cuboid(h.torso.hx, h.torso.hy, h.torso.hz).setTranslation(0, h.torso.y, 0), 'body');
    this.addHitVolume(ColliderDesc.cuboid(h.legs.hx, h.legs.hy, h.legs.hz).setTranslation(0, h.legs.y, 0), 'body');
    this.addHitVolume(ColliderDesc.cuboid(h.head.hx, h.head.hy, h.head.hz).setTranslation(0, h.head.y, h.head.z), 'critical');
  }

  get brainState(): BipedState {
    return this.fsm.state as BipedState;
  }

  /** Leaps started so far (tests, diagnostics). */
  get leapCount(): number {
    return this.leaps;
  }

  get leapCooldownRemaining(): number {
    return this.leapCooldown;
  }

  get authoredLook(): boolean {
    return this.inst !== null;
  }

  // ---- decisions (scheduled) ---------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    const horizontal = Math.hypot(pl.x - this.position.x, pl.z - this.position.z);
    const arrived = this.commanded && Math.hypot(this.commandTarget.x - this.position.x, this.commandTarget.z - this.position.z) <= BIPED.commandArriveRadius;
    if (arrived) this.commanded = false;
    const next = decideBiped({
      state: this.brainState,
      distance: horizontal,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      playerAlive: p.playerAlive,
      commanded: this.commanded,
      leapCooldown: this.leapCooldown,
      clawCooldown: this.clawCooldown,
    });
    this.transition(next);

    switch (this.brainState) {
      case 'patrol':
        this.lockFacing = false;
        this.patrolTick();
        break;
      case 'chase': {
        this.lockFacing = false;
        const tracking = p.hasLos || p.timeSinceSeen < BIPED.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? pl : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        this.speedTarget = BIPED.chaseSpeed;
        break;
      }
      default:
        this.speedTarget = 0;
    }
    // dormant robots are advanced by the base class from `moveSpeed`
    if (this.simLevel === 'dormant') this.moveSpeed = this.hasGoal ? this.speedTarget : 0;
  }

  private patrolTick(): void {
    const wp = this.currentWaypoint();
    if (!wp) {
      this.clearGoal();
      this.speedTarget = 0;
      return;
    }
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= BIPED.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.speedTarget = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.speedTarget = BIPED.patrolSpeed;
  }

  private transition(next: BipedState): void {
    const previous = this.brainState;
    if (!this.fsm.set(next)) return;
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    this.forceHighRate = next === 'crouch' || next === 'leap' || next === 'claw';
    const stop = (): void => {
      this.clearGoal();
      this.speedTarget = 0;
      this.easedSpeed = 0;
      this.moveSpeed = 0;
      this.lockFacing = true;
    };
    switch (next) {
      case 'chase':
        if (previous === 'patrol') ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
        this.lockFacing = false;
        break;
      case 'crouch':
        stop();
        break;
      case 'claw':
        stop();
        this.clawStruck = false;
        this.clawCooldown = BIPED.claw.cooldown;
        break;
      case 'leap': {
        stop();
        // the target is locked now: where the player stands as the biped leaves the ground
        const walkable = this.deps.nav.raycastGrid(this.position.x, this.position.z, pl.x, pl.z);
        planLeap(this.position.x, this.position.z, pl.x, pl.z, walkable, this.jump);
        this.yaw = this.desiredYaw = Math.atan2(-(this.jump.toX - this.position.x), -(this.jump.toZ - this.position.z));
        this.hitThisLeap = false;
        this.leaps++;
        this.fx('dust', this.position.x, 0.2, this.position.z, 1.4);
        ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: fxPos.set(this.jump.toX, 0.1, this.jump.toZ), scale: BIPED.leap.radius, duration: this.jump.airTime + 0.15 });
        break;
      }
      case 'recover':
        stop();
        this.leapCooldown = BIPED.leap.cooldown;
        break;
      default:
        break;
    }
  }

  private fx(kind: 'dust', x: number, y: number, z: number, scale: number): void {
    this.deps.ctx.events.emit('vfx:spawn', { kind, position: fxPos.set(x, y, z), scale });
  }

  // ---- fixed step ------------------------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.leapCooldown = tickCooldown(this.leapCooldown, dt);
    this.clawCooldown = tickCooldown(this.clawCooldown, dt);
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    const state = this.brainState;

    // speed eases towards what the brain wants
    if (state === 'patrol' || state === 'chase') {
      this.easedSpeed = approach(this.easedSpeed, this.speedTarget, (this.speedTarget > this.easedSpeed ? ACCEL : DECEL) * dt);
      this.moveSpeed = this.easedSpeed;
    }
    if (state === 'crouch' || state === 'claw' || state === 'recover') {
      if (state !== 'recover') this.face(pl.x, pl.z);
      if (state === 'claw' && !this.clawStruck && this.fsm.timeInState >= BIPED.claw.windup) this.strike();
    }
    if (state === 'leap') this.leapStep();
    else {
      const timed = nextTimed(state, this.fsm.timeInState);
      if (timed !== state) this.transition(timed);
    }
    super.step(dt);
  }

  private strike(): void {
    const { ctx } = this.deps;
    const c = BIPED.claw;
    this.clawStruck = true;
    ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    const pl = ctx.player;
    if (!pl.alive) return;
    const dx = pl.position.x - this.position.x;
    const dz = pl.position.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (!clawReaches(d, pl.position.y - (this.position.y - BIPED.centerHeight), c.range, c.clearance)) return;
    this.hurt(c.damage, c.knockback, dx, dz, d);
  }

  private hurt(amount: number, knockback: number, dx: number, dz: number, d: number): void {
    const pl = this.deps.ctx.player;
    hitDir.set(dx / (d || 1), 0, dz / (d || 1));
    pl.applyDamage({ amount, zone: 'body', source: 'enemy', point: this.position, direction: hitDir });
    impulse.copy(hitDir).multiplyScalar(knockback).setY(2.5);
    pl.addImpulse(impulse);
  }

  private leapStep(): void {
    const { ctx } = this.deps;
    const t = this.fsm.timeInState;
    const u = Math.min(1, t / this.jump.airTime);
    leapAt(this.jump, u, arc);
    this.position.set(arc.x, BIPED.centerHeight + arc.y, arc.z);
    this.placeBody();
    const pl = ctx.player;
    if (!this.hitThisLeap && pl.alive) {
      const dx = pl.position.x - this.position.x;
      const dz = pl.position.z - this.position.z;
      const d = Math.hypot(dx, dz);
      const landing = u >= 1;
      const reach = landing ? BIPED.leap.radius : BIPED.leap.contactRadius;
      if (clawReaches(d, pl.position.y - (this.position.y - BIPED.centerHeight), reach, BIPED.leap.clearance)) {
        this.hitThisLeap = true;
        ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
        this.hurt(BIPED.leap.damage, BIPED.leap.knockback, dx, dz, d);
      }
    }
    if (u >= 1) {
      this.fx('dust', this.position.x, 0.2, this.position.z, 1.8);
      ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: fxPos.set(this.position.x, 0.12, this.position.z), scale: BIPED.leap.radius, duration: 0.3 });
      this.transition('recover');
    }
  }

  private placeBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  // ---- commands / lifecycle ---------------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    const busy = this.brainState === 'crouch' || this.brainState === 'leap' || this.brainState === 'claw' || this.brainState === 'recover';
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (busy) return;
    if (this.brainState === 'patrol') this.fsm.set('chase');
    this.setGoal(target.x, target.z, true);
    this.speedTarget = BIPED.chaseSpeed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') {
      this.fsm.set('patrol');
      this.forceHighRate = false;
      this.lockFacing = false;
      if (this.position.y !== BIPED.centerHeight) {
        this.position.y = BIPED.centerHeight;
        this.placeBody();
      }
    }
    this.clearGoal();
    this.speedTarget = 0;
    this.easedSpeed = 0;
    this.moveSpeed = 0;
    this.leapCooldown = 0;
    this.clawCooldown = 0;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  protected override onDestroyed(): void {
    this.glow?.dispose();
    this.inst?.dispose();
  }

  override dispose(): void {
    this.glow?.dispose();
    this.inst?.dispose();
    super.dispose();
  }

  // ---- animation (rendered frames, active robots) --------------------------------------------------

  override animate(dt: number, time: number): void {
    if (!this.alive) return;
    const travelled = Math.hypot(this.position.x - this.lastX, this.position.z - this.lastZ);
    if (dt > 0) this.speedEstimate += (travelled / dt - this.speedEstimate) * Math.min(1, dt * 10);
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    const state = this.brainState;
    const t = this.fsm.timeInState;
    // head glow: builds up through the crouch, stays lit in the air, fades after the landing
    let glow = 0;
    if (state === 'crouch') glow = Math.min(1, t / BIPED.leap.telegraph);
    else if (state === 'leap') glow = 1;
    else if (state === 'recover') glow = Math.max(0, 1 - t / 0.5);
    this.glow?.set(glow);

    const inst = this.inst;
    if (!inst) {
      // fallback: bob while moving, sink during the crouch
      const moving = this.speedEstimate > 0.3 ? 1 : 0;
      const crouch = state === 'crouch' ? Math.min(1, t / BIPED.leap.telegraph) : 0;
      this.visual.position.y = -BIPED.centerHeight + Math.abs(Math.sin(time * 9)) * 0.06 * moving - crouch * 0.4;
      return;
    }
    let clip: string;
    let scale = 1;
    let once = false;
    let fade = 0.2;
    switch (state) {
      case 'crouch':
        clip = 'crouch';
        once = true;
        fade = 0.1;
        scale = BIPED.skin.crouchSeconds / BIPED.leap.telegraph;
        break;
      case 'leap':
        clip = 'leap';
        once = true;
        fade = 0.06;
        break;
      case 'claw':
        clip = 'claw';
        once = true;
        fade = 0.08;
        scale = BIPED.skin.clawSeconds / (BIPED.claw.windup + BIPED.claw.recover);
        break;
      case 'recover':
        clip = 'idle';
        fade = 0.35;
        break;
      default:
        if (this.speedEstimate > 0.4) {
          clip = 'run';
          scale = Math.max(0.35, Math.min(2.2, this.speedEstimate / BIPED.skin.runSpeed));
        } else {
          clip = 'idle';
        }
    }
    if (clip !== this.lastClip) {
      this.lastClip = clip;
      inst.player.play(clip, { fade, once, timeScale: scale, randomPhase: clip === 'idle' });
    } else {
      inst.player.setTimeScale(scale);
    }
    inst.player.update(dt);
  }
}
