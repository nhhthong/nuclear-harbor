import type { BossAttackId } from '@/core/types';
import { BOSS } from '@/config/tunables';
import type { XZ } from './BossAttacks';
import { CRAB } from './tunables';

/**
 * Pure logic of the Gunslinger Crab Mech's skills (spec 27-crab-boss; spec 34: no spin, two claw skills in phase two): selection by distance and
 * cooldown, bomb pattern, drone cap, laser beam angles and hit test, spin sweep contacts. Everything
 * the scene needs is computed here and unit tested; `index.ts` only glues it to the world.
 * `k` is the size factor of the boss (1 on the harbor, smaller in the sandbox): it scales distances.
 */

export type SkillId = 'bombs' | 'drones' | 'laser' | 'grab' | 'quake';

export const SKILLS: readonly SkillId[] = ['bombs', 'drones', 'laser', 'grab', 'quake'];

/** Event id of each skill (`boss:attackTelegraph` / `boss:attack`). */
export const SKILL_ATTACK: Record<SkillId, BossAttackId> = {
  bombs: 'carpet-bombs',
  drones: 'drone-release',
  laser: 'quad-laser',
  grab: 'claw-grab',
  quake: 'claw-quake',
};

export type { XZ };

export interface SkillInput {
  /** Horizontal distance boss to player (m). */
  distance: number;
  /** Drones alive right now. */
  aliveDrones: number;
  /** Size factor of the boss (distances in `CRAB` are multiplied by it). */
  k: number;
  /** Share of the boss HP left (0..1); the claw skills need it below `CRAB.phase2.below`. */
  hpFraction: number;
}

/** Phase two: the boss has less than half of its HP left. */
export function inPhaseTwo(hpFraction: number): boolean {
  return hpFraction < CRAB.phase2.below;
}

export type SkillWeights = Record<SkillId, number>;

/** Weight of every skill for this situation; 0 means "not eligible" (cooldown, range, drone cap). */
export function skillWeights(input: SkillInput, cooldowns: Readonly<Record<SkillId, number>>, last: SkillId | null, out?: SkillWeights): SkillWeights {
  const w = out ?? { bombs: 0, drones: 0, laser: 0, grab: 0, quake: 0 };
  const d = input.distance / input.k;
  const far = d >= CRAB.farDistance;
  const r = CRAB.ranges;
  const W = CRAB.weights;
  w.bombs = cooldowns.bombs <= 0 && d >= r.bombsMin && d <= r.bombsMax ? (far ? W.bombs.far : W.bombs.near) : 0;
  w.drones = cooldowns.drones <= 0 && canReleaseDrones(input.aliveDrones) && d >= r.dronesMin && d <= r.dronesMax ? (far ? W.drones.far : W.drones.near) : 0;
  w.laser = cooldowns.laser <= 0 && d >= r.laserMin && d <= r.laserMax ? (far ? W.laser.far : W.laser.near) : 0;
  const two = inPhaseTwo(input.hpFraction);
  w.grab = two && cooldowns.grab <= 0 && d >= CRAB.grab.minRange && d <= CRAB.grab.maxRange ? W.grab : 0;
  w.quake = two && cooldowns.quake <= 0 && d <= CRAB.quake.maxRange ? W.quake : 0;
  // never the same skill twice in a row when anything else can run
  if (last) {
    let other = 0;
    for (const s of SKILLS) if (s !== last) other += w[s];
    if (other > 0) w[last] = 0;
  }
  return w;
}

/** Weighted random pick (`rand` in [0, 1)); null when nothing is eligible. */
export function pickSkill(weights: Readonly<SkillWeights>, rand: number): SkillId | null {
  let total = 0;
  for (const s of SKILLS) total += weights[s];
  if (total <= 0) return null;
  let x = rand * total;
  for (const s of SKILLS) {
    if (weights[s] <= 0) continue;
    x -= weights[s];
    if (x < 0) return s;
  }
  for (let i = SKILLS.length - 1; i >= 0; i--) {
    const s = SKILLS[i];
    if (s && weights[s] > 0) return s;
  }
  return null;
}

