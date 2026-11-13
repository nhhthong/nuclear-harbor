import { DINO } from './tunables';

/** Stomp damage at horizontal `distance` from the landing point: linear falloff to the edge. */
export function stompDamage(distance: number): number {
  const s = DINO.skills.leapStomp;
  if (distance > s.radius) return 0;
  const t = Math.max(0, distance) / s.radius;
  return s.damage * (1 - t * (1 - s.edgeFraction));
}

/** Tail ring: inside the radius and not lifted above the clearance (feet height above ground). */
export function tailRingHit(distance: number, feetAboveGround: number): boolean {
  const t = DINO.skills.tailSpin;
  return distance <= t.radius && feetAboveGround <= t.clearance;
}

const TAU = Math.PI * 2;

function wrap(a: number): number {
  return ((a % TAU) + TAU) % TAU;
}

/**
 * True when the sweeping tail (angle moved from `prev` to `next`, radians, increasing) passed the
 * bearing `target`, widened by `halfWidth`.
 */
export function angleInSweep(prev: number, next: number, target: number, halfWidth: number): boolean {
  const span = next - prev;
  if (span <= 0) return false;
  const rel = wrap(target - prev + halfWidth);
  return rel <= span + halfWidth * 2;
}

/** Ram body contact against the player (horizontal distance, feet height above ground). */
export function ramContact(distance: number, feetAboveGround: number): boolean {
  return distance <= DINO.skills.ram.hitRadius && feetAboveGround <= DINO.ramHeight;
}

export interface LeapPoint {
  x: number;
  y: number;
  z: number;
}

const out: LeapPoint = { x: 0, y: 0, z: 0 };

/** Position along the leap at progress t in [0, 1] (parabola peaking at the apex). Reuses one object. */
export function leapPosition(sx: number, sz: number, sy: number, ex: number, ez: number, t: number): LeapPoint {
  const k = Math.min(1, Math.max(0, t));
  out.x = sx + (ex - sx) * k;
  out.z = sz + (ez - sz) * k;
  out.y = sy + 4 * DINO.skills.leapStomp.apex * k * (1 - k);
  return out;
}
