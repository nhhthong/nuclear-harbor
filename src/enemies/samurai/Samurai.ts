import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { DamageInfo, DamageResult } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from '../BaseEnemy';
import { createVertexColorMaterial } from '../duck/modelKit';
import { forgetTarget, markAware, type Perception } from '../perception';
import type { SharedAssets } from '../SharedAssets';
import { approach, createGaitPose, gaitPose, strideLength } from '../gait';
import { coneHit, dashUsesDue, deflectedDamage, distanceToSegment, pickDashPoint } from './logic';
import { buildSamuraiModel, type SamuraiModel } from './model';
import { SAMURAI } from './tunables';

export type SamuraiState = 'patrol' | 'chase' | 'cutWindup' | 'cutRecover' | 'leapTelegraph' | 'leap' | 'leapRecover' | 'spin' | 'dashCharge' | 'dash' | 'dashRecover' | 'destroyed';

const models = new WeakMap<SharedAssets, SamuraiModel>();
function modelFor(shared: SharedAssets): SamuraiModel {
  let m = models.get(shared);
  if (!m) {
    m = buildSamuraiModel();
    models.set(shared, m);
  }
  return m;
}

const TRAIL_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Faint lightning left along a dash: a jagged core with a soft halo, fading out with uAlpha.
const TRAIL_FRAGMENT = /* glsl */ `
uniform float uAlpha;
uniform float uSeed;
uniform float uTime;
varying vec2 vUv;
float h(float x) { return fract(sin(x * 127.1 + uSeed * 311.7) * 43758.5453); }
float n(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
void main() {
  float x = vUv.x * 14.0;
  float t = floor(uTime * 24.0);
  float wob = (n(x + t * 7.0) - 0.5) * 0.5 + (n(x * 3.1 + t * 3.0) - 0.5) * 0.22;
  float d = abs(vUv.y - 0.5 - wob * 0.6);
  float core = smoothstep(0.02, 0.0, d);
  float halo = smoothstep(0.3, 0.0, d) * 0.16;
  float branch = smoothstep(0.02, 0.0, abs(vUv.y - 0.5 - wob * 0.6 - (n(x * 1.7 + 9.0) - 0.5) * 0.5)) * 0.35;
  float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  float a = (core + halo + branch) * ends * uAlpha;
  gl_FragColor = vec4(vec3(0.55, 0.8, 1.0) * (1.0 + core * 3.0) * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const impulse = new Vector3();
const hitDir = new Vector3();
const fxPos = new Vector3();
const dashPoint = { x: 0, z: 0 };

interface Trail {
  mesh: Mesh;
  mat: ShaderMaterial;
  life: number;
}

/**
 * Cyber samurai (enemy type `samurai`): an elite with 300 HP that hunts on foot and uses
 *  - a quick cut at arm's length,
 *  - a leap across up to 17 m that ends in a cleave,
 *  - a spinning polearm that deflects frontal fire for 3 s when it is being shot,
 *  - twice per life (below 70% and 35% HP) a burst of lightning-fast dashes across an area.
 */
export class Samurai extends BaseEnemy {
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private cutCooldown = 0;
  private leapCooldown = 0;
  private spinCooldown = 0;
  private recentDamage = 0;
  private dashUsed = 0;
  private dashLeft = 0;
  private dashT = 0;
  private dashPause = 0;
  private dashHit = false;
  private readonly dashCentre = new Vector3();
  private readonly dashFrom = new Vector3();
  private readonly dashTo = new Vector3();
  private readonly leapFrom = new Vector3();
  private readonly leapTo = new Vector3();
  private lift = 0;
  private gait = 0;
  private lastX: number;
  private lastZ: number;
  private speedEstimate = 0;
  private spinAngle = 0;
  private swing = 0;
  private seed: number;

  private readonly model = new Group();
  private readonly thighL: Mesh;
  private readonly thighR: Mesh;
  private readonly shinL: Mesh;
  private readonly shinR: Mesh;
  private readonly upper = new Group();
  private readonly legLength: number;
  private readonly pose = createGaitPose();
  private walkAmount = 0;
  private easedSpeed = 0;
  private speedTarget = 0;
  private lastSetSpeed = 0;
  private readonly weapon = new Group();
  private readonly cloth: Mesh;
  private readonly fan: Mesh;
  private readonly fanMat: MeshBasicMaterial;
  private readonly glow: MeshStandardMaterial;
  private readonly trails: Trail[] = [];
  private trailNext = 0;
  private readonly restAngle: number;

  constructor(deps: EnemyDeps, spawn: EnemySpawn) {
    super(
      deps,
      spawn,
      { type: 'samurai', maxHp: SAMURAI.hp, centerHeight: SAMURAI.centerHeight, radius: SAMURAI.radius, speed: SAMURAI.chaseSpeed, perceptionRange: SAMURAI.detectionRange },
      'patrol',
    );
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    this.seed = (spawn.position.x * 12.9898 + spawn.position.z * 78.233) % 1;
    const { shared, ctx } = deps;
    const m = modelFor(shared);
    this.restAngle = m.restAngle;
    const armor = shared.get('samurai:mat', () => createVertexColorMaterial(0.34, 0.8, { key: 'samurai', wear: 0.3, bottomY: -1.5, height: 3.4, detail: 4 }));
    const clothMat = shared.get('samurai:cloth-mat', () => {
      const mat = createVertexColorMaterial(0.85, 0);
      mat.side = DoubleSide;
      return mat;
    });
    // the glow pulses per samurai (charge-up), so it is the one per-instance material
    this.glow = new MeshStandardMaterial({ color: 0x300404, emissive: 0xff1408, emissiveIntensity: 2.4 });
    const geo = <T extends import('three').BufferGeometry>(key: string, g: T): T => shared.get(`samurai:${key}`, () => g);

    // upper body (torso, arms, weapon, sash) turns and leans as one group above the hips
    const body = new Mesh(geo('body', m.body), armor);
    body.castShadow = true;
    this.upper.add(body, new Mesh(geo('bodyGlow', m.bodyGlow), this.glow));
    this.legLength = m.thighLength + m.shinLength;
    const makeLeg = (thighGeo: import('three').BufferGeometry, shinGeo: import('three').BufferGeometry, key: string): [Mesh, Mesh] => {
      const thigh = new Mesh(geo(`thigh${key}`, thighGeo), armor);
      const shin = new Mesh(geo(`shin${key}`, shinGeo), armor);
      thigh.position.set(0, m.hip.y, 0);
      shin.position.set(0, m.knee.y, m.knee.z);
      thigh.castShadow = true;
      shin.castShadow = true;
      thigh.add(shin);
      this.model.add(thigh);
      return [thigh, shin];
    };
    [this.thighL, this.shinL] = makeLeg(m.thighL, m.shinL, 'L');
    [this.thighR, this.shinR] = makeLeg(m.thighR, m.shinR, 'R');
    const blade = new Mesh(geo('weapon', m.weapon), armor);
    blade.castShadow = true;
    // blades: mirror steel with a bright ground bevel, no paint wear
    const bladeMat = shared.get('samurai:blade-mat', () => createVertexColorMaterial(0.2, 0.9));
    const edge = new Mesh(geo('blade', m.blade), bladeMat);
    edge.castShadow = true;
    this.weapon.add(blade, edge, new Mesh(geo('weaponGlow', m.weaponGlow), this.glow));
    this.weapon.position.copy(m.grip);
    this.weapon.rotation.z = m.restAngle;
    this.upper.add(this.weapon);
    this.cloth = new Mesh(geo('cloth', m.cloth), clothMat);
    this.cloth.position.copy(m.clothPivot);
    this.upper.add(this.cloth);
    this.model.add(this.upper);
    // blur disc of the spinning polearm
    this.fanMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false });
    this.fanMat.color.setRGB(0.55, 0.3, 0.26);
    this.fan = new Mesh(shared.get('samurai:fan-geo', () => new CircleGeometry(3.25, 40)), this.fanMat);
    this.fan.position.copy(m.grip);
    this.fan.visible = false;
    this.fan.userData.noReflect = true;
    this.upper.add(this.fan);
    this.root.add(this.model);

    // lightning trails live in the scene (they stay where the dash happened)
    const trailGeo = shared.get('samurai:trail-geo', () => new PlaneGeometry(1, 1));
    for (let i = 0; i < SAMURAI.dash.count; i++) {
      const mat = new ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uSeed: { value: i * 1.37 + this.seed }, uTime: { value: 0 } },
        vertexShader: TRAIL_VERTEX,
        fragmentShader: TRAIL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      });
      const mesh = new Mesh(trailGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.noReflect = true;
      ctx.scene.add(mesh);
      this.trails.push({ mesh, mat, life: 0 });
    }

    const { ColliderDesc } = ctx.physics.rapier;
    const ch = SAMURAI.centerHeight;
    this.addHitVolume(ColliderDesc.cuboid(0.55, 0.55, 0.38).setTranslation(0, 2.2 - ch, 0), 'body');
    this.addHitVolume(ColliderDesc.cuboid(0.45, 0.8, 0.32).setTranslation(0, 0.85 - ch, 0), 'body');
    this.addHitVolume(ColliderDesc.cuboid(0.2, 0.22, 0.22).setTranslation(0, 2.85 - ch, -0.02), 'critical');
  }

  get brainState(): SamuraiState {
    return this.fsm.state as SamuraiState;
  }

  get dashesUsed(): number {
    return this.dashUsed;
  }

  // ---- damage ---------------------------------------------------------------------------

  override applyDamage(info: DamageInfo): DamageResult {
    const spinning = this.brainState === 'spin';
    if (spinning && this.alive) {
      const pl = this.deps.ctx.player.position;
      const bearing = Math.atan2(-(pl.x - this.position.x), -(pl.z - this.position.z));
      const amount = deflectedDamage(info.amount, bearing - this.yaw, true);
      if (amount < info.amount) {
        // sparks off the blades
        this.fx('armor-spark', -Math.sin(this.yaw) * 0.8, 0.4, -Math.cos(this.yaw) * 0.8, 0.9);
        return super.applyDamage({ ...info, amount });
      }
    }
    return super.applyDamage(info);
  }

  protected override onDamaged(_info: DamageInfo, result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
    this.recentDamage += result.dealt;
    const s = this.brainState;
    if ((s === 'chase' || s === 'patrol' || s === 'cutRecover' || s === 'leapRecover') && this.spinCooldown <= 0 && this.recentDamage >= SAMURAI.spin.triggerDamage) {
      this.transition('spin');
    }
  }

  // ---- decisions ------------------------------------------------------------------------

  protected think(_dt: number, p: Perception): void {
    const pl = this.deps.ctx.player.position;
    const d = Math.hypot(pl.x - this.position.x, pl.z - this.position.z);
    const state = this.brainState;
    const tracking = p.playerAlive && (p.hasLos || p.timeSinceSeen < SAMURAI.loseTargetTime);

    if (state === 'patrol') {
      if (tracking || this.commanded) this.transition('chase');
      else this.patrolTick();
      return;
    }
    if (state === 'spin') {
      // keeps the fan between itself and the player while closing in slowly
      this.lockFacing = true;
      this.face(pl.x, pl.z);
      this.setGoal(pl.x, pl.z);
      this.moveSpeed = d > 3 ? SAMURAI.spin.advanceSpeed : 0;
      return;
    }
    if (state !== 'chase') return;

    if (!tracking && !this.commanded) {
      this.transition('patrol');
      return;
    }
    if (this.commanded && Math.hypot(this.commandTarget.x - this.position.x, this.commandTarget.z - this.position.z) <= 3) this.commanded = false;
    this.lockFacing = false;
    if (tracking && p.hasLos) {
      // lightning dashes: owed by the HP gates, twice per life
      if (this.dashUsed < dashUsesDue(this.hp / this.maxHp) && d <= SAMURAI.dash.range) {
        this.transition('dashCharge');
        return;
      }
      if (d <= SAMURAI.cut.range && this.cutCooldown <= 0) {
        this.transition('cutWindup');
        return;
      }
      if (d >= SAMURAI.leap.min && d <= SAMURAI.leap.max && this.leapCooldown <= 0) {
        this.transition('leapTelegraph');
        return;
      }
    }
    const t = tracking ? (p.hasLos ? pl : p.lastSeenPos) : this.commandTarget;
    if (d > SAMURAI.cut.range * 0.7 || !tracking) {
      this.setGoal(t.x, t.z);
      this.moveSpeed = SAMURAI.chaseSpeed;
    } else {
      this.moveSpeed = 0;
      this.lockFacing = true;
      this.face(pl.x, pl.z);
    }
  }

  private patrolTick(): void {
    const wp = this.currentWaypoint();
    if (!wp) {
      this.clearGoal();
      this.moveSpeed = 0;
      return;
    }
    if (Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= SAMURAI.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = SAMURAI.patrolSpeed;
  }

  private transition(next: SamuraiState): void {
    const previous = this.brainState;
    if (!this.fsm.set(next)) return;
    const { ctx } = this.deps;
    const pl = ctx.player.position;
    this.forceHighRate = next !== 'patrol' && next !== 'chase';
    const stop = (): void => {
      this.clearGoal();
      this.moveSpeed = 0;
      this.lockFacing = true;
      this.face(pl.x, pl.z);
    };
    switch (next) {
      case 'chase':
        if (previous === 'patrol') ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
        break;
      case 'cutWindup':
        stop();
        break;
      case 'leapTelegraph':
        stop();
        ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: fxPos.set(pl.x, 0.1, pl.z), scale: SAMURAI.leap.radius, duration: SAMURAI.leap.telegraph + SAMURAI.leap.airTime });
        break;
      case 'leap': {
        this.leapFrom.copy(this.position);
        const dx = pl.x - this.position.x;
        const dz = pl.z - this.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const reach = Math.max(0, Math.min(d, SAMURAI.leap.max) - SAMURAI.leap.standOff);
        // stop where the straight line leaves walkable ground
        const tx = this.position.x + (dx / d) * reach;
        const tz = this.position.z + (dz / d) * reach;
        const k = this.deps.nav.raycastGrid(this.position.x, this.position.z, tx, tz);
        const safe = Math.max(0, k - 0.04);
        this.leapTo.set(this.position.x + (tx - this.position.x) * safe, this.position.y, this.position.z + (tz - this.position.z) * safe);
        this.yaw = this.desiredYaw = Math.atan2(-dx, -dz);
        this.fx('dust', 0, -SAMURAI.centerHeight + 0.2, 0, 1.6);
        break;
      }
      case 'spin':
        this.recentDamage = 0;
        this.spinCooldown = SAMURAI.spin.cooldown + SAMURAI.spin.seconds;
        this.lockFacing = true;
        this.fan.visible = true;
        break;
      case 'dashCharge':
        stop();
        this.dashUsed++;
        this.dashCentre.set(pl.x, 0, pl.z);
        ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: fxPos.set(pl.x, 0.1, pl.z), scale: SAMURAI.dash.radius, duration: SAMURAI.dash.charge });
        break;
      case 'dash':
        this.dashLeft = SAMURAI.dash.count;
        this.dashPause = 0;
        this.dashT = -1;
        break;
      default:
        break;
    }
    if (previous === 'spin' && next !== 'spin') this.fan.visible = false;
  }

  // ---- fixed step -----------------------------------------------------------------------

  override step(dt: number): void {
    if (!this.alive) return;
    this.cutCooldown = Math.max(0, this.cutCooldown - dt);
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);
    this.spinCooldown = Math.max(0, this.spinCooldown - dt);
    this.recentDamage = Math.max(0, this.recentDamage - (SAMURAI.spin.triggerDamage / SAMURAI.spin.window) * 0.5 * dt);
    // ease in and out of a run instead of snapping to full speed (the brain writes the target)
    if (this.moveSpeed !== this.lastSetSpeed) this.speedTarget = this.moveSpeed;
    this.easedSpeed = approach(this.easedSpeed, this.speedTarget, (this.speedTarget > this.easedSpeed ? SAMURAI.acceleration : SAMURAI.deceleration) * dt);
    this.moveSpeed = this.easedSpeed;
    this.lastSetSpeed = this.easedSpeed;
    const t = this.fsm.timeInState;
    const { ctx } = this.deps;
    const pl = ctx.player;
    switch (this.brainState) {
      case 'cutWindup':
        this.face(pl.position.x, pl.position.z);
        if (t >= SAMURAI.cut.windup) {
          this.strike(SAMURAI.cut.range, SAMURAI.cut.halfAngle, SAMURAI.cut.damage, 4, SAMURAI.leap.clearance);
          this.cutCooldown = SAMURAI.cut.cooldown;
          this.transition('cutRecover');
        }
        break;
      case 'cutRecover':
        if (t >= SAMURAI.cut.recover) this.transition('chase');
        break;
      case 'leapTelegraph':
        this.face(pl.position.x, pl.position.z);
        if (t >= SAMURAI.leap.telegraph) this.transition('leap');
        break;
      case 'leap': {
        const k = Math.min(1, t / SAMURAI.leap.airTime);
        this.position.x = this.leapFrom.x + (this.leapTo.x - this.leapFrom.x) * k;
        this.position.z = this.leapFrom.z + (this.leapTo.z - this.leapFrom.z) * k;
        this.lift = 4 * SAMURAI.leap.apex * k * (1 - k);
        this.placeBody();
        if (k >= 1) {
          this.lift = 0;
          this.strike(SAMURAI.leap.radius, SAMURAI.leap.halfAngle, SAMURAI.leap.damage, SAMURAI.leap.knockback, SAMURAI.leap.clearance);
          const fx = -Math.sin(this.yaw) * 1.6;
          const fz = -Math.cos(this.yaw) * 1.6;
          this.fx('spark', fx, -SAMURAI.centerHeight + 0.2, fz, 2.4);
          this.fx('dust', fx, -SAMURAI.centerHeight + 0.2, fz, 2.6);
          ctx.events.emit('vfx:spawn', { kind: 'telegraph-ring', position: fxPos.set(this.position.x + fx, 0.12, this.position.z + fz), scale: SAMURAI.leap.radius, duration: 0.3 });
          this.leapCooldown = SAMURAI.leap.cooldown;
          this.transition('leapRecover');
        }
        break;
      }
      case 'leapRecover':
        if (t >= SAMURAI.leap.recover) this.transition('chase');
        break;
      case 'spin':
        if (t >= SAMURAI.spin.seconds) this.transition('chase');
        break;
      case 'dashCharge':
        this.face(pl.position.x, pl.position.z);
        if (t >= SAMURAI.dash.charge) this.transition('dash');
        break;
      case 'dash':
        this.dashStep(dt);
        break;
      case 'dashRecover':
        if (t >= SAMURAI.dash.recover) this.transition('chase');
        break;
      default:
        break;
    }
    super.step(dt);
  }

  /** Cone attack in front of the samurai. */
  private strike(radius: number, halfAngle: number, damage: number, knockback: number, clearance: number): void {
    const { ctx } = this.deps;
    const pl = ctx.player;
    ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    this.swing = 1;
    if (!pl.alive) return;
    const dx = pl.position.x - this.position.x;
    const dz = pl.position.z - this.position.z;
    const d = Math.hypot(dx, dz);
    const rel = Math.atan2(-dx, -dz) - this.yaw;
    if (!coneHit(d, rel, pl.position.y, radius, halfAngle, clearance)) return;
    hitDir.set(dx / (d || 1), 0, dz / (d || 1));
    pl.applyDamage({ amount: damage, zone: 'body', source: 'enemy', point: this.position, direction: hitDir });
    impulse.copy(hitDir).multiplyScalar(knockback).setY(3);
    pl.addImpulse(impulse);
  }

  private dashStep(dt: number): void {
    const cfg = SAMURAI.dash;
    const { ctx, nav } = this.deps;
    if (this.dashT < 0) {
      this.dashPause -= dt;
      if (this.dashPause > 0) return;
      if (this.dashLeft <= 0) {
        this.transition('dashRecover');
        return;
      }
      this.dashLeft--;
      this.dashFrom.copy(this.position);
      pickDashPoint(this.position.x, this.position.z, this.dashCentre.x, this.dashCentre.z, Math.random, (ax, az, bx, bz) => nav.lineWalkable(ax, az, bx, bz), dashPoint);
      this.dashTo.set(dashPoint.x, this.position.y, dashPoint.z);
      this.dashT = 0;
      this.dashHit = false;
      this.yaw = this.desiredYaw = Math.atan2(-(this.dashTo.x - this.position.x), -(this.dashTo.z - this.position.z));
      return;
    }
    this.dashT += dt / cfg.time;
    const k = Math.min(1, this.dashT);
    this.position.x = this.dashFrom.x + (this.dashTo.x - this.dashFrom.x) * k;
    this.position.z = this.dashFrom.z + (this.dashTo.z - this.dashFrom.z) * k;
    this.placeBody();
    const pl = ctx.player;
    if (!this.dashHit && pl.alive && pl.position.y <= SAMURAI.leap.clearance) {
      if (distanceToSegment(pl.position.x, pl.position.z, this.dashFrom.x, this.dashFrom.z, this.position.x, this.position.z) <= cfg.hitRadius) {
        this.dashHit = true;
        hitDir.set(this.dashTo.x - this.dashFrom.x, 0, this.dashTo.z - this.dashFrom.z).normalize();
        pl.applyDamage({ amount: cfg.damage, zone: 'body', source: 'enemy', point: this.position, direction: hitDir });
        impulse.copy(hitDir).multiplyScalar(4).setY(2);
        pl.addImpulse(impulse);
        ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
      }
    }
    if (k >= 1) {
      this.leaveTrail();
      this.fx('spark', 0, -SAMURAI.centerHeight + 0.3, 0, 1.2);
      this.dashT = -1;
      this.dashPause = cfg.pause;
      this.swing = 1;
    }
  }

  private leaveTrail(): void {
    const tr = this.trails[this.trailNext] as Trail;
    this.trailNext = (this.trailNext + 1) % this.trails.length;
    const dx = this.dashTo.x - this.dashFrom.x;
    const dz = this.dashTo.z - this.dashFrom.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return;
    tr.mesh.position.set((this.dashFrom.x + this.dashTo.x) / 2, 1.3, (this.dashFrom.z + this.dashTo.z) / 2);
    tr.mesh.rotation.set(0, Math.atan2(-dz, dx), 0);
    tr.mesh.scale.set(len, 2.2, 1);
    tr.mesh.visible = true;
    tr.life = 1;
  }

  private placeBody(): void {
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  private fx(kind: 'dust' | 'spark' | 'armor-spark', dx: number, dy: number, dz: number, scale: number): void {
    this.deps.ctx.events.emit('vfx:spawn', { kind, position: fxPos.set(this.position.x + dx, this.position.y + dy, this.position.z + dz), scale });
  }

  // ---- commands / lifecycle -------------------------------------------------------------

  protected onCommand(target: Vector3): void {
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (this.brainState === 'patrol') this.transition('chase');
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') {
      this.lift = 0;
      this.transition('patrol');
    }
    this.clearGoal();
    this.moveSpeed = 0;
  }

  protected override onDestroyed(): void {
    this.removeTrails();
    this.glow.dispose();
    this.fanMat.dispose();
  }

  override dispose(): void {
    this.removeTrails();
    this.glow.dispose();
    this.fanMat.dispose();
    super.dispose();
  }

  private removeTrails(): void {
    for (const t of this.trails) {
      t.mesh.removeFromParent();
      t.mat.dispose();
    }
    this.trails.length = 0;
  }

  // ---- animation ------------------------------------------------------------------------

  override animate(dt: number, time: number): void {
    if (!this.alive) return;
    const travelled = Math.hypot(this.position.x - this.lastX, this.position.z - this.lastZ);
    if (dt > 0) this.speedEstimate += (travelled / dt - this.speedEstimate) * Math.min(1, dt * 10);
    this.lastX = this.position.x;
    this.lastZ = this.position.z;
    const state = this.brainState;
    const t = this.fsm.timeInState;
    // walk cycle driven by the ground actually covered: one cycle per stride, so feet do not slide
    const f = Math.min(1, this.speedEstimate / SAMURAI.chaseSpeed);
    const walking = state === 'patrol' || state === 'chase' || state === 'spin' || state === 'cutRecover' || state === 'leapRecover' || state === 'dashRecover';
    if (walking) this.gait += (travelled / strideLength(this.legLength, f)) * Math.PI * 2;
    const moving = walking && this.speedEstimate > 0.25 ? 1 : 0;
    this.walkAmount += (moving - this.walkAmount) * Math.min(1, dt * 7);
    const pose = gaitPose(this.gait, this.walkAmount, f, this.legLength, this.pose);
    let hipL = pose.left.hip;
    let hipR = pose.right.hip;
    let kneeL = pose.left.knee;
    let kneeR = pose.right.knee;
    let crouch = 0;
    let lean = 0.05 + 0.14 * f * this.walkAmount;
    let weaponZ = this.restAngle + Math.sin(time * 1.4 + this.seed * 6) * 0.03 + pose.twist * 0.4;
    let weaponX = 0;
    let glow = 2.4;
    this.swing = Math.max(0, this.swing - dt * 4);
    /** Both knees bent by `k` (0..1): thighs forward, shins back, pelvis lowered to keep the feet down. */
    const squat = (k: number): void => {
      hipL += 0.55 * k;
      hipR += 0.55 * k;
      kneeL -= 1.1 * k;
      kneeR -= 1.1 * k;
      crouch = this.legLength * 0.14 * k;
    };

    switch (state) {
      case 'cutWindup': {
        const k = Math.min(1, t / SAMURAI.cut.windup);
        weaponZ = this.restAngle + 0.9 * k;
        weaponX = -0.5 * k;
        // step into the cut: front leg forward, rear leg braced
        hipL += 0.35 * k;
        kneeL -= 0.45 * k;
        hipR -= 0.3 * k;
        crouch = 0.06 * k;
        break;
      }
      case 'leapTelegraph': {
        const k = Math.min(1, t / SAMURAI.leap.telegraph);
        squat(k);
        weaponZ = this.restAngle + 0.85 * k;
        lean = 0.25 * k;
        glow = 2.4 + 3 * k;
        break;
      }
      case 'leap': {
        // legs tucked on the way up, front leg reaching for the ground on the way down
        const k = Math.min(1, t / SAMURAI.leap.airTime);
        hipL = 0.9 - 0.5 * k;
        kneeL = -1.3 + 0.9 * k;
        hipR = -0.3 - 0.3 * k;
        kneeR = -1.2 + 0.2 * k;
        weaponZ = Math.PI / 2;
        weaponX = -0.9;
        lean = 0.35;
        glow = 5;
        break;
      }
      case 'leapRecover': {
        // absorbs the landing
        const k = Math.max(0, 1 - t / (SAMURAI.leap.recover * 0.7));
        squat(k * 0.8);
        break;
      }
      case 'spin':
        this.spinAngle += dt * SAMURAI.spin.spinRate;
        weaponZ = this.spinAngle;
        lean = 0.05;
        glow = 4;
        // braced stance behind the fan
        hipL += 0.25;
        hipR -= 0.2;
        kneeL -= 0.3;
        crouch += 0.05;
        break;
      case 'dashCharge': {
        const k = Math.min(1, t / SAMURAI.dash.charge);
        squat(k * 0.9);
        hipR -= 0.5 * k;
        weaponZ = this.restAngle - 1.0 * k;
        lean = 0.3 * k;
        glow = 2.4 + 7 * k * (0.75 + 0.25 * Math.sin(time * 40));
        break;
      }
      case 'dash':
        hipL = 0.9;
        kneeL = -0.7;
        hipR = -0.8;
        kneeR = -0.5;
        weaponZ = 0.1;
        weaponX = 0.3;
        lean = 0.5;
        glow = 8;
        break;
      default:
        break;
    }
    // follow-through of a cut / cleave
    if (this.swing > 0 && state !== 'spin') {
      weaponZ = this.restAngle - 1.5 * this.swing;
      weaponX = 0.5 * this.swing;
    }
    this.thighL.rotation.x = hipL;
    this.thighR.rotation.x = hipR;
    this.shinL.rotation.x = kneeL;
    this.shinR.rotation.x = kneeR;
    this.model.position.y = this.lift - crouch + pose.bob;
    // the torso leans into the run, sways over the standing leg and twists against the legs
    this.upper.rotation.set(-lean, pose.twist, pose.sway);
    this.model.rotation.x = 0;
    this.weapon.rotation.z = weaponZ;
    this.weapon.rotation.x = weaponX;
    this.cloth.rotation.x = 0.25 * f * this.walkAmount + Math.abs(pose.left.hip) * 0.2 + Math.sin(time * 3 + this.seed * 9) * 0.06 + (state === 'leap' || state === 'dash' ? 0.6 : 0);
    this.glow.emissiveIntensity = glow;
    if (this.fan.visible) {
      const k = Math.min(1, t * 6) * Math.min(1, (SAMURAI.spin.seconds - t) * 6);
      this.fanMat.opacity = Math.max(0, 0.11 * k) * (0.8 + 0.2 * Math.sin(time * 50));
    }
    for (const tr of this.trails) {
      if (tr.life <= 0) continue;
      tr.life -= dt / SAMURAI.dash.trailSeconds;
      (tr.mat.uniforms.uAlpha as { value: number }).value = Math.max(0, tr.life) * 0.32;
      (tr.mat.uniforms.uTime as { value: number }).value = time;
      if (tr.life <= 0) tr.mesh.visible = false;
    }
    this.root.position.y = this.position.y;
  }
}