/**
 * One skill at a time: cooldown per skill, a short idle gap after each skill, weighted choice.
 * `update` returns the skill to start (the caller runs it and calls `finish` when it is over).
 */
export class SkillScheduler {
  readonly cooldowns: Record<SkillId, number> = { bombs: 0, drones: 0, laser: 0, grab: 0, quake: 0 };
  private gap: number = CRAB.idleGap[1];
  private running: SkillId | null = null;
  private last: SkillId | null = null;
  private readonly weights: SkillWeights = { bombs: 0, drones: 0, laser: 0, grab: 0, quake: 0 };

  get active(): SkillId | null {
    return this.running;
  }

  get idle(): boolean {
    return this.running === null;
  }

  reset(): void {
    this.running = null;
    this.last = null;
    this.gap = CRAB.idleGap[1];
    for (const s of SKILLS) this.cooldowns[s] = 0;
  }

  update(dt: number, input: SkillInput, rand: () => number): SkillId | null {
    for (const s of SKILLS) this.cooldowns[s] = Math.max(0, this.cooldowns[s] - dt);
    if (this.running) return null;
    this.gap = Math.max(0, this.gap - dt);
    if (this.gap > 0) return null;
    const pick = pickSkill(skillWeights(input, this.cooldowns, this.last, this.weights), rand());
    if (pick) this.start(pick);
    return pick;
  }

  /** Start a skill now regardless of range, cooldown and gap (test hook). False while another runs. */
  force(skill: SkillId): boolean {
    if (this.running) return false;
    this.start(skill);
    return true;
  }

  private start(skill: SkillId): void {
    this.running = skill;
    this.last = skill;
    this.cooldowns[skill] = CRAB.cooldown[skill];
  }

  /** The skill is over: idle gap (random in the configured range) before the next one. */
  finish(rand: () => number): void {
    this.running = null;
    this.gap = CRAB.idleGap[0] + rand() * (CRAB.idleGap[1] - CRAB.idleGap[0]);
  }
}

// ---- carpet bombs ------------------------------------------------------------------------------------

export interface BombSpec {
  x: number;
  z: number;
  /** Seconds after the skill's active phase starts. */
  delay: number;
}

/**
 * A line of bombs from the boss towards the player (and a little past), then a ring around the player.
 * Launch order: the line first, the ring right after, so the player has to keep moving.
 */
export function bombPattern(boss: XZ, player: XZ, k: number, rand: () => number, out: BombSpec[] = []): BombSpec[] {
  out.length = 0;
  const B = CRAB.bombs;
  let dx = player.x - boss.x;
  let dz = player.z - boss.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) {
    dx = 0;
    dz = -1;
  } else {
    dx /= d;
    dz /= d;
  }
  // the line ends on the player when the player is far enough, else it is as long as configured
  const spacing = B.lineSpacing * k;
  const start = B.lineStart * k;
  for (let i = 0; i < B.lineCount; i++) {
    const t = start + i * spacing;
    out.push({ x: boss.x + dx * t, z: boss.z + dz * t, delay: i * B.launchGap });
  }
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < B.ringCount; i++) {
    const a = phase + (i / B.ringCount) * Math.PI * 2;
    out.push({
      x: player.x + Math.cos(a) * B.ringRadius * k,
      z: player.z + Math.sin(a) * B.ringRadius * k,
      delay: (B.lineCount + i) * B.launchGap,
    });
  }
  return out;
}

/** Bomb damage with linear falloff: full at the centre, `edgeFalloff` of it at the edge, 0 outside. */
export function bombDamage(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  const B = CRAB.bombs;
  const f = 1 - (1 - B.edgeFalloff) * (Math.max(0, dist) / radius);
  return B.damage * f;
}

// ---- drones ------------------------------------------------------------------------------------------

/** Re-release only when fewer than `reReleaseBelow` drones are alive. */
export function canReleaseDrones(alive: number): boolean {
  return alive < CRAB.drones.reReleaseBelow;
}

