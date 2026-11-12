/** Pure player movement maths (no three.js objects, no physics). Y is up, yaw 0 looks along -Z. */

export interface Vec2Out {
  x: number;
  z: number;
}

/**
 * Desired horizontal velocity from a move axis (x = right, y = forward), yaw and speed.
 * Diagonals are normalised so they are never faster than straight movement.
 */
export function desiredVelocity(axisX: number, axisY: number, yaw: number, speed: number, out: Vec2Out): Vec2Out {
  const len = Math.hypot(axisX, axisY);
  if (len < 1e-6) {
    out.x = 0;
    out.z = 0;
    return out;
  }
  const ax = axisX / len;
  const ay = axisY / len;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  out.x = (-sin * ay + cos * ax) * speed;
  out.z = (-cos * ay - sin * ax) * speed;
  return out;
}

/**
 * Move the horizontal velocity `vel` towards `target` by at most `accel * dt` (when a target
 * speed is requested) or `decel * dt` (when stopping). `control` scales both (air control).
 */
export function approachHorizontal(
  vel: Vec2Out,
  target: Vec2Out,
  accel: number,
  decel: number,
  dt: number,
  control = 1,
): Vec2Out {
  const dx = target.x - vel.x;
  const dz = target.z - vel.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-9) return vel;
  const wantsMove = target.x !== 0 || target.z !== 0;
  const maxStep = (wantsMove ? accel : decel) * control * dt;
  if (dist <= maxStep) {
    vel.x = target.x;
    vel.z = target.z;
  } else {
    vel.x += (dx / dist) * maxStep;
    vel.z += (dz / dist) * maxStep;
  }
  return vel;
}

export function clampPitch(pitch: number, maxPitchDeg: number): number {
  const max = (maxPitchDeg * Math.PI) / 180;
  return Math.max(-max, Math.min(max, pitch));
}

/** Sprint only while grounded, pushing forward and with the sprint key held. */
export function canSprint(grounded: boolean, axisY: number, sprintHeld: boolean): boolean {
  return grounded && axisY > 0 && sprintHeld;
}
