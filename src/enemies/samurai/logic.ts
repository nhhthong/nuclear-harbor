import { SAMURAI } from './tunables';

function wrapAbs(a: number): number {
  return Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
}

/** Damage that passes the spinning polearm; `relativeAngle` = bearing of the attacker from the facing. */
export function deflectedDamage(amount: number, relativeAngle: number, spinning: boolean): number {
  if (!spinning) return amount;
  return wrapAbs(relativeAngle) <= SAMURAI.spin.frontHalfAngle ? amount * (1 - SAMURAI.spin.reduction) : amount;
}

/** Cone hit test used by the cut and the leap cleave. */
export function coneHit(distance: number, relativeAngle: number, feetAbove: number, radius: number, halfAngle: number, clearance: number): boolean {
  return distance <= radius && wrapAbs(relativeAngle) <= halfAngle && feetAbove <= clearance;
}

/** Shortest distance from point p to the segment a-b (all in the ground plane). */
export function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Number of dash uses the samurai is entitled to have spent at this HP fraction. */
export function dashUsesDue(hpFraction: number): number {
  let n = 0;
  for (const gate of SAMURAI.dash.hpGates) if (hpFraction <= gate) n++;
  return Math.min(n, SAMURAI.dash.uses);
}

export interface DashPoint {
  x: number;
  z: number;
}

/**
 * Next dash target: a point inside the disc (centre, radius), at least `minLength` from the start,
 * reachable in a straight line. `rand` returns [0, 1). Falls back to the centre, then to staying put.
 */
export function pickDashPoint(
  fromX: number,
  fromZ: number,
  cx: number,
  cz: number,
  rand: () => number,
  clear: (ax: number, az: number, bx: number, bz: number) => boolean,
  out: DashPoint,
): DashPoint {
  const { radius, minLength } = SAMURAI.dash;
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * Math.sqrt(0.15 + 0.85 * rand());
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (Math.hypot(x - fromX, z - fromZ) < minLength) continue;
    if (!clear(fromX, fromZ, x, z)) continue;
    out.x = x;
    out.z = z;
    return out;
  }
  if (clear(fromX, fromZ, cx, cz)) {
    out.x = cx;
    out.z = cz;
  } else {
    out.x = fromX;
    out.z = fromZ;
  }
  return out;
}
