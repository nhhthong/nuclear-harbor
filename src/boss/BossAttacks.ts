/**
 * Geometry helpers shared by the boss module (pure, unit tested). The skills themselves are in `skills.ts`.
 */

export interface XZ {
  x: number;
  z: number;
}

/** Clamp a point into the arena disc (radius minus margin). */
export function clampToArena(p: XZ, centre: XZ, radius: number, margin: number): XZ {
  const max = Math.max(0, radius - margin);
  const dx = p.x - centre.x;
  const dz = p.z - centre.z;
  const d = Math.hypot(dx, dz);
  if (d <= max || d === 0) return { x: p.x, z: p.z };
  return { x: centre.x + (dx / d) * max, z: centre.z + (dz / d) * max };
}

/** -1 retreat, 0 hold, +1 advance: keeps the boss inside the preferred distance band. */
export function rangeIntent(distance: number, min: number, max: number): -1 | 0 | 1 {
  if (distance > max) return 1;
  if (distance < min) return -1;
  return 0;
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Splash danger: distance from the blast point to the player's centre. */
export function inSplash(blast: { x: number; y: number; z: number }, centre: { x: number; y: number; z: number }, radius: number): boolean {
  return Math.hypot(blast.x - centre.x, blast.y - centre.y, blast.z - centre.z) <= radius;
}
