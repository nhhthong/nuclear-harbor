import { SCORPION } from './tunables';

/** Burst damage of the venom glob at horizontal `distance` from the impact: linear falloff to the edge. */
export function venomBurstDamage(distance: number): number {
  const s = SCORPION.skills.venom;
  if (distance > s.radius) return 0;
  const t = Math.max(0, distance) / s.radius;
  return s.damage * (1 - t * (1 - s.edgeFraction));
}

/** Standing in the venom pool (feet near the ground). */
export function inPool(distance: number, feetAboveGround: number): boolean {
  const s = SCORPION.skills.venom;
  return distance <= s.radius && feetAboveGround <= s.poolHeight;
}

/**
 * Tail slam fan: inside the radius, within the half angle of the facing direction (`relativeAngle`
 * in rad, 0 = straight ahead) and not lifted above the clearance.
 */
export function fanHit(distance: number, relativeAngle: number, feetAboveGround: number): boolean {
  const t = SCORPION.skills.tailSlam;
  const a = Math.abs(Math.atan2(Math.sin(relativeAngle), Math.cos(relativeAngle)));
  return distance <= t.radius && a <= t.halfAngle && feetAboveGround <= t.clearance;
}

/** Charge contact against the player (horizontal distance, feet height above ground). */
export function ramContact(distance: number, feetAboveGround: number): boolean {
  return distance <= SCORPION.skills.ram.hitRadius && feetAboveGround <= SCORPION.ramHeight;
}

export interface ArcPoint {
  x: number;
  y: number;
  z: number;
}

const out: ArcPoint = { x: 0, y: 0, z: 0 };

/** Position of the venom glob at progress t in [0, 1]: straight line plus a parabola. Reuses one object. */
export function arcPosition(sx: number, sy: number, sz: number, ex: number, ey: number, ez: number, t: number): ArcPoint {
  const k = Math.min(1, Math.max(0, t));
  out.x = sx + (ex - sx) * k;
  out.z = sz + (ez - sz) * k;
  out.y = sy + (ey - sy) * k + 4 * SCORPION.skills.venom.apex * k * (1 - k);
  return out;
}
