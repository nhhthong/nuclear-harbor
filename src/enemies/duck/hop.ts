/** Phase of a hop cycle: u in [0,1), grounded for the first `landFraction`. */
export function hopPhase(time: number, period: number): number {
  const u = (time / period) % 1;
  return u < 0 ? u + 1 : u;
}

/** True while the duck is on the ground (landing squash, movement paused). */
export function isGrounded(u: number, landFraction: number): boolean {
  return u < landFraction;
}

/** Parabolic height 0..height over the airborne part of the cycle (0 while grounded). */
export function hopArc(u: number, landFraction: number, height: number): number {
  if (u < landFraction) return 0;
  const v = (u - landFraction) / (1 - landFraction);
  return 4 * height * v * (1 - v);
}

/** Horizontal speed factor so that the average over a cycle equals the nominal speed. */
export function hopSpeedFactor(u: number, landFraction: number): number {
  return u < landFraction ? 0 : 1 / (1 - landFraction);
}
