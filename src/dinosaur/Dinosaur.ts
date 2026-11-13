import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Collider, ColliderDesc, RigidBody } from '@dimforge/rapier3d-compat';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { DEFAULT_ZONE_MULTIPLIERS, resolveDamage } from '@/combat/damage';
import { isOnLand } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { Damageable, DamageInfo, DamageResult, HitZone } from '@/core/types';
import { Groups, QueryGroups } from '@/physics/groups';
import { chooseSkill, createCooldowns, skillTelegraph, startCooldown, tickCooldowns } from './brain';
import { angleInSweep, leapPosition, ramContact, stompDamage, tailRingHit } from './combat';
import { createDinoRig, createPose, type DinoAssets, type DinoRig } from './DinoModel';
import type { DinoAudio } from './dinoAudio';
import type { DinoSkill } from './events';
import { DINO } from './tunables';

export type DinoState = 'spawning' | 'guard' | 'chase' | 'telegraph' | 'execute' | 'recover' | 'stunned' | 'dead';

/** Shared decal geometry (telegraph discs and strips); materials are per dinosaur. */
export interface DinoDecals {
  disc: CircleGeometry;
  strip: PlaneGeometry;
}

export function createDecals(): DinoDecals {
  const disc = new CircleGeometry(1, 48);
  disc.rotateX(-Math.PI / 2);
  const strip = new PlaneGeometry(1, 1);
  strip.rotateX(-Math.PI / 2);
  strip.translate(0, 0, -0.5);
  return { disc, strip };
}

export interface DinoHooks {
  shake(amplitude: number, seconds: number, x: number, z: number): void;
  defeated(dino: Dinosaur): void;
}

const TAU = Math.PI * 2;
const dir = new Vector3();
const impulse = new Vector3();
const evPos = new Vector3();
const hitDir = new Vector3();

function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

let serial = 0;

/**
 * One mecha T-Rex (T-21). A Damageable on a kinematic Rapier body (hit volumes in Groups.enemy,
 * head = critical x2). Not registered in `ctx.enemies`, so the 30-robot totals never change.
 * The timeline rules (skill choice, damage falloff, hit tests) are pure and live in
 * brain.ts / combat.ts; this class glues them to the scene, physics and events.
 */
export class Dinosaur implements Damageable {
  readonly kind = 'enemy' as const;
  readonly id: string;
  readonly position = new Vector3();
  readonly maxHp: number = DINO.hp;
  hp: number = DINO.hp;
  yaw = 0;

  private state_: DinoState = 'spawning';
  private stateTime = 0;
  private time = 0;
  private readonly cooldowns = createCooldowns();
  private skill: DinoSkill | null = null;
  private skillLocked = false;
  private readonly lockDir = new Vector3();
  private readonly leapStart = new Vector3();
  private readonly leapTarget = new Vector3();
  private travelled = 0;
  private hitThisSkill = false;
  private spinStartYaw = 0;
  private spinPrev = 0;
  private stunDuration = 0;
  private walkAmount = 0;
  private deathTime = 0;
  private readonly rig: DinoRig;
  private readonly pose = createPose();
  private readonly body: RigidBody;
  private readonly colliders: Collider[] = [];
  private readonly discOuter: Mesh;
  private readonly discInner: Mesh;
  private readonly strip: Mesh;
  private readonly decalMats: MeshBasicMaterial[] = [];
  private released = false;
  readonly root = new Group();
  /** Test hook: never leave guard duty (no chase, no skills). */
  passive = false;
  readonly spot = new Vector3();