/** 3 to 4 drones, never more than the cap alive at once. `rand` in [0, 1). */
export function droneReleaseCount(alive: number, rand: number): number {
  const D = CRAB.drones;
  const want = D.min + Math.floor(rand * (D.max - D.min + 1));
  return Math.max(0, Math.min(want, D.cap - alive));
}

/** Position on the hover ring around a centre (xz) at the given angle and radius. */
export function orbitPoint(centre: XZ, radius: number, angle: number, out: XZ): XZ {
  out.x = centre.x + Math.cos(angle) * radius;
  out.z = centre.z + Math.sin(angle) * radius;
  return out;
}

/** Clamp a hover radius into the 4 to 9 m band. */
export function clampOrbitRadius(r: number): number {
  return Math.min(CRAB.drones.orbitMax, Math.max(CRAB.drones.orbitMin, r));
}

// ---- claw grab (spec 34) -----------------------------------------------------------------------------

/** The claw point: `reach` metres in front of the body centre along the boss's facing (yaw 0 faces -Z). */
export function clawPoint(boss: XZ, yaw: number, k: number, out: XZ): XZ {
  out.x = boss.x - Math.sin(yaw) * CRAB.grab.reach * k;
  out.z = boss.z - Math.cos(yaw) * CRAB.grab.reach * k;
  return out;
}

/**
 * Where the body centre ends up after the lunge: far enough that the claw point lands on `target`, at most
 * `lungeMax` away, and never backwards (a target already within reach is not approached).
 */
export function lungeEnd(boss: XZ, target: XZ, k: number, out: XZ): XZ {
  const dx = target.x - boss.x;
  const dz = target.z - boss.z;
  const d = Math.hypot(dx, dz);
  const travel = Math.min(CRAB.grab.lungeMax * k, Math.max(0, d - CRAB.grab.reach * k));
  if (d < 1e-6) {
    out.x = boss.x;
    out.z = boss.z;
    return out;
  }
  out.x = boss.x + (dx / d) * travel;
  out.z = boss.z + (dz / d) * travel;
  return out;
}

/** Do the claws close on the player? Within `radius` of the claw point and not above `maxPlayerHeight` (a jump dodges it). */
export function grabConnects(claw: XZ, player: { x: number; y: number; z: number }, k: number): boolean {
  const G = CRAB.grab;
  if (player.y > G.maxPlayerHeight * k) return false;
  return Math.hypot(player.x - claw.x, player.z - claw.z) <= G.radius * k;
}

export type GrabStage = 'lift' | 'hold' | 'slam' | 'done';

/** Total length of a carry: lift, hold, slam (s). */
export const GRAB_CARRY_SECONDS: number = CRAB.grab.liftTime + CRAB.grab.holdTime + CRAB.grab.slamTime;

/** Height of the carried player `t` seconds after the claws closed: eased lift, a held hover, an accelerating slam. */
export function grabCarry(t: number, k: number): { y: number; stage: GrabStage } {
  const G = CRAB.grab;
  const H = G.liftHeight * k;
  if (t < G.liftTime) {
    const u = Math.max(0, t) / G.liftTime;
    return { y: H * u * u * (3 - 2 * u), stage: 'lift' };
  }
  if (t < G.liftTime + G.holdTime) return { y: H, stage: 'hold' };
  const u = (t - G.liftTime - G.holdTime) / G.slamTime;
  if (u < 1 - 1e-9) return { y: H * (1 - u * u), stage: 'slam' };
  return { y: 0, stage: 'done' };
}

// ---- claw quake (spec 34) ----------------------------------------------------------------------------

/**
 * The expanding rings of a quake. `launch` starts one at `startRadius`; `step` grows them and returns how many
 * hit the player this step: a ring hurts once, when its band (`thickness`) sweeps over a player whose feet are
 * below `safeHeight`. A ring that passes while the player is in the air is harmless.
 */
export class QuakeWaves {
  private readonly rings: Array<{ r: number; hit: boolean }> = [];

