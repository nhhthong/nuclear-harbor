/**
 * Pure flight maths of the drone (spec 29): no three.js scene, no physics world. The world is seen through a
 * `Probe`, a sphere cast of the drone's body radius against static geometry (Rapier `castShape` in the game,
 * a list of boxes in the tests). Invariant kept by `clampStep`: a move never brings the sphere closer than
 * `skin` to the first surface along the move, so a drone that starts in free space never enters a wall or
 * the roof.
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Distance the body sphere can travel from `origin` along unit `dir` before touching static geometry; null = free up to `maxDistance`. */
export type Probe = (origin: V3, dir: V3, maxDistance: number) => number | null;

export interface SteerConfig {
  lookAhead: number;
  yawOffsets: readonly number[];
  pitchOffsets: readonly number[];
}

export function freeDistance(probe: Probe, from: V3, dir: V3, max: number): number {
  const d = probe(from, dir, max);
  return d === null ? max : Math.max(0, Math.min(max, d));
}

function setDir(out: V3, yaw: number, pitch: number): V3 {
  const c = Math.cos(pitch);
  out.x = Math.sin(yaw) * c;
  out.y = Math.sin(pitch);
  out.z = Math.cos(yaw) * c;
  return out;
}

const cand = { x: 0, y: 0, z: 0 };
const dirNow = { x: 0, y: 0, z: 0 };

/**
 * Obstacle avoidance: returns `desired` (unit) when the way is free for `lookAhead`, otherwise the candidate
 * (yaw and pitch offsets around `desired`) with the best mix of free distance and alignment. When nothing is
 * free at all, the result is straight up (the unstick logic then turns). `mem` remembers the side (left/right of
 * `desired`) picked when the way got blocked: the drone keeps going round on that side until the way is free again,
 * instead of flip-flopping in front of a wide wall. Writes into `out`.
 */
export function chooseDirection(probe: Probe, from: V3, desired: V3, cfg: SteerConfig, out: V3, mem: SteerMemory = { side: 0 }): V3 {
  const len = Math.hypot(desired.x, desired.y, desired.z);
  if (len < 1e-6) {
    out.x = 0;
    out.y = 0;
    out.z = 0;
    return out;
  }
  const dx = desired.x / len;
  const dy = desired.y / len;
  const dz = desired.z / len;
  dirNow.x = dx;
  dirNow.y = dy;
  dirNow.z = dz;
  if (freeDistance(probe, from, dirNow, cfg.lookAhead) >= cfg.lookAhead) {
    out.x = dx;
    out.y = dy;
    out.z = dz;
    mem.side = 0;
    return out;
  }
  const horiz = Math.hypot(dx, dz);
  const yaw0 = horiz > 1e-4 ? Math.atan2(dx, dz) : 0;
  const pitch0 = Math.asin(Math.max(-1, Math.min(1, dy)));
  let best = -Infinity;
  let found = false;
  let bestYaw = 0;
  for (const p of cfg.pitchOffsets) {
    const pitch = Math.max(-1.2, Math.min(1.2, pitch0 + p));
    for (let i = -1; i < cfg.yawOffsets.length; i++) {
      const y = i < 0 ? 0 : (cfg.yawOffsets[i] ?? 0);
      // committed to a side: only straight ahead (pitched) or that side; a half turn counts for both sides
      if (mem.side !== 0 && y !== 0 && Math.abs(y) < Math.PI - 1e-3 && Math.sign(y) !== mem.side) continue;
      setDir(cand, yaw0 + y, pitch);
      const free = freeDistance(probe, from, cand, cfg.lookAhead);
      if (free < 0.05) continue;
      const align = cand.x * dx + cand.y * dy + cand.z * dz;
      const score = (2 * free) / cfg.lookAhead + align;
      if (score > best) {
        best = score;
        found = true;
        bestYaw = y;
        out.x = cand.x;
        out.y = cand.y;
        out.z = cand.z;
      }
    }
  }
  if (!found) {
    out.x = 0;
    out.y = 1;
    out.z = 0;
  } else if (mem.side === 0 && bestYaw !== 0) {
    mem.side = Math.sign(bestYaw);
  }
  return out;
}

/** Side memory of `chooseDirection`: 0 = free, 1 / -1 = going round an obstacle on that side. */
export interface SteerMemory {
  side: number;
}

/** Length of a move of up to `dist` along unit `dir` that keeps `skin` metres from the first surface. */
export function clampStep(probe: Probe, from: V3, dir: V3, dist: number, skin: number): number {
  if (dist <= 0) return 0;
  const hit = probe(from, dir, dist + skin);
  if (hit === null) return dist;
  return Math.max(0, Math.min(dist, hit - skin));
}

