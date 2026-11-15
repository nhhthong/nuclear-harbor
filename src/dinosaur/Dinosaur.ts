import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
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
  /** Quarter ring behind the tail, in the dinosaur's local frame. */
  arc: RingGeometry;
  dispose(): void;
}

const DECAL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vLocal;
void main() {
  vUv = uv;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// mode 0: danger disc (rim, rotating dashes, fill growing with uFill, pulse rings)
// mode 1: charge lane (edges, chevrons running forward, fill growing along the lane)
// mode 2: tail trail (bright at the tail, fading backwards along the arc)
const DECAL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFill;
uniform float uTime;
uniform float uAlpha;
uniform int uMode;
varying vec2 vUv;
varying vec3 vLocal;
void main() {
  float a = 0.0;
  float hot = 0.0;
  if (uMode == 0) {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float ang = atan(c.y, c.x);
    float rim = smoothstep(0.93, 0.965, r) * smoothstep(1.0, 0.985, r);
    float dash = step(0.5, fract(ang * 3.8197 + uTime * 0.6)) * smoothstep(0.80, 0.83, r) * smoothstep(0.90, 0.87, r);
    float f = max(uFill, 0.02);
    float fill = (1.0 - smoothstep(f - 0.02, f, r)) * (0.06 + 0.12 * r);
    float edge = smoothstep(f - 0.07, f, r) * (1.0 - smoothstep(f, f + 0.012, r));
    float pulse = pow(0.5 + 0.5 * sin(r * 26.0 - uTime * 9.0), 6.0) * 0.08 * (1.0 - smoothstep(0.0, f, r));
    hot = rim + edge;
    a = rim + dash * 0.55 + fill + edge * 0.9 + pulse;
  } else if (uMode == 1) {
    float x = abs(vUv.x - 0.5) * 2.0;
    float along = 1.0 - vUv.y;
    float edge = smoothstep(0.9, 0.95, x);
    float chev = step(0.55, fract(along * 9.0 - x * 0.9 - uTime * 2.4)) * (1.0 - edge);
    float fill = step(along, uFill) * 0.2;
    float fade = smoothstep(1.0, 0.75, along) * smoothstep(0.0, 0.04, along);
    hot = edge;
    a = (edge + chev * 0.32 + fill) * fade;
  } else {
    float r = length(vLocal.xz);
    float ang = atan(-vLocal.x, max(vLocal.z, 1e-4));
    float tail = 1.0 - clamp(ang / 1.5708, 0.0, 1.0);
    float band = smoothstep(0.5, 0.72, r) * smoothstep(1.0, 0.9, r);
    hot = pow(tail, 3.0) * band;
    a = band * tail * tail;
  }
  a *= uAlpha;
  gl_FragColor = vec4(uColor * (1.0 + hot * 2.5) * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function decalMaterial(mode: number, color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uFill: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uMode: { value: mode } },
    vertexShader: DECAL_VERTEX,
    fragmentShader: DECAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
  });
}

