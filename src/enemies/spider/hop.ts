/** A hop is allowed when only a low obstacle is in the way and there is somewhere to land. */
export function canHop(lowRayBlocked: boolean, highRayBlocked: boolean, landingWalkable: boolean): boolean {
  return lowRayBlocked && !highRayBlocked && landingWalkable;
}

/** Height above the ground of a parabolic hop at progress t (0..1) with the given apex. */
export function hopHeight(t: number, apex: number): number {
  if (t <= 0 || t >= 1) return 0;
  return 4 * apex * t * (1 - t);
}

/** Linear interpolation of one horizontal coordinate, clamped to t in 0..1. */
export function hopLerp(from: number, to: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return from + (to - from) * k;
}
