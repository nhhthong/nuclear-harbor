/** Smooth body motion of the mech: bounded acceleration and turn rate (pure, no allocation). */
export interface Motion {
  /** Current forward speed (m/s, >= 0). */
  speed: number;
  /** Current yaw (rad). */
  yaw: number;
}

export interface MotionLimits {
  accel: number;
  decel: number;
  /** rad/s */
  turnRate: number;
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDiff(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Advances `m` by `dt`: yaw turns towards `desiredYaw` at most `turnRate`, speed approaches the
 * target (reduced while the heading error is large, so the mech turns before it walks) at most
 * `accel` (speeding up) or `decel` (slowing down) per second. With `gateByHeading` false (strafing,
 * backing off while facing the target) the speed is not reduced by the heading error. Returns the new speed.
 */
export function stepMotion(
  m: Motion,
  targetSpeed: number,
  desiredYaw: number,
  dt: number,
  lim: MotionLimits,
  gateByHeading = true,
): number {
  const diff = angleDiff(m.yaw, desiredYaw);
  const maxTurn = lim.turnRate * dt;
  m.yaw += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
  const error = Math.abs(angleDiff(m.yaw, desiredYaw));
  // full speed within ~20 deg, standstill beyond ~100 deg
  const align = gateByHeading ? Math.min(1, Math.max(0, 1 - (error - 0.35) / 1.4)) : 1;
  const target = targetSpeed * align;
  const rate = target > m.speed ? lim.accel : lim.decel;
  const delta = target - m.speed;
  const maxDelta = rate * dt;
  m.speed += Math.abs(delta) <= maxDelta ? delta : Math.sign(delta) * maxDelta;
  return m.speed;
}