  get live(): number {
    return this.rings.length;
  }

  /** Radii of the live rings (metres, already scaled), for the visuals. */
  radii(out: number[] = []): number[] {
    out.length = 0;
    for (const w of this.rings) out.push(w.r);
    return out;
  }

  reset(): void {
    this.rings.length = 0;
  }

  launch(k: number): void {
    this.rings.push({ r: CRAB.quake.startRadius * k, hit: false });
  }

  step(dt: number, playerDist: number, playerY: number, k: number): number {
    const Q = CRAB.quake;
    const half = (Q.thickness * k) / 2;
    let hits = 0;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const w = this.rings[i];
      if (!w) continue;
      const before = w.r;
      w.r += Q.speed * k * dt;
      if (!w.hit && playerY <= Q.safeHeight * k && playerDist >= before - half && playerDist <= w.r + half) {
        w.hit = true;
        hits++;
      }
      if (w.r - half > Q.maxRadius * k) this.rings.splice(i, 1);
    }
    return hits;
  }
}

/** Seconds from the first pound until the last ring has left the arena (the skill's active length). */
export function quakeDuration(k = 1): number {
  const Q = CRAB.quake;
  return (Q.count - 1) * Q.interval + (Q.maxRadius - Q.startRadius) / Q.speed + Q.thickness / Q.speed + Q.recover * k;
}

// ---- four-way laser -----------------------------------------------------------------------------------

/** Angles of the beams (rad) of an evenly spaced cross rotated by `base`. */
export function beamAngles(base: number, count: number, out: number[] = []): number[] {
  out.length = 0;
  for (let i = 0; i < count; i++) out.push(base + (i / count) * Math.PI * 2);
  return out;
}

/** Base angle of the cross `t` seconds into the fire phase: linear sweep of `sweep` over `duration`, direction `dir` (+1/-1). */
export function laserBase(start: number, dir: 1 | -1, t: number): number {
  const L = CRAB.laser;
  return start + dir * L.sweep * Math.min(1, Math.max(0, t / L.duration));
}

/** Unit direction (xz) of a beam angle in the the boss's facing convention (angle 0 = -Z, turning left). */
export function beamDirection(angle: number, out: XZ): XZ {
  out.x = -Math.sin(angle);
  out.z = -Math.cos(angle);
  return out;
}

/**
 * Does the beam from `origin` along `angle`, `length` long, touch the player? Horizontal distance from the
 * player's centre to the beam segment within half the width, and the player's body overlaps the beam band
 * vertically (so a jump above `top` clears it).
 */
export function beamHitsPlayer(origin: XZ, angle: number, length: number, player: { x: number; y: number; z: number }, startRadius = 0, playerHeight = 1.8, playerRadius = 0.35): boolean {
  const L = CRAB.laser;
  if (player.y > L.top || player.y + playerHeight < L.bottom) return false;
  const dx = -Math.sin(angle);
  const dz = -Math.cos(angle);
  const px = player.x - origin.x;
  const pz = player.z - origin.z;
  const along = px * dx + pz * dz;
  if (along < startRadius || along > length) return false;
  const across = Math.abs(px * -dz + pz * dx);
  return across <= L.width / 2 + playerRadius;
}

/** Damage ticks: `step` returns how many ticks fired while touching (timer resets when not touching). */
export class TickTimer {
  private t = 0;

  reset(): void {
    this.t = 0;
  }

  step(dt: number, touching: boolean): number {
    if (!touching) {
      this.t = 0;
      return 0;
    }
    if (this.t === 0) {
      this.t = CRAB.laser.tickEvery;
      return 1;
    }
    this.t -= dt;
    if (this.t <= 0) {
      this.t += CRAB.laser.tickEvery;
      return 1;
    }
    return 0;
  }
}

// ---- hp ------------------------------------------------------------------------------------------------

/** One HP pool. Kept here so the ammo budget test and the model share the number. */
export const BOSS_TOTAL_HP: number = BOSS.hp;