export function createDecals(): DinoDecals {
  const disc = new CircleGeometry(1, 48);
  disc.rotateX(-Math.PI / 2);
  const strip = new PlaneGeometry(1, 1);
  strip.rotateX(-Math.PI / 2);
  strip.translate(0, 0, -0.5);
  const arc = new RingGeometry(0.5, 1, 40, 1, Math.PI, Math.PI / 2);
  arc.rotateX(-Math.PI / 2);
  return {
    disc,
    strip,
    arc,
    dispose() {
      disc.dispose();
      strip.dispose();
      arc.dispose();
    },
  };
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
  private deathStage = 0;
  private readonly rig: DinoRig;
  private readonly pose = createPose();
  private readonly body: RigidBody;
  private readonly colliders: Collider[] = [];
  private readonly disc: Mesh;
  private readonly strip: Mesh;
  private readonly arc: Mesh;
  private readonly discMat: ShaderMaterial;
  private readonly stripMat: ShaderMaterial;
  private readonly arcMat: ShaderMaterial;
  private fxTimer = 0;
  private hurtFlash = 0;
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

    const mk = (geo: BufferGeometry, mat: ShaderMaterial, parent: Group | null): Mesh => {
      const m = new Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 4;
      m.frustumCulled = false;
      m.userData.noReflect = true;
      (parent ?? ctx.scene).add(m);
      res.track(m);
      return m;
    };
    this.discMat = decalMaterial(0, 0xff4310);
    this.stripMat = decalMaterial(1, 0xff3a0c);
    this.arcMat = decalMaterial(2, 0xff7a22);
    this.disc = mk(decals.disc, this.discMat, null);
    this.strip = mk(decals.strip, this.stripMat, null);
    // the tail trail turns with the body
    this.arc = mk(decals.arc, this.arcMat, this.root);
    this.arc.position.y = DINO.heightM * 0.3;
    this.arc.scale.setScalar(DINO.skills.tailSpin.radius);

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
    if (result.dealt > 0) this.hurtFlash = 1;
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

  get enraged(): boolean {
    return this.hp <= this.maxHp * DINO.enrageFraction;
  }

  private fx(kind: 'dust' | 'spark' | 'armor-spark' | 'smoke' | 'explosion' | 'big-explosion', x: number, y: number, z: number, scale: number): void {
    this.ctx.events.emit('vfx:spawn', { kind, position: evPos.set(x, y, z), scale });
  }

  private ringFx(x: number, z: number, radius: number, duration: number): void {
    this.ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: evPos.set(x, 0.12, z), scale: radius, duration });
  }

  /** True every `interval` seconds while called each step. */
  private every(dt: number, interval: number): boolean {
    this.fxTimer -= dt;
    if (this.fxTimer > 0) return false;
    this.fxTimer = interval;
    return true;
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
    if (!isOnLand(nx + fx * DINO.edgeMargin, nz + fz * DINO.edgeMargin)) return false;
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
        this.pose.pitch = -0.28 * this.pose.roar;
        this.pose.tailLash = 1 + 2 * this.pose.roar;
        // the ground breaks open around it while it rises
        if (t < 0.7 && this.every(dt, 0.14)) {
          const a = this.time * 7.3;
          this.fx('dust', this.position.x + Math.cos(a) * DINO.bodyRadius, 0.2, this.position.z + Math.sin(a) * DINO.bodyRadius, 2.2);
          this.fx('spark', this.position.x - Math.cos(a) * 1.2, 0.3, this.position.z - Math.sin(a) * 1.2, 1.5);
        }
        if (t >= 1) {
          this.position.y = 0;
          this.pose.roar = 0;
          this.pose.pitch = 0;
          this.ringFx(this.position.x, this.position.z, 9, 0.6);
          this.fx('dust', this.position.x, 0.2, this.position.z, 4);
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
        // snapping jaws while it hunts
        this.pose.roar = Math.max(0, Math.sin(this.time * 2.6)) ** 6 * 0.45;
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
        this.pose.pitch *= 1 - Math.min(1, dt * 6);
        this.pose.legTuck = 0;
        if (this.stateTime >= (this.enraged ? DINO.enragedRecover : DINO.recover)) this.enter('chase');
        break;
      case 'stunned':
        this.pose.crouch = 0.35;
        this.pose.pitch += (0.3 - this.pose.pitch) * Math.min(1, dt * 5);
        this.pose.roar = 0.25;
        this.pose.flicker = 0.8;
        // shorted systems: sparks and smoke from the head
        if (this.every(dt, 0.22)) {
          const hx = this.position.x - Math.sin(this.yaw) * DINO.bodyRadius * 0.9;
          const hz = this.position.z - Math.cos(this.yaw) * DINO.bodyRadius * 0.9;
          this.fx('armor-spark', hx, DINO.heightM * 0.55, hz, 1.2);
          this.fx('smoke', hx, DINO.heightM * 0.6, hz, 0.8);
        }
        if (this.stateTime >= this.stunDuration) {
          this.pose.crouch = 0;
          this.pose.flicker = 0;
          this.pose.roar = 0;
          this.enter('chase');
        }
        break;
    }

    // enraged: lashing tail and smoke from the back
    if (this.state_ !== 'spawning' && this.state_ !== 'stunned') {
      this.pose.tailLash += ((this.enraged ? 2.6 : 1) - this.pose.tailLash) * Math.min(1, dt * 3);
      if (this.enraged && Math.floor(this.time * 2.5) !== Math.floor((this.time - dt) * 2.5)) {
        this.fx('smoke', this.position.x, DINO.heightM * 0.55, this.position.z, 0.9);
      }
    }
    if (this.state_ === 'telegraph' || (this.state_ === 'execute' && this.skill === 'ram')) {
      // pose.walk is driven by the skill
    } else {
      this.walkAmount += ((walking ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 6);
      this.pose.walk = this.walkAmount;
    }
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
    if (skill === 'ram') {
      // head down, one foot scraping the ground, jaws opening
      this.pose.pitch = 0.3 * t;
      this.pose.walk = 0.45;
      this.pose.walkPhase += dt * 11;
      this.pose.roar = 0.6 * t;
      if (this.every(dt, 0.16)) {
        this.fx('dust', this.position.x + Math.sin(this.yaw) * 1.2, 0.15, this.position.z + Math.cos(this.yaw) * 1.2, 1.4);
        this.fx('spark', this.position.x + Math.sin(this.yaw) * 0.8, 0.15, this.position.z + Math.cos(this.yaw) * 0.8, 0.8);
      }
    } else if (skill === 'leapStomp') {
      this.pose.pitch = 0.16 * t;
      this.pose.roar = 0.3 * t;
      this.pose.walk = 0;
    } else {
      this.pose.pitch = 0.1 * t;
      this.pose.walk = 0;
    }
    this.showDecals(skill, t);
    if (this.stateTime >= T) this.beginExecute(skill);
  }

  private showDecals(skill: DinoSkill, t: number): void {
    const y = DINO.telegraphY;
    if (skill === 'ram') {
      const s = DINO.skills.ram;
      const dx = this.skillLocked ? this.lockDir.x : -Math.sin(this.yaw);
      const dz = this.skillLocked ? this.lockDir.z : -Math.cos(this.yaw);
      this.strip.visible = true;
      this.strip.position.set(this.position.x, y, this.position.z);
      this.strip.rotation.y = Math.atan2(-dx, -dz);
      this.strip.scale.set(s.stripWidth, 1, s.maxDistance);
      const u = this.stripMat.uniforms;
      (u.uFill as { value: number }).value = t;
      (u.uTime as { value: number }).value = this.time * (this.skillLocked ? 2.2 : 1);
      // after the lock the lane flashes
      (u.uAlpha as { value: number }).value = this.skillLocked ? 0.75 + 0.25 * Math.sin(this.time * 30) : 0.7;
      return;
    }
    const r = skill === 'tailSpin' ? DINO.skills.tailSpin.radius : DINO.skills.leapStomp.radius;
    const onSelf = skill === 'tailSpin';
    const tx = onSelf ? this.position.x : this.skillLocked ? this.leapTarget.x : this.ctx.player.position.x;
    const tz = onSelf ? this.position.z : this.skillLocked ? this.leapTarget.z : this.ctx.player.position.z;
    this.disc.visible = true;
    this.disc.position.set(tx, y, tz);
    this.disc.scale.setScalar(r);
    const u = this.discMat.uniforms;
    (u.uFill as { value: number }).value = t;
    (u.uTime as { value: number }).value = this.time;
    (u.uAlpha as { value: number }).value = 0.85;
  }

  private hideDecals(): void {
    this.disc.visible = false;
    this.strip.visible = false;
    this.arc.visible = false;
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
      // take-off blast; the landing zone stays marked while it is in the air
      this.fx('dust', this.position.x, 0.2, this.position.z, 3);
      this.ringFx(this.position.x, this.position.z, 4, 0.35);
      this.disc.visible = true;
      (this.discMat.uniforms.uFill as { value: number }).value = 1;
      this.audio.roar();
    } else if (skill === 'tailSpin') {
      this.spinStartYaw = this.yaw;
      this.spinPrev = 0;
      this.arc.visible = true;
    } else {
      this.audio.roar();
      this.ringFx(this.position.x, this.position.z, 3.5, 0.3);
    }
    this.fxTimer = 0;
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
    this.pose.roar = 0;
    this.pose.legTuck = 0;
    this.hideDecals();
    this.enter('recover');
  }

  private stun(seconds: number): void {
    this.stunDuration = seconds;
    this.pose.glow = 1.2;
    this.pose.legTuck = 0;
    this.pose.tailWind = 0;
    this.hideDecals();
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
      const wx = this.position.x + this.lockDir.x * DINO.bodyRadius;
      const wz = this.position.z + this.lockDir.z * DINO.bodyRadius;
      this.fx('armor-spark', wx, 1.5, wz, 3);
      this.fx('dust', wx, 0.3, wz, 3.5);
      this.ringFx(wx, wz, 6, 0.45);
      this.hooks.shake(DINO.stompShake, 0.8, this.position.x, this.position.z);
      this.audio.thud();
      this.startCooldownOnly();
      this.stun(s.stun);
      return;
    }
    const nx = this.position.x + this.lockDir.x * step;
    const nz = this.position.z + this.lockDir.z * step;
    if (!isOnLand(nx + this.lockDir.x * DINO.edgeMargin, nz + this.lockDir.z * DINO.edgeMargin)) {
      this.finishSkill();
      return;
    }
    this.position.x = nx;
    this.position.z = nz;
    this.travelled += step;
    this.pose.walkPhase += dt * 15;
    this.pose.walk = 1;
    this.pose.pitch = 0.34;
    this.pose.roar = 0.75;
    this.pose.tailLash = 3;
    // tearing up the ground behind it
    if (this.every(dt, 0.07)) {
      const side = Math.sin(this.pose.walkPhase) > 0 ? 1 : -1;
      const fx = this.position.x - this.lockDir.x * 1.2 + this.lockDir.z * side * 0.9;
      const fz = this.position.z - this.lockDir.z * 1.2 - this.lockDir.x * side * 0.9;
      this.fx('dust', fx, 0.15, fz, 1.8);
      this.fx('spark', fx, 0.12, fz, 1.1);
    }
    if (!this.hitThisSkill && this.ctx.player.alive && ramContact(this.hdist(), this.feetAbove())) {
      this.hitThisSkill = true;
      this.hurtPlayer('ram', s.damage, this.position.x - this.lockDir.x * 2, this.position.z - this.lockDir.z * 2, s.knockback);
      const pp = this.ctx.player.position;
      this.fx('armor-spark', pp.x, pp.y + 1, pp.z, 2);
      this.hooks.shake(DINO.stompShake * 0.7, 0.4, this.position.x, this.position.z);
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
    // rear up on the way up, legs tucked, then dive with open jaws
    const tc = Math.min(1, t);
    this.pose.pitch = -0.3 + 0.62 * tc * tc;
    this.pose.legTuck = Math.sin(Math.PI * Math.min(1, tc * 1.15));
    this.pose.roar = 0.9;
    (this.discMat.uniforms.uTime as { value: number }).value = this.time * 2.5;
    (this.discMat.uniforms.uAlpha as { value: number }).value = 0.7 + 0.3 * Math.sin(this.time * 34);
    if (t < 1) return;
    this.pose.legTuck = 0;
    this.pose.pitch = 0.2;
    this.hideDecals();
    this.position.set(this.leapTarget.x, 0, this.leapTarget.z);
    // landing shockwave
    const ctx = this.ctx;
    if (ctx.player.alive && this.feetAbove() <= DINO.stompHeight) {
      const dmg = stompDamage(this.hdist());
      this.hurtPlayer('leapStomp', dmg, this.position.x, this.position.z, s.knockback);
    }
    ctx.events.emit('vfx:spawn', { kind: 'dust', position: evPos.set(this.position.x, 0.2, this.position.z), scale: 3 });
    ctx.events.emit('vfx:spawn', { kind: 'big-explosion', position: evPos.set(this.position.x, 0.5, this.position.z), scale: 1.4 });
    this.ringFx(this.position.x, this.position.z, s.radius, 0.45);
    this.ringFx(this.position.x, this.position.z, s.radius * 0.55, 0.3);
    // debris thrown outwards around the crater
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + this.yaw;
      this.fx('dust', this.position.x + Math.cos(a) * s.radius * 0.55, 0.2, this.position.z + Math.sin(a) * s.radius * 0.55, 2.2);
      if (i % 2 === 0) this.fx('spark', this.position.x + Math.cos(a) * s.radius * 0.35, 0.2, this.position.z + Math.sin(a) * s.radius * 0.35, 2);
    }
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
    this.pose.pitch = 0.14;
    this.pose.tailLash = 0.3;
    const k = a / TAU;
    (this.arcMat.uniforms.uAlpha as { value: number }).value = Math.min(1, k * 5) * (1 - Math.max(0, k - 0.8) * 5);
    // the tail club drags sparks along the ground
    if (this.every(0.016, 0.05)) {
      const r = s.radius * 0.85;
      this.fx('spark', this.position.x + Math.sin(this.yaw) * r, 0.25, this.position.z + Math.cos(this.yaw) * r, 1.3);
      this.fx('dust', this.position.x + Math.sin(this.yaw) * r, 0.2, this.position.z + Math.cos(this.yaw) * r, 1.2);
    }
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
    const baseGlow = this.enraged ? 3.2 + Math.sin(this.time * 9) * 0.8 : 1.5;
    if (this.state_ === 'guard' || this.state_ === 'chase') {
      this.pose.glow += (baseGlow - this.pose.glow) * Math.min(1, dt * 5);
      this.pose.pitch *= 1 - Math.min(1, dt * 4);
    }
    // hits make the glow stutter for a moment
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    if (this.state_ !== 'stunned') this.pose.flicker = this.hurtFlash * 0.7;
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
    this.fx('explosion', this.position.x, DINO.heightM * 0.5, this.position.z, 1.6);
    this.deathStage = 0;
    this.hooks.shake(DINO.stompShake, 1.2, this.position.x, this.position.z);
    this.audio.thud();
    ctx.events.emit('dino:defeated', { id: this.id, position: evPos.copy(this.position) });
    this.hooks.defeated(this);
  }

  private updateDeath(dt: number): void {
    const t = this.deathTime;
    // topple sideways and sink, then disappear
    // staggers with systems failing (chain of blasts), topples, final detonation when it hits the ground
    const stages = 5;
    while (this.deathStage < stages && t >= 0.25 + this.deathStage * 0.3) {
      const i = this.deathStage++;
      const a = i * 2.4;
      this.fx('explosion', this.position.x + Math.cos(a) * 1.4, DINO.heightM * (0.25 + 0.12 * i), this.position.z + Math.sin(a) * 1.4, 1.3);
      this.fx('armor-spark', this.position.x - Math.cos(a), DINO.heightM * 0.5, this.position.z - Math.sin(a), 2.5);
    }
    const fall = Math.max(0, Math.min(1, (t - 0.9) / 1.1));
    const eased = fall * fall;
    this.root.rotation.z = eased * 1.4 + Math.sin(t * 38) * 0.03 * (1 - fall);
    if (this.deathStage === stages && fall >= 1) {
      this.deathStage++;
      this.fx('big-explosion', this.position.x, 1.2, this.position.z, 1.6);
      this.ringFx(this.position.x, this.position.z, 10, 0.6);
      this.fx('dust', this.position.x, 0.2, this.position.z, 5);
      this.hooks.shake(DINO.stompShake, 1.0, this.position.x, this.position.z);
      this.audio.thud();
    }
    this.pose.time = this.time + t;
    this.pose.roar = 1 - eased;
    this.pose.flicker = 1;
    this.pose.glow = Math.max(0, 3.5 - t * 1.2);
    this.pose.pitch = 0.2 * eased;
    this.pose.tailLash = 3 * (1 - eased);
    this.rig.apply(this.pose);
    this.root.position.set(this.position.x, this.position.y - Math.max(0, t - 4.5) * 1.6, this.position.z);
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
    this.pose.pitch = 0;
    this.pose.legTuck = 0;
    this.pose.roar = 0;
    this.pose.flicker = 0;
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
    this.disc.removeFromParent();
    this.strip.removeFromParent();
    this.arc.removeFromParent();
    this.discMat.dispose();
    this.stripMat.dispose();
    this.arcMat.dispose();
    this.rig.dispose();
  }
}

function wrapTau(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}
