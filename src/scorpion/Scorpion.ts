import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  SphereGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Collider, ColliderDesc, RigidBody } from '@dimforge/rapier3d-compat';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { DEFAULT_ZONE_MULTIPLIERS, resolveDamage } from '@/combat/damage';
import { isOnLand } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { Damageable, DamageInfo, DamageResult } from '@/core/types';
import { Groups, QueryGroups } from '@/physics/groups';
import { chooseSkill, createCooldowns, skillTelegraph, startCooldown, tickCooldowns } from './brain';
import { arcPosition, fanHit, inPool, ramContact, shieldedDamage, venomBurstDamage } from './combat';
import { createPose, type ScorpionAssets, type ScorpionRig } from './ScorpionModel';
import type { ScorpionAudio } from './scorpionAudio';
import type { ScorpionSkill } from './events';
import { SCORPION } from './tunables';
import { isBoxedIn, pickEscapeHeading, StuckTracker } from './unstuck';

export type ScorpionState = 'spawning' | 'guard' | 'chase' | 'telegraph' | 'execute' | 'recover' | 'shield' | 'stunned' | 'dead';

/** Shared decal geometry (telegraph discs and strips); materials are per scorpion. */
export interface ScorpionDecals {
  disc: CircleGeometry;
  strip: PlaneGeometry;
  /** Venom glob. */
  glob: SphereGeometry;
  /** Curved shell in front of the body that carries the hex shield. */
  shield: SphereGeometry;
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
// mode 2: fan in front of the body (uHalf = half opening angle), fill growing outwards
// mode 3: venom pool (bubbling surface, bright rim)
const DECAL_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFill;
uniform float uTime;
uniform float uAlpha;
uniform float uHalf;
uniform int uMode;
varying vec2 vUv;
varying vec3 vLocal;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float a = 0.0;
  float hot = 0.0;
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float f = max(uFill, 0.02);
  if (uMode == 0) {
    float ang = atan(c.y, c.x);
    float rim = smoothstep(0.93, 0.965, r) * smoothstep(1.0, 0.985, r);
    float dash = step(0.5, fract(ang * 3.8197 + uTime * 0.6)) * smoothstep(0.80, 0.83, r) * smoothstep(0.90, 0.87, r);
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
  } else if (uMode == 2) {
    // forward is +v of the disc
    float ang = abs(atan(c.x, max(c.y, 1e-4)));
    float front = step(0.0, c.y);
    float inside = (1.0 - smoothstep(uHalf - 0.03, uHalf, ang)) * front * (1.0 - smoothstep(0.985, 1.0, r));
    float side = smoothstep(uHalf - 0.07, uHalf - 0.03, ang) * inside;
    float rim = smoothstep(0.94, 0.97, r) * inside;
    float arcs = step(0.6, fract(r * 5.0 - uTime * 1.6)) * 0.22 * inside * (1.0 - smoothstep(0.0, f, r) * 0.0);
    float fill = (1.0 - smoothstep(f - 0.03, f, r)) * 0.2 * inside;
    float edge = smoothstep(f - 0.06, f, r) * (1.0 - smoothstep(f, f + 0.015, r)) * inside;
    hot = side + rim + edge;
    a = side + rim + arcs + fill + edge;
  } else {
    vec2 p = c * 9.0;
    float cells = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 q = p * (1.0 + float(i) * 0.7) + vec2(uTime * (0.3 + float(i) * 0.2), -uTime * 0.25);
      vec2 g = fract(q) - 0.5;
      float rr = 0.18 + 0.2 * h21(floor(q));
      cells += (1.0 - smoothstep(rr - 0.08, rr, length(g))) * (0.5 + 0.5 * sin(uTime * 5.0 + h21(floor(q)) * 6.28));
    }
    float body = 1.0 - smoothstep(0.86, 1.0, r + 0.05 * sin(atan(c.y, c.x) * 7.0 + uTime * 2.0));
    float rim = smoothstep(0.7, 0.92, r) * body;
    hot = cells * 0.5 + rim * 0.6;
    a = body * (0.14 + 0.26 * cells) + rim * 0.4;
  }
  a *= uAlpha;
  gl_FragColor = vec4(uColor * (1.0 + hot * 2.5) * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;


// Hexagonal energy shield: honeycomb cells that switch on from the centre outwards (uOpen), a scan
// line, bright cell edges and a flash where damage was absorbed (uHit).
const SHIELD_FRAGMENT = /* glsl */ `
uniform float uOpen;
uniform float uHit;
uniform float uTime;
varying vec2 vUv;
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, vec2(0.5, 0.8660254)), p.x);
}
void main() {
  vec2 uv = (vUv - 0.5) * vec2(15.0, 9.0);
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = uv - g;
  float d = hexDist(g);
  float edge = smoothstep(0.40, 0.48, d);
  // cells appear from the centre; each one flickers on its own clock
  float dist = length(id / vec2(7.5, 4.5));
  float on = smoothstep(dist - 0.12, dist + 0.02, uOpen * 1.25);
  float rnd = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
  float flick = 0.75 + 0.25 * sin(uTime * (3.0 + rnd * 6.0) + rnd * 6.28);
  float scan = pow(0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 3.5), 12.0);
  float border = smoothstep(0.78, 1.0, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0);
  float core = (1.0 - smoothstep(0.0, 0.42, d)) * 0.06;
  float alpha = on * flick * (edge * 0.85 + core + 0.07 + scan * 0.18 + uHit * (0.35 + rnd * 0.4)) * (1.0 - border * 0.75);
  vec3 col = mix(vec3(0.12, 1.0, 0.32), vec3(0.75, 1.0, 0.8), edge * 0.6 + uHit * 0.5);
  gl_FragColor = vec4(col * alpha * (1.6 + edge * 1.6 + uHit * 2.5), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function decalMaterial(mode: number, color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uFill: { value: 0 },
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uHalf: { value: SCORPION.skills.tailSlam.halfAngle },
      uMode: { value: mode },
    },
    vertexShader: DECAL_VERTEX,
    fragmentShader: DECAL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
  });
}

export function createDecals(): ScorpionDecals {
  const disc = new CircleGeometry(1, 48);
  disc.rotateX(-Math.PI / 2);
  const strip = new PlaneGeometry(1, 1);
  strip.rotateX(-Math.PI / 2);
  strip.translate(0, 0, -0.5);
  const glob = new SphereGeometry(0.34, 12, 10);
  // part of a sphere centred on -Z (the scorpion's forward axis)
  const shield = new SphereGeometry(1, 28, 14, Math.PI * 1.5 - 1.15, 2.3, 0.45, 1.2);
  return {
    disc,
    strip,
    glob,
    shield,
    dispose() {
      disc.dispose();
      strip.dispose();
      glob.dispose();
      shield.dispose();
    },
  };
}

export interface ScorpionHooks {
  shake(amplitude: number, seconds: number, x: number, z: number): void;
  defeated(scorpion: Scorpion): void;
}

const dir = new Vector3();
const impulse = new Vector3();
const evPos = new Vector3();
const hitDir = new Vector3();
const tip = new Vector3();

function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

let serial = 0;

interface Blast {
  t: number;
  x: number;
  z: number;
  scale: number;
}

/**
 * The mecha scorpion that guards the relay tower. A Damageable on a kinematic Rapier body (hit volumes
 * in Groups.enemy; head sensors and the stinger bulb are critical). Not registered in `ctx.enemies`.
 * Skills: charge (throws the player back), venom shot (green glob, burst and a lingering pool) and tail
 * slam (fan of blasts in front). Choice, ranges and hit tests are pure and live in brain.ts / combat.ts.
 */
export class Scorpion implements Damageable {
  readonly kind = 'enemy' as const;
  readonly id: string;
  readonly position = new Vector3();
  readonly maxHp: number = SCORPION.hp;
  hp: number = SCORPION.hp;
  yaw = 0;

  private state_: ScorpionState = 'spawning';
  private stateTime = 0;
  private time = 0;
  private readonly cooldowns = createCooldowns();
  private skill: ScorpionSkill | null = null;
  private skillLocked = false;
  private readonly lockDir = new Vector3();
  private readonly target = new Vector3();
  private travelled = 0;
  private hitThisSkill = false;
  private fired = false;
  private stunDuration = 0;
  private walkAmount = 0;
  private deathTime = 0;
  private deathStage = 0;
  private readonly rig: ScorpionRig;
  private readonly pose = createPose();
  private readonly body: RigidBody;
  private readonly colliders: Collider[] = [];
  private readonly disc: Mesh;
  private readonly strip: Mesh;
  private readonly fan: Mesh;
  private readonly pool: Mesh;
  private readonly glob: Mesh;
  private readonly discMat: ShaderMaterial;
  private readonly stripMat: ShaderMaterial;
  private readonly fanMat: ShaderMaterial;
  private readonly poolMat: ShaderMaterial;
  private readonly globMat: MeshBasicMaterial;
  private readonly shield: Mesh;
  private readonly shieldMat: ShaderMaterial;
  private shieldOpen = 0;
  private shieldHit = 0;
  private guardCooldown = 0;
  private recentDamage = 0;
  // venom glob in flight and the pool it leaves; both outlive the skill state
  private globT = -1;
  private readonly globFrom = new Vector3();
  private readonly globTo = new Vector3();
  private poolLeft = 0;
  private poolTick = 0;
  private readonly blasts: Blast[] = [];
  private blastClock = 0;
  private fxTimer = 0;
  private hurtFlash = 0;
  private released = false;
  readonly root = new Group();
  /** Test hook: never leave guard duty (no chase, no skills). */
  passive = false;
  readonly spot = new Vector3();
  // ---- spec 33: getting out of a wedge ----
  private readonly stuck = new StuckTracker(SCORPION.stuck.window, SCORPION.stuck.minMove);
  private walkWanted = false;
  private escapeLeft = 0;
  private escapeYaw = 0;
  private sinceEscape = Infinity;
  /** Times it got out (crawl or relocation), for tests and the debug overlay. */
  unstuckCount = 0;

  constructor(
    private readonly ctx: GameContext,
    private readonly assets: ScorpionAssets,
    decals: ScorpionDecals,
    private readonly audio: ScorpionAudio,
    res: ResourceTracker,
    readonly towerId: number,
    spotX: number,
    spotZ: number,
    private readonly hooks: ScorpionHooks,
  ) {
    this.id = `scorpion-${++serial}`;
    this.spot.set(spotX, 0, spotZ);
    this.position.set(spotX, -SCORPION.heightM, spotZ);

    this.rig = assets.makeRig();
    this.root.add(this.rig.group);
    ctx.scene.add(this.root);
    res.track(this.root);
    res.track(this.rig.glowMaterial);

    const mk = (geo: BufferGeometry, mat: ShaderMaterial | MeshBasicMaterial): Mesh => {
      const m = new Mesh(geo, mat);
      m.visible = false;
      m.renderOrder = 4;
      m.frustumCulled = false;
      m.userData.noReflect = true;
      ctx.scene.add(m);
      res.track(m);
      return m;
    };
    this.discMat = decalMaterial(0, 0x3dff4e);
    this.stripMat = decalMaterial(1, 0xff3a0c);
    this.fanMat = decalMaterial(2, 0xff5a14);
    this.poolMat = decalMaterial(3, 0x2bff3e);
    this.globMat = new MeshBasicMaterial({ color: 0xffffff });
    this.globMat.color.setRGB(0.9, 5, 1.1);
    this.disc = mk(decals.disc, this.discMat);
    this.strip = mk(decals.strip, this.stripMat);
    this.fan = mk(decals.disc, this.fanMat);
    this.pool = mk(decals.disc, this.poolMat);
    this.pool.renderOrder = 3;
    this.glob = mk(decals.glob, this.globMat);
    this.shieldMat = new ShaderMaterial({
      uniforms: { uOpen: { value: 0 }, uHit: { value: 0 }, uTime: { value: 0 } },
      vertexShader: DECAL_VERTEX,
      fragmentShader: SHIELD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      fog: false,
    });
    this.shield = new Mesh(decals.shield, this.shieldMat);
    this.shield.visible = false;
    this.shield.renderOrder = 5;
    this.shield.frustumCulled = false;
    this.shield.userData.noReflect = true;
    this.shield.position.set(0, SCORPION.heightM * 0.2, -SCORPION.bodyRadius * 0.35);
    this.shield.scale.set(SCORPION.bodyRadius * 1.75, SCORPION.heightM * 0.62, SCORPION.bodyRadius * 1.75);
    this.root.add(this.shield);

    const R = ctx.physics.rapier;
    this.body = ctx.physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z),
    );
    this.buildColliders(R.ColliderDesc);
    // face the player at spawn
    this.yaw = Math.atan2(-(ctx.player.position.x - spotX), -(ctx.player.position.z - spotZ));
    this.syncPose();
  }

  // ---- Damageable --------------------------------------------------------------------------

  get alive(): boolean {
    return this.state_ !== 'dead' && this.hp > 0;
  }

  get state(): ScorpionState {
    return this.state_;
  }

  get currentSkill(): ScorpionSkill | null {
    return this.skill;
  }

  get drawCalls(): number {
    return this.rig.meshCount;
  }

  /** Remaining cooldowns, for tests. */
  get cooldownSnapshot(): { ram: number; venom: number; tailSlam: number } {
    return { ...this.cooldowns };
  }

  /** True while the hex shield is up (front hits are reduced). */
  get shielded(): boolean {
    return this.state_ === 'shield' && this.shieldOpen > 0.35;
  }

  /** Crosses the claws and raises the shield; refused mid-skill, while stunned or on cooldown. */
  raiseShield(force = false): boolean {
    if (this.state_ !== 'guard' && this.state_ !== 'chase' && this.state_ !== 'recover') return false;
    if (!force && (this.guardCooldown > 0 || this.passive)) return false;
    this.recentDamage = 0;
    this.guardCooldown = SCORPION.guard.cooldown + SCORPION.guard.seconds;
    this.hideDecals();
    this.enter('shield');
    this.audio.warn(0.3);
    this.ringFx(this.position.x, this.position.z, 4, 0.3);
    return true;
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp * SCORPION.enrageFraction;
  }

  applyDamage(info: DamageInfo): DamageResult {
    if (!this.alive) return { dealt: 0, zone: info.zone, killed: false, absorbed: true };
    // claw shield: hits from the front lose most of their damage
    const up = this.shielded;
    const amount = shieldedDamage(info.amount, this.bearingToPlayer() - this.yaw, up);
    const blocked = amount < info.amount;
    const result = resolveDamage(this.hp, blocked ? { ...info, amount } : info, DEFAULT_ZONE_MULTIPLIERS);
    this.hp = result.hpAfter;
    if (blocked) this.shieldHit = 1;
    else if (result.dealt > 0) this.hurtFlash = 1;
    // sustained fire makes it raise the shield
    this.recentDamage += result.dealt;
    if (!up && !result.killed && this.recentDamage >= SCORPION.guard.triggerDamage) this.raiseShield();
    if (result.killed) this.die();
    return { dealt: result.dealt, zone: result.zone, killed: result.killed, absorbed: result.absorbed };
  }

  // ---- hit volumes (model frame: head towards -Z, y from the ground; the boxes come from the look in use) ----

  private buildColliders(CD: typeof ColliderDesc): void {
    for (const box of this.assets.colliders) {
      const desc = CD.cuboid(box.half.x, box.half.y, box.half.z)
        .setTranslation(box.center.x, box.center.y, box.center.z)
        .setCollisionGroups(Groups.enemy);
      this.colliders.push(
        this.ctx.physics.addCollider(desc, { kind: 'enemy', damageable: this, hitZone: box.zone, owner: this }, this.body),
      );
    }
  }

  // ---- helpers -----------------------------------------------------------------------------

  private enter(state: ScorpionState): void {
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

  private fx(kind: 'dust' | 'spark' | 'armor-spark' | 'smoke' | 'explosion' | 'big-explosion' | 'pickup', x: number, y: number, z: number, scale: number): void {
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

  private turnTowards(target: number, dt: number, rate: number): number {
    const diff = wrapPi(target - this.yaw);
    const maxTurn = rate * dt;
    this.yaw += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    return Math.abs(wrapPi(target - this.yaw));
  }

  private blocked(dx: number, dz: number, length: number): boolean {
    const phys = this.ctx.physics;
    dir.set(dx, 0, dz).normalize();
    for (const h of SCORPION.probeHeights) {
      const hit = phys.raycast({ x: this.position.x, y: this.position.y + h, z: this.position.z }, dir, length, {
        groups: QueryGroups.worldOnly,
      });
      if (hit) return true;
    }
    return false;
  }

  /** Walk towards a point with turning, wall probing, sea guard. Returns true when moving. */
  private walk(tx: number, tz: number, speed: number, dt: number): boolean {
    this.walkWanted = true;
    const target = Math.atan2(-(tx - this.position.x), -(tz - this.position.z));
    const off = this.turnTowards(target, dt, SCORPION.turnRate);
    if (off > 0.9) return false;
    let fx = -Math.sin(this.yaw);
    let fz = -Math.cos(this.yaw);
    const step = speed * dt;
    const look = SCORPION.bodyRadius + SCORPION.probeAhead + step;
    if (this.blocked(fx, fz, look)) {
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
    if (!isOnLand(nx + fx * SCORPION.edgeMargin, nz + fz * SCORPION.edgeMargin)) return false;
    this.position.x = nx;
    this.position.z = nz;
    return true;
  }

  // ---- spec 33: wedge escape ---------------------------------------------------------------

  /** Free distance (m, capped at `probeLength`) along each of the ring of headings, from the current facing. */
  private clearances(): number[] {
    const n = SCORPION.stuck.headings;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = this.yaw + (i / n) * Math.PI * 2;
      const dx = -Math.sin(a);
      const dz = -Math.cos(a);
      let free: number = SCORPION.stuck.probeLength;
      for (const h of SCORPION.probeHeights) {
        const hit = this.ctx.physics.raycast({ x: this.position.x, y: this.position.y + h, z: this.position.z }, { x: dx, y: 0, z: dz }, free, {
          groups: QueryGroups.worldOnly,
        });
        if (hit) free = Math.min(free, hit.distance);
      }
      if (!isOnLand(this.position.x + dx * (SCORPION.edgeMargin + 1), this.position.z + dz * (SCORPION.edgeMargin + 1))) free = Math.min(free, 0);
      out.push(free);
    }
    return out;
  }

  /** Called when it wanted to walk and did not get anywhere. */
  private beginEscape(): void {
    const c = this.clearances();
    const repeat = this.sinceEscape < SCORPION.stuck.repeatWithin;
    this.sinceEscape = 0;
    if (repeat || isBoxedIn(c, SCORPION.stuck.boxedClearance)) {
      this.relocate();
      return;
    }
    // prefer backing out (the heading opposite the facing); the ring is measured from the facing
    const i = pickEscapeHeading(c, c.length / 2);
    this.escapeYaw = this.yaw + (i / c.length) * Math.PI * 2;
    this.escapeLeft = SCORPION.stuck.crawlSeconds;
    this.unstuckCount++;
  }

  /** Crawl along `escapeYaw` (backwards or sideways, whichever was open), turning only slowly. */
  private escapeStep(dt: number): boolean {
    this.escapeLeft -= dt;
    const dx = -Math.sin(this.escapeYaw);
    const dz = -Math.cos(this.escapeYaw);
    const step = SCORPION.walkSpeed * SCORPION.stuck.crawlSpeedFactor * dt;
    if (this.blocked(dx, dz, SCORPION.bodyRadius * 0.6 + step)) {
      this.escapeLeft = 0;
      return false;
    }
    const nx = this.position.x + dx * step;
    const nz = this.position.z + dz * step;
    if (!isOnLand(nx + dx * SCORPION.edgeMargin, nz + dz * SCORPION.edgeMargin)) {
      this.escapeLeft = 0;
      return false;
    }
    this.position.x = nx;
    this.position.z = nz;
    return true;
  }

  /** Free ground at (x, z): land, and no wall within `freeRadius` in 8 directions at probe heights. */
  private isFreeSpot(x: number, z: number): boolean {
    const r = SCORPION.stuck.freeRadius;
    if (!isOnLand(x, z) || !isOnLand(x + r + SCORPION.edgeMargin, z) || !isOnLand(x - r - SCORPION.edgeMargin, z)) return false;
    if (!isOnLand(x, z + r + SCORPION.edgeMargin) || !isOnLand(x, z - r - SCORPION.edgeMargin)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      for (const h of SCORPION.probeHeights) {
        if (this.ctx.physics.raycast({ x, y: h, z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }, r, { groups: QueryGroups.worldOnly })) return false;
      }
    }
    // the centre itself must not be inside a collider: a short down ray from above has to reach the ground
    const down = this.ctx.physics.raycast({ x, y: 8, z }, { x: 0, y: -1, z: 0 }, 8, { groups: QueryGroups.worldOnly });
    return !down || down.point.y < 0.5;
  }

  /** Moves the body to the nearest free spot (rings around it, then around its guard spot). */
  private relocate(): void {
    const S = SCORPION.stuck;
    const centres = [this.position, this.spot];
    for (const c of centres) {
      for (let r = S.relocateStep; r <= S.relocateMax; r += S.relocateStep) {
        const count = Math.max(8, Math.round((r * Math.PI * 2) / 2));
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const x = c.x + Math.cos(a) * r;
          const z = c.z + Math.sin(a) * r;
          if (!this.isFreeSpot(x, z)) continue;
          this.fx('dust', this.position.x, 0.3, this.position.z, 3);
          this.position.x = x;
          this.position.z = z;
          this.fx('dust', x, 0.3, z, 3);
          this.escapeLeft = 0;
          this.stuck.reset();
          this.unstuckCount++;
          return;
        }
      }
    }
  }

  // ---- simulation --------------------------------------------------------------------------

  fixedUpdate(dt: number): void {
    this.updateVenom(dt);
    this.updateBlasts(dt);
    if (this.state_ === 'dead') {
      this.deathTime += dt;
      return;
    }
    this.time += dt;
    this.stateTime += dt;
    tickCooldowns(this.cooldowns, dt);
    this.guardCooldown = Math.max(0, this.guardCooldown - dt);
    this.recentDamage = Math.max(0, this.recentDamage - (SCORPION.guard.triggerDamage / SCORPION.guard.window) * 0.5 * dt);
    const player = this.ctx.player;
    const d = this.hdist();
    const pose = this.pose;
    let walking = false;
    this.walkWanted = false;
    this.sinceEscape += dt;

    switch (this.state_) {
      case 'spawning': {
        const t = Math.min(1, this.stateTime / SCORPION.spawn.riseSeconds);
        const e = 1 - (1 - t) * (1 - t);
        this.position.y = -(1 - e) * SCORPION.heightM;
        // threat display once it is out: claws wide, tail high
        const show = t > 0.45 ? Math.min(1, (t - 0.45) * 3) * (1 - Math.max(0, t - 0.9) * 10) : 0;
        pose.claws = show;
        pose.snap = show;
        pose.tailAim = show;
        pose.tailLash = 1 + 3 * show;
        if (t < 0.7 && this.every(dt, 0.14)) {
          const a = this.time * 7.3;
          this.fx('dust', this.position.x + Math.cos(a) * SCORPION.bodyRadius, 0.2, this.position.z + Math.sin(a) * SCORPION.bodyRadius, 2.2);
          this.fx('spark', this.position.x - Math.cos(a) * 1.2, 0.3, this.position.z - Math.sin(a) * 1.2, 1.5);
        }
        if (t >= 1) {
          this.position.y = 0;
          pose.claws = 0;
          pose.snap = 0;
          pose.tailAim = 0;
          this.ringFx(this.position.x, this.position.z, 9, 0.6);
          this.fx('dust', this.position.x, 0.2, this.position.z, 4);
          this.enter('guard');
        }
        break;
      }
      case 'guard': {
        if (this.escapeLeft > 0) {
          walking = this.escapeStep(dt);
          break;
        }
        if (!this.passive && player.alive && d < SCORPION.aggroRange) {
          this.enter('chase');
          break;
        }
        const hs = Math.hypot(this.spot.x - this.position.x, this.spot.z - this.position.z);
        if (hs > 3) walking = this.walk(this.spot.x, this.spot.z, SCORPION.walkSpeed, dt);
        else this.turnTowards(this.yaw + Math.sin(this.time * 0.4) * 0.2, dt, 0.4);
        break;
      }
      case 'chase': {
        if (!player.alive || d > SCORPION.aggroRange * 1.4) {
          this.enter('guard');
          break;
        }
        if (this.escapeLeft > 0) {
          walking = this.escapeStep(dt);
          break;
        }
        // clicking claws while it hunts
        pose.snap = Math.max(0, Math.sin(this.time * 5)) ** 4;
        pose.claws += (0.25 - pose.claws) * Math.min(1, dt * 4);
        const next = chooseSkill(d, this.cooldowns);
        if (next !== null && this.stateTime > 0.4) {
          this.beginSkill(next);
          break;
        }
        const hs = Math.hypot(this.position.x - this.spot.x, this.position.z - this.spot.z);
        const keepAway = SCORPION.bodyRadius + 2;
        if (d > keepAway && hs < SCORPION.leashRadius) {
          walking = this.walk(player.position.x, player.position.z, SCORPION.walkSpeed, dt);
        } else {
          this.turnTowards(this.bearingToPlayer(), dt, SCORPION.turnRate);
        }
        break;
      }
      case 'telegraph':
        this.updateTelegraph(dt);
        break;
      case 'execute':
        this.updateExecute(dt);
        break;
      case 'recover': {
        this.turnTowards(this.bearingToPlayer(), dt, SCORPION.turnRate * 0.5);
        const k = Math.min(1, dt * 5);
        pose.tailStrike *= 1 - k;
        pose.tailAim *= 1 - k;
        pose.pitch *= 1 - k;
        pose.crouch *= 1 - k;
        pose.charge = 0;
        if (this.stateTime >= (this.enraged ? SCORPION.enragedRecover : SCORPION.recover)) this.enter('chase');
        break;
      }
      case 'shield': {
        // braced behind crossed claws, turning slowly to keep the shield on the player
        this.turnTowards(this.bearingToPlayer(), dt, SCORPION.turnRate * 0.6);
        const k = Math.min(1, dt * 9);
        pose.claws += (-0.85 - pose.claws) * k;
        pose.snap += (0 - pose.snap) * k;
        pose.crouch += (0.5 - pose.crouch) * k;
        pose.pitch += (0.05 - pose.pitch) * k;
        pose.tailAim += (0.6 - pose.tailAim) * k;
        pose.tailStrike *= 1 - k;
        if (this.stateTime >= SCORPION.guard.seconds) this.enter('chase');
        break;
      }
      case 'stunned':
        pose.crouch = 0.8;
        pose.pitch += (0.12 - pose.pitch) * Math.min(1, dt * 5);
        pose.claws = 0;
        pose.tailStrike += (0.35 - pose.tailStrike) * Math.min(1, dt * 4);
        pose.flicker = 0.8;
        if (this.every(dt, 0.22)) {
          const hx = this.position.x - Math.sin(this.yaw) * SCORPION.bodyRadius * 0.8;
          const hz = this.position.z - Math.cos(this.yaw) * SCORPION.bodyRadius * 0.8;
          this.fx('armor-spark', hx, 1.4, hz, 1.2);
          this.fx('smoke', hx, 1.6, hz, 0.8);
        }
        if (this.stateTime >= this.stunDuration) {
          pose.crouch = 0;
          pose.flicker = 0;
          this.enter('chase');
        }
        break;
    }

    if (this.state_ !== 'spawning' && this.state_ !== 'stunned') {
      const lash = this.enraged ? 4 : 1;
      if (this.state_ !== 'execute') pose.tailLash += (lash - pose.tailLash) * Math.min(1, dt * 3);
      if (this.enraged && Math.floor(this.time * 2.5) !== Math.floor((this.time - dt) * 2.5)) {
        this.fx('smoke', this.position.x, 1.8, this.position.z, 0.9);
      }
    }
    // spec 33: it wants to walk (guard/chase) but is not getting anywhere: crawl out, or step to a free spot
    const walkState = this.state_ === 'guard' || this.state_ === 'chase';
    if (this.stuck.update(dt, walkState && this.escapeLeft <= 0 && this.walkWanted, this.position.x, this.position.z)) this.beginEscape();
    const skillDrivesGait = this.state_ === 'execute' && this.skill === 'ram';
    if (!skillDrivesGait) {
      this.walkAmount += ((walking ? 1 : 0) - this.walkAmount) * Math.min(1, dt * 6);
      pose.walk = this.walkAmount;
      // one gait cycle per stride of ground actually covered: the feet keep pace with the quay
      if (walking) pose.walkPhase += ((SCORPION.walkSpeed * dt) / SCORPION.strideLength) * Math.PI * 2;
    }
    this.syncPose();
  }

  private beginSkill(skill: ScorpionSkill): void {
    this.skill = skill;
    this.skillLocked = false;
    this.hitThisSkill = false;
    this.fired = false;
    this.fxTimer = 0;
    this.enter('telegraph');
    const duration = skillTelegraph(skill);
    const sk = SCORPION.skills;
    const radius = skill === 'tailSlam' ? sk.tailSlam.radius : skill === 'venom' ? sk.venom.radius : sk.ram.stripWidth;
    this.ctx.events.emit('scorpion:telegraph', { id: this.id, skill, position: evPos.copy(this.position), radius, duration });
    this.audio.warn(duration);
  }

  private updateTelegraph(dt: number): void {
    const skill = this.skill as ScorpionSkill;
    const T = skillTelegraph(skill);
    const t = Math.min(1, this.stateTime / T);
    const pose = this.pose;
    if (!this.skillLocked) {
      this.turnTowards(this.bearingToPlayer(), dt, SCORPION.turnRate * 2.5);
      if (t >= 0.6) {
        this.skillLocked = true;
        const p = this.ctx.player.position;
        if (skill === 'ram') {
          this.lockDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        } else if (skill === 'venom') {
          this.target.set(p.x, 0, p.z);
          const lx = this.target.x - this.position.x;
          const lz = this.target.z - this.position.z;
          const ll = Math.hypot(lx, lz);
          const max = SCORPION.skills.venom.max;
          if (ll > max) this.target.set(this.position.x + (lx / ll) * max, 0, this.position.z + (lz / ll) * max);
        }
      }
    }
    pose.glow = 1.5 + 3 * (0.5 + 0.5 * Math.sin(this.time * 22)) * t;
    if (skill === 'ram') {
      // crouches, claws forward and snapping, legs drumming
      pose.crouch = 0.6 * t;
      pose.pitch = 0.08 * t;
      pose.claws = 0.2 + 0.5 * t;
      pose.snap = 0.5 + 0.5 * Math.sin(this.time * 18);
      pose.walk = 0.5;
      pose.walkPhase += dt * 16;
      this.walkAmount = 0.5;
      if (this.every(dt, 0.16)) this.fx('dust', this.position.x + Math.sin(this.yaw) * 1.5, 0.15, this.position.z + Math.cos(this.yaw) * 1.5, 1.4);
    } else if (skill === 'venom') {
      // tail rears and aims, the stinger fills with venom
      pose.tailAim = t;
      pose.charge = t;
      pose.pitch = -0.06 * t;
      pose.claws = 0.6 * t;
      if (this.every(dt, 0.12)) {
        const tip = this.stinger();
        this.fx('pickup', tip.x, tip.y, tip.z, 0.5);
      }
    } else {
      // tail winds back, body drops
      pose.tailStrike = -t;
      pose.crouch = 0.4 * t;
      pose.claws = 0.8 * t;
      pose.snap = 1;
    }
    this.showDecals(skill, t);
    if (this.stateTime >= T) this.beginExecute(skill);
  }

  /** World position of the stinger tip. */
  private stinger(): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.rig.stingerWorld(tip);
  }

  private showDecals(skill: ScorpionSkill, t: number): void {
    const y = SCORPION.telegraphY;
    if (skill === 'ram') {
      const s = SCORPION.skills.ram;
      const dx = this.skillLocked ? this.lockDir.x : -Math.sin(this.yaw);
      const dz = this.skillLocked ? this.lockDir.z : -Math.cos(this.yaw);
      this.strip.visible = true;
      this.strip.position.set(this.position.x, y, this.position.z);
      this.strip.rotation.y = Math.atan2(-dx, -dz);
      this.strip.scale.set(s.stripWidth, 1, s.maxDistance);
      const u = this.stripMat.uniforms;
      (u.uFill as { value: number }).value = t;
      (u.uTime as { value: number }).value = this.time * (this.skillLocked ? 2.2 : 1);
      (u.uAlpha as { value: number }).value = this.skillLocked ? 0.75 + 0.25 * Math.sin(this.time * 30) : 0.7;
    } else if (skill === 'venom') {
      const p = this.ctx.player.position;
      const tx = this.skillLocked ? this.target.x : p.x;
      const tz = this.skillLocked ? this.target.z : p.z;
      this.disc.visible = true;
      this.disc.position.set(tx, y, tz);
      this.disc.scale.setScalar(SCORPION.skills.venom.radius);
      const u = this.discMat.uniforms;
      (u.uFill as { value: number }).value = t;
      (u.uTime as { value: number }).value = this.time;
      (u.uAlpha as { value: number }).value = 0.85;
    } else {
      this.fan.visible = true;
      this.fan.position.set(this.position.x, y, this.position.z);
      this.fan.rotation.y = this.yaw;
      this.fan.scale.setScalar(SCORPION.skills.tailSlam.radius);
      const u = this.fanMat.uniforms;
      (u.uFill as { value: number }).value = t;
      (u.uTime as { value: number }).value = this.time;
      (u.uAlpha as { value: number }).value = 0.8;
    }
  }

  private hideDecals(): void {
    this.disc.visible = false;
    this.strip.visible = false;
    this.fan.visible = false;
  }

  private beginExecute(skill: ScorpionSkill): void {
    this.enter('execute');
    this.travelled = 0;
    this.fxTimer = 0;
    const sk = SCORPION.skills;
    if (skill === 'ram') {
      this.hideDecals();
      this.audio.roar();
      this.ringFx(this.position.x, this.position.z, 3.5, 0.3);
    }
    this.ctx.events.emit('scorpion:attack', {
      id: this.id,
      skill,
      position: evPos.copy(this.position),
      radius: skill === 'tailSlam' ? sk.tailSlam.radius : skill === 'venom' ? sk.venom.radius : sk.ram.hitRadius,
    });
  }

  private updateExecute(dt: number): void {
    const skill = this.skill as ScorpionSkill;
    this.pose.glow = 3;
    if (skill === 'ram') this.updateRam(dt);
    else if (skill === 'venom') this.updateVenomShot();
    else this.updateTailSlam();
  }

  private finishSkill(): void {
    startCooldown(this.cooldowns, this.skill as ScorpionSkill);
    this.pose.glow = 1.1;
    this.hideDecals();
    this.enter('recover');
  }

  private stun(seconds: number): void {
    this.stunDuration = seconds;
    this.pose.glow = 1.2;
    this.hideDecals();
    this.enter('stunned');
    this.ctx.events.emit('scorpion:stunned', { id: this.id, position: evPos.copy(this.position), duration: seconds });
  }

  /** Damage plus a push away from (fromX, fromZ); `direction` overrides the push direction. */
  private hurtPlayer(skill: ScorpionSkill, amount: number, fromX: number, fromZ: number, knock: number, up = 3, direction?: Vector3): void {
    const player = this.ctx.player;
    if (amount <= 0) return;
    if (direction) {
      hitDir.copy(direction);
    } else {
      const dx = player.position.x - fromX;
      const dz = player.position.z - fromZ;
      const l = Math.hypot(dx, dz) || 1;
      hitDir.set(dx / l, 0, dz / l);
    }
    const result = player.applyDamage({ amount, zone: 'body', source: 'enemy', direction: hitDir });
    if (knock > 0) {
      impulse.set(hitDir.x * knock, up, hitDir.z * knock);
      player.addImpulse(impulse);
    }
    if (!result.absorbed) this.ctx.events.emit('scorpion:hitPlayer', { id: this.id, skill, damage: result.dealt });
  }

  // ---- skill 1: charge -------------------------------------------------------------------

  private updateRam(dt: number): void {
    const s = SCORPION.skills.ram;
    const pose = this.pose;
    const step = s.speed * dt;
    if (this.blocked(this.lockDir.x, this.lockDir.z, SCORPION.bodyRadius + SCORPION.probeAhead + step)) {
      const wx = this.position.x + this.lockDir.x * SCORPION.bodyRadius;
      const wz = this.position.z + this.lockDir.z * SCORPION.bodyRadius;
      this.fx('big-explosion', wx, 1.4, wz, 0.9);
      this.fx('armor-spark', wx, 1.2, wz, 3);
      this.fx('dust', wx, 0.3, wz, 3.5);
      this.ringFx(wx, wz, 6, 0.45);
      this.hooks.shake(SCORPION.stompShake, 0.8, this.position.x, this.position.z);
      this.audio.thud();
      startCooldown(this.cooldowns, 'ram');
      this.stun(s.stun);
      return;
    }
    const nx = this.position.x + this.lockDir.x * step;
    const nz = this.position.z + this.lockDir.z * step;
    if (!isOnLand(nx + this.lockDir.x * SCORPION.edgeMargin, nz + this.lockDir.z * SCORPION.edgeMargin)) {
      this.finishSkill();
      return;
    }
    this.position.x = nx;
    this.position.z = nz;
    this.travelled += step;
    pose.walkPhase += (step / (SCORPION.strideLength * 1.6)) * Math.PI * 2;
    pose.walk = 1;
    pose.crouch = 0.35;
    pose.pitch = 0.1;
    pose.claws = 0.15;
    pose.snap = 1;
    pose.tailLash = 3;
    // eight spikes tearing up the quay
    if (this.every(dt, 0.06)) {
      const side = Math.sin(pose.walkPhase) > 0 ? 1 : -1;
      const fx = this.position.x - this.lockDir.x * 0.6 + this.lockDir.z * side * 1.4;
      const fz = this.position.z - this.lockDir.z * 0.6 - this.lockDir.x * side * 1.4;
      this.fx('dust', fx, 0.15, fz, 1.6);
      this.fx('spark', fx, 0.12, fz, 1.1);
    }
    if (!this.hitThisSkill && this.ctx.player.alive && ramContact(this.hdist(), this.feetAbove())) {
      this.hitThisSkill = true;
      // thrown straight back along the charge
      this.hurtPlayer('ram', s.damage, this.position.x, this.position.z, s.knockback, s.knockUp, this.lockDir);
      const pp = this.ctx.player.position;
      this.fx('armor-spark', pp.x, pp.y + 1, pp.z, 2.4);
      this.fx('dust', pp.x, 0.2, pp.z, 2);
      this.ringFx(pp.x, pp.z, 3, 0.25);
      this.hooks.shake(SCORPION.stompShake * 0.8, 0.45, this.position.x, this.position.z);
      this.audio.thud();
    }
    if (this.travelled >= s.maxDistance) this.finishSkill();
  }

  // ---- skill 2: venom shot ---------------------------------------------------------------

  private updateVenomShot(): void {
    const pose = this.pose;
    if (!this.fired) {
      this.fired = true;
      const tip = this.stinger();
      this.globFrom.copy(tip);
      this.globTo.copy(this.target);
      this.globT = 0;
      this.glob.visible = true;
      this.glob.position.copy(tip);
      this.fx('pickup', tip.x, tip.y, tip.z, 1.6);
      this.audio.roar();
      pose.charge = 0;
    }
    // recoil: the tail snaps forward, then eases back
    const k = Math.min(1, this.stateTime / 0.35);
    pose.tailStrike = 0.35 * Math.sin(k * Math.PI);
    pose.tailAim = 1 - k * 0.6;
    if (this.stateTime >= 0.45) this.finishSkill();
  }

  /** The glob in flight and the pool; runs whatever the scorpion itself is doing. */
  private updateVenom(dt: number): void {
    const s = SCORPION.skills.venom;
    const player = this.ctx.player;
    if (this.globT >= 0) {
      this.globT += dt / s.flight;
      const a = this.globFrom;
      const b = this.globTo;
      const p = arcPosition(a.x, a.y, a.z, b.x, 0.2, b.z, this.globT);
      this.glob.position.set(p.x, p.y, p.z);
      const wobble = 1 + Math.sin(this.time * 40) * 0.12;
      this.glob.scale.set(wobble, 2 - wobble, wobble);
      if (Math.floor(this.globT * 18) !== Math.floor((this.globT - dt / s.flight) * 18)) this.fx('pickup', p.x, p.y, p.z, 0.45);
      (this.discMat.uniforms.uTime as { value: number }).value = this.time * 2.5;
      (this.discMat.uniforms.uAlpha as { value: number }).value = 0.7 + 0.3 * Math.sin(this.time * 34);
      if (this.globT >= 1) {
        this.globT = -1;
        this.glob.visible = false;
        this.disc.visible = false;
        // burst
        const d = Math.hypot(player.position.x - b.x, player.position.z - b.z);
        if (player.alive && player.position.y <= s.poolHeight + 1.2) this.hurtPlayer('venom', venomBurstDamage(d), b.x, b.z, 4, 2);
        this.fx('pickup', b.x, 0.5, b.z, 4);
        this.fx('dust', b.x, 0.2, b.z, 2.5);
        this.ringFx(b.x, b.z, s.radius, 0.35);
        this.hooks.shake(SCORPION.stompShake * 0.5, 0.35, b.x, b.z);
        this.audio.thud();
        this.ctx.events.emit('scorpion:attack', { id: this.id, skill: 'venom', position: evPos.set(b.x, 0, b.z), radius: s.radius });
        // pool
        this.poolLeft = s.poolSeconds;
        this.poolTick = s.tickInterval;
        this.pool.visible = true;
        this.pool.position.set(b.x, SCORPION.telegraphY + 0.01, b.z);
        this.pool.scale.setScalar(s.radius);
      }
    }
    if (this.poolLeft > 0) {
      this.poolLeft -= dt;
      const life = this.poolLeft / s.poolSeconds;
      const u = this.poolMat.uniforms;
      (u.uTime as { value: number }).value += dt;
      (u.uAlpha as { value: number }).value = Math.min(1, life * 4) * Math.min(1, (1 - life) * 12 + 0.2);
      const px = this.pool.position.x;
      const pz = this.pool.position.z;
      this.poolTick -= dt;
      if (this.poolTick <= 0) {
        this.poolTick = s.tickInterval;
        // bubbles popping
        const a = this.time * 5.1;
        const r = s.radius * (0.2 + 0.6 * Math.abs(Math.sin(this.time * 3.3)));
        this.fx('pickup', px + Math.cos(a) * r, 0.2, pz + Math.sin(a) * r, 0.7);
        const d = Math.hypot(player.position.x - px, player.position.z - pz);
        if (player.alive && inPool(d, player.position.y)) this.hurtPlayer('venom', s.tickDamage, px, pz, 0);
      }
      if (this.poolLeft <= 0) this.pool.visible = false;
    }
  }

  // ---- skill 3: tail slam ------------------------------------------------------------------

  private updateTailSlam(): void {
    const s = SCORPION.skills.tailSlam;
    const pose = this.pose;
    const k = Math.min(1, this.stateTime / s.strikeSeconds);
    // from wound back (-1) over the head into the ground (+1), accelerating
    pose.tailStrike = -1 + 2 * k * k;
    pose.pitch = 0.1 * k;
    pose.crouch = 0.4;
    pose.tailLash = 0;
    if (k >= 1 && !this.fired) {
      this.fired = true;
      this.hideDecals();
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const player = this.ctx.player;
      if (player.alive) {
        const rel = this.bearingToPlayer() - this.yaw;
        if (fanHit(this.hdist(), rel, this.feetAbove())) {
          this.hurtPlayer('tailSlam', s.damage, this.position.x, this.position.z, s.knockback, 5);
        }
      }
      // impact where the stinger lands, then blasts running outwards across the fan
      const ix = this.position.x + fx * 2.6;
      const iz = this.position.z + fz * 2.6;
      this.fx('big-explosion', ix, 0.6, iz, 0.8);
      this.fx('dust', ix, 0.2, iz, 3);
      this.ringFx(ix, iz, 4, 0.3);
      this.blastClock = 0;
      const rows = [
        { r: 0.42, n: 2, t: 0.06 },
        { r: 0.68, n: 3, t: 0.14 },
        { r: 0.94, n: 4, t: 0.22 },
      ];
      for (const row of rows) {
        for (let i = 0; i < row.n; i++) {
          const a = this.yaw + (row.n === 1 ? 0 : (i / (row.n - 1) - 0.5) * 2 * s.halfAngle * 0.82);
          this.blasts.push({ t: row.t, x: this.position.x - Math.sin(a) * s.radius * row.r, z: this.position.z - Math.cos(a) * s.radius * row.r, scale: 0.9 + row.r * 0.5 });
        }
      }
      this.hooks.shake(SCORPION.stompShake, 0.7, this.position.x, this.position.z);
      this.audio.thud();
      this.ctx.events.emit('scorpion:attack', { id: this.id, skill: 'tailSlam', position: evPos.set(ix, 0, iz), radius: s.radius });
    }
    if (this.stateTime >= s.strikeSeconds + s.holdSeconds) this.finishSkill();
  }

  private updateBlasts(dt: number): void {
    if (this.blasts.length === 0) return;
    this.blastClock += dt;
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i] as Blast;
      if (this.blastClock < b.t) continue;
      this.fx('explosion', b.x, 0.5, b.z, b.scale);
      this.fx('dust', b.x, 0.2, b.z, 1.8);
      this.blasts.splice(i, 1);
    }
  }

  // ---- presentation ------------------------------------------------------------------------

  animate(dt: number): void {
    if (this.state_ === 'dead') {
      this.updateDeath();
      return;
    }
    const pose = this.pose;
    pose.time = this.time;
    const baseGlow = this.enraged ? 2.6 + Math.sin(this.time * 9) * 0.7 : 1.1;
    if (this.state_ === 'guard' || this.state_ === 'chase') {
      const k = Math.min(1, dt * 4);
      pose.glow += (baseGlow - pose.glow) * k;
      pose.pitch *= 1 - k;
      pose.crouch *= 1 - k;
      pose.tailStrike *= 1 - k;
      pose.tailAim *= 1 - k;
      if (this.state_ === 'guard') {
        pose.claws *= 1 - k;
        pose.snap *= 1 - k;
      }
    }
    // shield: cells switch on quickly, off a little slower; absorbed hits flash
    const want = this.state_ === 'shield' && this.stateTime < SCORPION.guard.seconds - 0.25 ? 1 : 0;
    this.shieldOpen += (want - this.shieldOpen) * Math.min(1, dt * (want ? 9 : 6));
    this.shieldHit = Math.max(0, this.shieldHit - dt * 6);
    this.shield.visible = this.shieldOpen > 0.02;
    if (this.shield.visible) {
      const u = this.shieldMat.uniforms;
      (u.uOpen as { value: number }).value = this.shieldOpen;
      (u.uHit as { value: number }).value = this.shieldHit;
      (u.uTime as { value: number }).value = this.time;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
    if (this.state_ !== 'stunned') pose.flicker = this.hurtFlash * 0.7;
    this.rig.apply(pose);
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
    this.shield.visible = false;
    this.deathTime = 0;
    this.deathStage = 0;
    if (!this.released) {
      this.released = true;
      this.ctx.physics.removeBody(this.body);
      this.colliders.length = 0;
    }
    this.fx('explosion', this.position.x, 1.4, this.position.z, 1.6);
    this.ctx.events.emit('scorpion:defeated', { id: this.id, position: evPos.copy(this.position) });
    this.hooks.defeated(this);
  }

  private updateDeath(): void {
    const t = this.deathTime;
    const pose = this.pose;
    // systems fail in a chain of blasts, the legs give way, the tail whips and drops, final detonation
    const stages = 5;
    while (this.deathStage < stages && t >= 0.25 + this.deathStage * 0.3) {
      const i = this.deathStage++;
      const a = i * 2.4 + this.yaw;
      this.fx('explosion', this.position.x + Math.cos(a) * 1.6, 0.9 + 0.3 * i, this.position.z + Math.sin(a) * 1.6, 1.2);
      this.fx('armor-spark', this.position.x - Math.cos(a), 1.4, this.position.z - Math.sin(a), 2.5);
    }
    const fall = Math.max(0, Math.min(1, (t - 0.9) / 1.0));
    const eased = fall * fall;
    if (this.deathStage === stages && fall >= 1) {
      this.deathStage++;
      this.fx('big-explosion', this.position.x, 1, this.position.z, 1.5);
      this.fx('pickup', this.position.x, 1, this.position.z, 5);
      this.ringFx(this.position.x, this.position.z, 9, 0.6);
      this.fx('dust', this.position.x, 0.2, this.position.z, 5);
      this.hooks.shake(SCORPION.stompShake, 1.0, this.position.x, this.position.z);
      this.audio.thud();
    }
    pose.time = this.time + t;
    pose.walk = 1 - eased;
    pose.walkPhase += 0.5 * (1 - eased);
    pose.crouch = eased;
    pose.claws = 1 - eased * 0.6;
    pose.snap = 1 - eased;
    pose.tailLash = 6 * (1 - eased);
    pose.tailStrike = eased * 0.8;
    pose.tailAim = 0;
    pose.charge = 0;
    pose.flicker = 1;
    pose.glow = Math.max(0, 3.5 - t * 1.2);
    this.rig.apply(pose);
    this.root.rotation.z = eased * 0.22;
    this.root.position.set(this.position.x, this.position.y - Math.max(0, t - 4.5) * 1.2, this.position.z);
    this.root.visible = t < 7;
  }

  get removable(): boolean {
    return this.state_ === 'dead' && this.deathTime > 7 && this.poolLeft <= 0 && this.globT < 0;
  }

  /** Respawn: forget the fight and return to guard duty (HP is kept). */
  resetToGuard(): void {
    if (this.state_ === 'dead' || this.state_ === 'spawning') return;
    this.hideDecals();
    const pose = this.pose;
    pose.crouch = 0;
    pose.pitch = 0;
    pose.tailStrike = 0;
    pose.tailAim = 0;
    pose.charge = 0;
    pose.flicker = 0;
    pose.glow = 1.1;
    this.globT = -1;
    this.glob.visible = false;
    this.poolLeft = 0;
    this.pool.visible = false;
    this.blasts.length = 0;
    this.position.y = 0;
    this.skill = null;
    this.enter('guard');
  }

  /** Test hook: start a skill right now, whatever the distance. */
  forceSkill(skill: ScorpionSkill): boolean {
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
    for (const m of [this.disc, this.strip, this.fan, this.pool, this.glob]) m.removeFromParent();
    this.discMat.dispose();
    this.stripMat.dispose();
    this.fanMat.dispose();
    this.poolMat.dispose();
    this.globMat.dispose();
    this.shieldMat.dispose();
    this.rig.dispose();
  }
}
