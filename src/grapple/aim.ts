import type { Vec3Like } from './GrappleState';

/** Angle in radians between the view direction (unit) and the direction from `eye` to `point`. */
export function angleBetween(eye: Vec3Like, dir: Vec3Like, point: Vec3Like): number {
  const dx = point.x - eye.x;
  const dy = point.y - eye.y;
  const dz = point.z - eye.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return 0;
  const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / len;
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/** The candidate closest to the view axis whose angle is within `maxAngle` radians, or null. */
export function bestInCone<T extends { position: Vec3Like }>(
  eye: Vec3Like,
  dir: Vec3Like,
  candidates: readonly T[],
  maxAngle: number,
): T | null {
  let best: T | null = null;
  let bestAngle = maxAngle;
  for (const c of candidates) {
    const a = angleBetween(eye, dir, c.position);
    if (a <= bestAngle) {
      best = c;
      bestAngle = a;
    }
  }
  return best;
}