  constructor(
    private readonly ctx: GameContext,
    private readonly assets: DinoAssets,
    decals: DinoDecals,
    private readonly audio: DinoAudio,
    res: ResourceTracker,
    readonly towerId: number,
    spotX: number,
    spotZ: number,
    private readonly hooks: DinoHooks,
  ) {
    this.id = `dino-${++serial}`;
    this.spot.set(spotX, 0, spotZ);
    this.position.set(spotX, -DINO.heightM, spotZ);

    this.rig = createDinoRig(assets);
    this.root.add(this.rig.group);
    ctx.scene.add(this.root);
    res.track(this.root);
    res.track(this.rig.glowMaterial);

    const mk = (geo: BufferGeometry, color: number, opacity: number): Mesh => {
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      this.decalMats.push(mat);
      const m = new Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 2;
      m.frustumCulled = false;
      ctx.scene.add(m);
      res.track(m);
      return m;
    };
    this.discOuter = mk(decals.disc, 0xff3300, 0.22);
    this.discInner = mk(decals.disc, 0xff5500, 0.4);
    this.strip = mk(decals.strip, 0xff2200, 0.38);

    const R = ctx.physics.rapier;
    this.body = ctx.physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z),
    );
    this.buildColliders(R.ColliderDesc);
    this.syncPose();
    // face the tower's approach: towards the player at spawn
    this.yaw = Math.atan2(-(ctx.player.position.x - spotX), -(ctx.player.position.z - spotZ));
    this.syncPose();
  }

  // ---- Damageable --------------------------------------------------------------------------

  get alive(): boolean {
    return this.state_ !== 'dead' && this.hp > 0;
  }

  get state(): DinoState {
    return this.state_;
  }

  get currentSkill(): DinoSkill | null {
    return this.skill;
  }

  get drawCalls(): number {
    return this.rig.meshCount;
  }

  /** Remaining cooldowns, for tests. */
  get cooldownSnapshot(): { ram: number; leapStomp: number; tailSpin: number } {
    return { ...this.cooldowns };
  }

  applyDamage(info: DamageInfo): DamageResult {
    if (!this.alive) return { dealt: 0, zone: info.zone, killed: false, absorbed: true };
    const result = resolveDamage(this.hp, info, DEFAULT_ZONE_MULTIPLIERS);
    this.hp = result.hpAfter;
    if (result.killed) this.die();
    return { dealt: result.dealt, zone: result.zone, killed: result.killed, absorbed: result.absorbed };
  }

  // ---- hit volumes (model reference space -> game space) ---------------------------------

  private buildColliders(CD: typeof ColliderDesc): void {
    const s = this.assets.scale;
    const g = this.assets.groundOffset;
    const add = (zone: HitZone, rx: number, ry: number, rz: number, hx: number, hy: number, hz: number): void => {
      const desc = CD.cuboid(hx * s, hy * s, hz * s)
        .setTranslation(-rx * s, (ry + g) * s, -rz * s)
        .setCollisionGroups(Groups.enemy);
      this.colliders.push(
        this.ctx.physics.addCollider(desc, { kind: 'enemy', damageable: this, hitZone: zone, owner: this }, this.body),
      );
    };
    // hips + chest, neck, head and snout (critical), legs, three tail boxes
    add('body', 0, 1.2, 0, 0.65, 0.4, 0.6);
    add('body', 0, 1.75, 0.15, 0.5, 0.6, 0.7);
    add('body', 0, 2.65, 0.3, 0.38, 0.45, 0.4);
    add('critical', 0, 3.3, 0.3, 0.4, 0.4, 0.55);
    add('critical', 0, 3.2, 1.0, 0.33, 0.25, 0.43);
    add('body', -0.65, -0.05, 0.2, 0.32, 0.95, 0.4);
    add('body', 0.65, -0.05, 0.2, 0.32, 0.95, 0.4);
    add('body', 0, 1.3, -1.1, 0.3, 0.28, 0.9);
    add('body', 0, 1.3, -2.9, 0.25, 0.25, 0.9);
    add('body', 0, 1.3, -4.4, 0.2, 0.2, 0.7);
  }

  // ---- state helpers -----------------------------------------------------------------------

  private enter(state: DinoState): void {
    this.state_ = state;
    this.stateTime = 0;
  }

  private hdist(): number {
    const p = this.ctx.player.position;
    return Math.hypot(p.x - this.position.x, p.z - this.position.z);
  }

  private feetAbove(): number {
    return this.ctx.player.position.y - Math.max(0, this.position.y);
  }

  private bearingToPlayer(): number {
    const p = this.ctx.player.position;
    return Math.atan2(-(p.x - this.position.x), -(p.z - this.position.z));
  }

  private turnTowards(target: number, dt: number, rate: number): number {
    const diff = wrapPi(target - this.yaw);
    const maxTurn = rate * dt;
    this.yaw += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    return Math.abs(wrapPi(target - this.yaw));
  }

  private blocked(dx: number, dz: number, length: number): boolean {
    const phys = this.ctx.physics;
    dir.set(dx, 0, dz).normalize();
    for (const h of DINO.probeHeights) {
      const hit = phys.raycast({ x: this.position.x, y: this.position.y + h, z: this.position.z }, dir, length, {
        groups: QueryGroups.worldOnly,
      });
      if (hit) return true;
    }
    return false;
  }

  /** Walk towards a point with turning, wall probing, sea guard. Returns true when moving. */
  private walk(tx: number, tz: number, speed: number, dt: number): boolean {
    const target = Math.atan2(-(tx - this.position.x), -(tz - this.position.z));
    const off = this.turnTowards(target, dt, DINO.turnRate);
    if (off > 0.9) return false;
    let fx = -Math.sin(this.yaw);
    let fz = -Math.cos(this.yaw);
    const step = speed * dt;
    const look = DINO.bodyRadius + DINO.probeAhead + step;
    if (this.blocked(fx, fz, look)) {
      // try to slide around the obstacle
      let found = false;
      for (const a of [0.9, -0.9, 1.6, -1.6]) {
        const nx = -Math.sin(this.yaw + a);
        const nz = -Math.cos(this.yaw + a);
        if (!this.blocked(nx, nz, look)) {
          fx = nx;
          fz = nz;
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    const nx = this.position.x + fx * step;
    const nz = this.position.z + fz * step;
    if (!isOnLand(nx + fx * 6, nz + fz * 6)) return false;
    this.position.x = nx;
    this.position.z = nz;
    return true;
  }

  // ---- simulation --------------------------------------------------------------------------

  fixedUpdate(dt: number): void {
    if (this.state_ === 'dead') {
      this.deathTime += dt;
      return;
    }
    this.time += dt;
    this.stateTime += dt;
    tickCooldowns(this.cooldowns, dt);
    const player = this.ctx.player;
    const d = this.hdist();
    let walking = false;

    switch (this.state_) {
      case 'spawning': {
        const t = Math.min(1, this.stateTime / DINO.spawn.riseSeconds);
        const e = 1 - (1 - t) * (1 - t);
        this.position.y = -(1 - e) * DINO.heightM;
        this.pose.roar = t > 0.45 ? Math.min(1, (t - 0.45) * 3) * (1 - Math.max(0, t - 0.9) * 10) : 0;
        if (t >= 1) {
          this.position.y = 0;
          this.pose.roar = 0;
          this.enter('guard');
        }
        break;
      }
      case 'guard': {
        if (!this.passive && player.alive && d < DINO.aggroRange) {
          this.enter('chase');
          break;
        }
        const hs = Math.hypot(this.spot.x - this.position.x, this.spot.z - this.position.z);
        if (hs > 3) walking = this.walk(this.spot.x, this.spot.z, DINO.walkSpeed, dt);
        else this.turnTowards(this.yaw + Math.sin(this.time * 0.4) * 0.2, dt, 0.4);
        break;
      }
      case 'chase': {
        if (!player.alive || d > DINO.aggroRange * 1.4) {
          this.enter('guard');
          break;
        }
        const next = chooseSkill(d, this.cooldowns);
        if (next !== null && this.stateTime > 0.4) {
          this.beginSkill(next);
          break;
        }
        const hs = Math.hypot(this.position.x - this.spot.x, this.position.z - this.spot.z);
        const keepAway = DINO.bodyRadius + 2;
        if (d > keepAway && hs < DINO.leashRadius) {
          walking = this.walk(player.position.x, player.position.z, DINO.walkSpeed, dt);
        } else {
          this.turnTowards(this.bearingToPlayer(), dt, DINO.turnRate);
        }
        break;
      }
      case 'telegraph':
        this.updateTelegraph(dt);
        break;
      case 'execute':
        this.updateExecute(dt);
        break;
      case 'recover':
        this.turnTowards(this.bearingToPlayer(), dt, DINO.turnRate * 0.5);
        if (this.stateTime >= DINO.recover) this.enter('chase');
        break;
      case 'stunned':
        this.pose.crouch = 0.35;
        if (this.stateTime >= this.stunDuration) {
          this.pose.crouch = 0;
          this.enter('chase');
        }
        break;
    }

    this.walkAmount += ((walking ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 6);
    this.pose.walk = this.walkAmount;
    this.pose.walkPhase += dt * DINO.walkSpeed * 1.1 * (walking ? 1 : 0);
    this.syncPose();
  }

  private beginSkill(skill: DinoSkill): void {
    this.skill = skill;
    this.skillLocked = false;
    this.hitThisSkill = false;
    this.enter('telegraph');
    const duration = skillTelegraph(skill);
    const radius = skill === 'tailSpin' ? DINO.skills.tailSpin.radius : skill === 'leapStomp' ? DINO.skills.leapStomp.radius : DINO.skills.ram.stripWidth;
    this.ctx.events.emit('dino:telegraph', {
      id: this.id,
      skill,
      position: evPos.copy(this.position),
      radius,
      duration,
    });
    this.audio.warn(duration);
  }

  private updateTelegraph(dt: number): void {
    const skill = this.skill as DinoSkill;
    const T = skillTelegraph(skill);
    const t = Math.min(1, this.stateTime / T);
    const lockAt = skill === 'tailSpin' ? 1 : 0.55;
    if (!this.skillLocked) {
      // keep aiming until the lock point
      this.turnTowards(this.bearingToPlayer(), dt, DINO.turnRate * 2.5);
      if (t >= lockAt) {
        this.skillLocked = true;
        const p = this.ctx.player.position;
        if (skill === 'ram') {
          this.lockDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        } else if (skill === 'leapStomp') {
          this.leapTarget.set(p.x, 0, p.z);
          const lx = this.leapTarget.x - this.position.x;
          const lz = this.leapTarget.z - this.position.z;
          const ll = Math.hypot(lx, lz);
          const maxLeap = DINO.skills.leapStomp.max;
          if (ll > maxLeap) {
            this.leapTarget.x = this.position.x + (lx / ll) * maxLeap;
            this.leapTarget.z = this.position.z + (lz / ll) * maxLeap;
          }
          if (!isOnLand(this.leapTarget.x, this.leapTarget.z)) this.leapTarget.set(this.position.x, 0, this.position.z);
        }
      }
    }
    // pose + decals
    this.pose.glow = 1.5 + 3 * (0.5 + 0.5 * Math.sin(this.time * 22)) * t;
    this.pose.crouch = skill === 'leapStomp' ? t : 0;
    this.pose.tailWind = skill === 'tailSpin' ? -t * 1.2 : 0;
    this.showDecals(skill, t);
    if (this.stateTime >= T) this.beginExecute(skill);
  }

  private showDecals(skill: DinoSkill, t: number): void {
    const y = DINO.telegraphY;
    if (skill === 'tailSpin') {
      const r = DINO.skills.tailSpin.radius;
      this.discOuter.visible = true;
      this.discInner.visible = true;
      this.discOuter.position.set(this.position.x, y, this.position.z);
      this.discInner.position.copy(this.discOuter.position);
      this.discOuter.scale.setScalar(r);
      this.discInner.scale.setScalar(Math.max(0.01, r * t));
    } else if (skill === 'leapStomp') {
      const r = DINO.skills.leapStomp.radius;
      const tx = this.skillLocked ? this.leapTarget.x : this.ctx.player.position.x;
      const tz = this.skillLocked ? this.leapTarget.z : this.ctx.player.position.z;
      this.discOuter.visible = true;
      this.discInner.visible = true;
      this.discOuter.position.set(tx, y, tz);
      this.discInner.position.set(tx, y + 0.01, tz);
      this.discOuter.scale.setScalar(r);
      this.discInner.scale.setScalar(Math.max(0.01, r * t));
    } else {
      const s = DINO.skills.ram;
      const dx = this.skillLocked ? this.lockDir.x : -Math.sin(this.yaw);
      const dz = this.skillLocked ? this.lockDir.z : -Math.cos(this.yaw);
      this.strip.visible = true;
      this.strip.position.set(this.position.x, y, this.position.z);
      this.strip.rotation.y = Math.atan2(-dx, -dz);
      this.strip.scale.set(s.stripWidth, 1, s.maxDistance);
      // after the lock the strip pulses faster
      this.decalMats[2]!.opacity = 0.25 + 0.2 * Math.abs(Math.sin(this.time * (this.skillLocked ? 24 : 8)));
    }
  }

  private hideDecals(): void {
    this.discOuter.visible = false;
    this.discInner.visible = false;
    this.strip.visible = false;
  }

  private beginExecute(skill: DinoSkill): void {
    this.hideDecals();
    this.enter('execute');
    this.travelled = 0;
    this.pose.crouch = 0;
    const ctx = this.ctx;
    if (skill === 'leapStomp') {
      this.leapStart.copy(this.position);
      this.yaw = Math.atan2(-(this.leapTarget.x - this.position.x), -(this.leapTarget.z - this.position.z));
    } else if (skill === 'tailSpin') {
      this.spinStartYaw = this.yaw;
      this.spinPrev = 0;
    }
    ctx.events.emit('dino:attack', {
      id: this.id,
      skill,
      position: evPos.copy(this.position),
      radius: skill === 'tailSpin' ? DINO.skills.tailSpin.radius : skill === 'leapStomp' ? DINO.skills.leapStomp.radius : DINO.skills.ram.hitRadius,
    });
  }

  private updateExecute(dt: number): void {
    const skill = this.skill as DinoSkill;
    this.pose.glow = 3;
    if (skill === 'ram') this.updateRam(dt);
    else if (skill === 'leapStomp') this.updateLeap();
    else this.updateTailSpin();
  }

  private finishSkill(): void {
    const skill = this.skill as DinoSkill;
    startCooldown(this.cooldowns, skill);
    this.pose.glow = 1.5;
    this.pose.tailWind = 0;
    this.enter('recover');
  }

  private stun(seconds: number): void {
    this.stunDuration = seconds;
    this.pose.glow = 1.2;
    this.enter('stunned');
    this.ctx.events.emit('dino:stunned', { id: this.id, position: evPos.copy(this.position), duration: seconds });
  }

  private hurtPlayer(skill: DinoSkill, amount: number, fromX: number, fromZ: number, knock: number): void {
    const player = this.ctx.player;
    if (amount <= 0) return;
    const dx = player.position.x - fromX;
    const dz = player.position.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    hitDir.set(dx / l, 0, dz / l);
    const result = player.applyDamage({ amount, zone: 'body', source: 'enemy', direction: hitDir });
    impulse.set(hitDir.x * knock, 3, hitDir.z * knock);
    player.addImpulse(impulse);
    if (!result.absorbed) this.ctx.events.emit('dino:hitPlayer', { id: this.id, skill, damage: result.dealt });
  }

  private updateRam(dt: number): void {
    const s = DINO.skills.ram;
    const step = s.speed * dt;
    // wall ahead?
    if (this.blocked(this.lockDir.x, this.lockDir.z, DINO.bodyRadius + DINO.probeAhead + step)) {
      this.ctx.events.emit('vfx:spawn', { kind: 'big-explosion', position: evPos.set(this.position.x + this.lockDir.x * DINO.bodyRadius, 2, this.position.z + this.lockDir.z * DINO.bodyRadius), scale: 1.5 });
      this.hooks.shake(DINO.stompShake, 0.8, this.position.x, this.position.z);
      this.audio.thud();
      this.startCooldownOnly();
      this.stun(s.stun);
      return;
    }
    const nx = this.position.x + this.lockDir.x * step;
    const nz = this.position.z + this.lockDir.z * step;
    if (!isOnLand(nx + this.lockDir.x * 6, nz + this.lockDir.z * 6)) {
      this.finishSkill();
      return;
    }
    this.position.x = nx;
    this.position.z = nz;
    this.travelled += step;
    this.pose.walkPhase += dt * 14;
    this.pose.walk = 1;
    if (!this.hitThisSkill && this.ctx.player.alive && ramContact(this.hdist(), this.feetAbove())) {
      this.hitThisSkill = true;
      this.hurtPlayer('ram', s.damage, this.position.x - this.lockDir.x * 2, this.position.z - this.lockDir.z * 2, s.knockback);
    }
    if (this.travelled >= s.maxDistance) this.finishSkill();
  }

  private startCooldownOnly(): void {
    startCooldown(this.cooldowns, this.skill as DinoSkill);
  }

  private updateLeap(): void {
    const s = DINO.skills.leapStomp;
    const t = this.stateTime / s.airTime;
    const p = leapPosition(this.leapStart.x, this.leapStart.z, 0, this.leapTarget.x, this.leapTarget.z, t);
    this.position.set(p.x, p.y, p.z);
    this.pose.crouch = 0;
    if (t < 1) return;
    this.position.set(this.leapTarget.x, 0, this.leapTarget.z);
    // landing shockwave
    const ctx = this.ctx;
    if (ctx.player.alive && this.feetAbove() <= DINO.stompHeight) {
      const dmg = stompDamage(this.hdist());
      this.hurtPlayer('leapStomp', dmg, this.position.x, this.position.z, s.knockback);
    }
    ctx.events.emit('vfx:spawn', { kind: 'dust', position: evPos.set(this.position.x, 0.2, this.position.z), scale: 3 });
    ctx.events.emit('vfx:spawn', { kind: 'big-explosion', position: evPos.set(this.position.x, 0.5, this.position.z), scale: 1.4 });
    ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: evPos.set(this.position.x, 0.1, this.position.z), scale: s.radius });
    ctx.events.emit('dino:attack', { id: this.id, skill: 'leapStomp', position: evPos.set(this.position.x, 0, this.position.z), radius: s.radius });
    this.hooks.shake(DINO.stompShake, 0.9, this.position.x, this.position.z);
    this.audio.thud();
    this.startCooldownOnly();
    this.stun(s.stun);
  }

  private updateTailSpin(): void {
    const s = DINO.skills.tailSpin;
    const a = Math.min(TAU, (this.stateTime / s.spinSeconds) * TAU);
    this.yaw = this.spinStartYaw + a;
    if (!this.hitThisSkill && this.ctx.player.alive) {
      const rel = wrapTau(this.bearingToPlayer() - (this.spinStartYaw + Math.PI));
      if (
        tailRingHit(this.hdist(), this.feetAbove()) &&
        angleInSweep(this.spinPrev, a, rel, s.sweepHalfWidth)
      ) {
        this.hitThisSkill = true;
        this.hurtPlayer('tailSpin', s.damage, this.position.x, this.position.z, s.knockback);
        this.hooks.shake(DINO.stompShake * 0.6, 0.4, this.position.x, this.position.z);
      }
    }
    this.spinPrev = a;
    this.pose.tailWind = -1.2;
    if (a >= TAU) this.finishSkill();
  }

  // ---- presentation ------------------------------------------------------------------------

  /** Per-frame visuals (glow, roar pose). */
  animate(dt: number): void {
    if (this.state_ === 'dead') {
      this.updateDeath(dt);
      return;
    }
    this.pose.time = this.time;
    if (this.state_ === 'guard' || this.state_ === 'chase') this.pose.glow += (1.5 - this.pose.glow) * Math.min(1, dt * 5);
    this.rig.apply(this.pose);
    this.root.position.set(this.position.x, this.position.y, this.position.z);
    this.root.rotation.y = this.yaw;
  }

  private syncPose(): void {
    const t = { x: this.position.x, y: this.position.y, z: this.position.z };
    const r = { x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) };
    this.body.setTranslation(t, true);
    this.body.setRotation(r, true);
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(r);
    this.root.position.set(t.x, t.y, t.z);
    this.root.rotation.y = this.yaw;
  }

  // ---- death -------------------------------------------------------------------------------

  private die(): void {
    if (this.state_ === 'dead') return;
    this.state_ = 'dead';
    this.hp = 0;
    this.hideDecals();
    this.deathTime = 0;
    const ctx = this.ctx;
    // hit volumes go away at once
    if (!this.released) {
      this.released = true;
      ctx.physics.removeBody(this.body);
      this.colliders.length = 0;
    }
    for (let i = 0; i < 4; i++) {
      ctx.events.emit('vfx:spawn', {
        kind: i === 0 ? 'big-explosion' : 'explosion',
        position: evPos.set(this.position.x + (i - 1.5) * 1.8, 2 + i * 1.5, this.position.z + (i % 2 ? 1.5 : -1.5)),
        scale: 2,
      });
    }
    this.hooks.shake(DINO.stompShake, 1.2, this.position.x, this.position.z);
    this.audio.thud();
    ctx.events.emit('dino:defeated', { id: this.id, position: evPos.copy(this.position) });
    this.hooks.defeated(this);
  }

  private updateDeath(dt: number): void {
    const t = this.deathTime;
    // topple sideways and sink, then disappear
    const fall = Math.min(1, t / 1.4);
    this.root.rotation.z = fall * 1.35;
    this.root.position.set(this.position.x, this.position.y - Math.max(0, t - 3) * 2, this.position.z);
    this.rig.glowMaterial.emissiveIntensity = Math.max(0, 3 - t);
    this.root.visible = t < 7;
    void dt;
  }

  get removable(): boolean {
    return this.state_ === 'dead' && this.deathTime > 7;
  }

  /** Respawn / restart: forget the fight and return to guard duty (HP is kept). */
  resetToGuard(): void {
    if (this.state_ === 'dead' || this.state_ === 'spawning') return;
    this.hideDecals();
    this.pose.crouch = 0;
    this.pose.tailWind = 0;
    this.pose.glow = 1.5;
    this.position.y = 0;
    this.skill = null;
    this.enter('guard');
  }

  /** Test hook: start a skill right now, whatever the distance. */
  forceSkill(skill: DinoSkill): boolean {
    if (this.state_ !== 'guard' && this.state_ !== 'chase' && this.state_ !== 'recover') return false;
    this.position.y = 0;
    this.beginSkill(skill);
    return true;
  }

  dispose(): void {
    this.hideDecals();
    if (!this.released) {
      this.released = true;
      this.ctx.physics.removeBody(this.body);
      this.colliders.length = 0;
    }
    this.root.removeFromParent();
    this.discOuter.removeFromParent();
    this.discInner.removeFromParent();
    this.strip.removeFromParent();
    for (const m of this.decalMats) m.dispose();
    this.rig.dispose();
  }
}

function wrapTau(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}