export interface Band {
  min: number;
  max: number;
}

/** Cruise band: `cruiseMin..cruiseMax` above the floor under the drone, kept `ceilingMargin` below a ceiling. */
export function altitudeBand(
  floorY: number,
  ceilY: number | null,
  cfg: { cruiseMin: number; cruiseMax: number; ceilingMargin: number },
  out: Band = { min: 0, max: 0 },
): Band {
  out.min = floorY + cfg.cruiseMin;
  out.max = floorY + cfg.cruiseMax;
  if (ceilY !== null) out.max = Math.min(out.max, ceilY - cfg.ceilingMargin);
  // a low room: fly as high as the ceiling allows, but never below half the band minimum above the floor
  if (out.min > out.max) out.min = Math.max(floorY + cfg.cruiseMin * 0.5, Math.min(out.min, out.max));
  if (out.min > out.max) out.max = out.min;
  return out;
}

export function clampToBand(y: number, band: Band): number {
  return Math.max(band.min, Math.min(band.max, y));
}

/**
 * Stand-off point around the player (horizontal): same bearing from the player as the drone, led by `lead`
 * radians in the orbit direction, at a radius clamped into `min..max`. Writes x and z of `out`.
 */
export function standoffTarget(
  drone: { x: number; z: number },
  player: { x: number; z: number },
  orbitDir: number,
  cfg: { standoffMin: number; standoffMax: number; orbitLead: number },
  out: V3,
): V3 {
  const dx = drone.x - player.x;
  const dz = drone.z - player.z;
  const d = Math.hypot(dx, dz);
  const angle = (d > 1e-4 ? Math.atan2(dz, dx) : 0) + orbitDir * cfg.orbitLead;
  const r = Math.max(cfg.standoffMin, Math.min(cfg.standoffMax, d));
  out.x = player.x + Math.cos(angle) * r;
  out.z = player.z + Math.sin(angle) * r;
  return out;
}

/**
 * Pulls `to` back towards `from` so the segment between them is free for the body sphere: the result is never
 * inside or behind a wall as seen from `from` (a stand-off point is resolved from the player's eye, so it stays
 * in the player's room).
 */
export function resolveTarget(probe: Probe, from: V3, to: V3, skin: number, out: V3): V3 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) {
    out.x = to.x;
    out.y = to.y;
    out.z = to.z;
    return out;
  }
  const hit = probe(from, { x: dx / len, y: dy / len, z: dz / len }, len);
  const t = hit === null ? 1 : Math.max(0, hit - skin) / len;
  out.x = from.x + dx * t;
  out.y = from.y + dy * t;
  out.z = from.z + dz * t;
  return out;
}

export interface RectXZ {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Moves a point that lies inside `r` to just beyond its nearest edge (no-op outside). */
export function keepOutOf(r: RectXZ, p: V3, margin = 0.5): V3 {
  if (p.x < r.minX || p.x > r.maxX || p.z < r.minZ || p.z > r.maxZ) return p;
  const toW = p.x - r.minX;
  const toE = r.maxX - p.x;
  const toN = p.z - r.minZ;
  const toS = r.maxZ - p.z;
  const m = Math.min(toW, toE, toN, toS);
  if (m === toW) p.x = r.minX - margin;
  else if (m === toN) p.z = r.minZ - margin;
  else if (m === toE) p.x = r.maxX + margin;
  else p.z = r.maxZ + margin;
  return p;
}

/**
 * Stuck detection: while the drone wants to move (target farther than the arrive radius), it must cover `progress`
 * metres (net) within each `window` seconds. `update` returns true once when it did not (the caller climbs, then
 * turns). Net displacement, not distance to the target: an orbit target that leads the drone stays at the same
 * distance while the drone flies freely.
 */
export class StuckMonitor {
  private t = 0;
  private sx = NaN;
  private sy = 0;
  private sz = 0;

  constructor(private readonly cfg: { window: number; progress: number }) {}

  update(dt: number, p: V3, wantsToMove: boolean): boolean {
    if (!wantsToMove || Number.isNaN(this.sx)) {
      this.start(p);
      return false;
    }
    this.t += dt;
    if (this.t < this.cfg.window) return false;
    const moved = Math.hypot(p.x - this.sx, p.y - this.sy, p.z - this.sz);
    this.start(p);
    return moved < this.cfg.progress;
  }

  private start(p: V3): void {
    this.t = 0;
    this.sx = p.x;
    this.sy = p.y;
    this.sz = p.z;
  }

  reset(): void {
    this.t = 0;
    this.sx = NaN;
  }
}
