import { isFrontalHit } from '@/combat/damage';
import { CHARGER_ROBOT } from '@/config/tunables';
import type { HitZone } from '@/core/types';
import { CHARGER_LOCAL } from './tunables';

/** Where a planned charge ends. */
export type ChargeEnd = 'wall' | 'edge' | 'range';

export interface ChargePlan {
  /** Distance the robot may travel from its origin (m), >= 0. */
  maxDistance: number;
  endsAt: ChargeEnd;
}

/**
 * Probe results along the charge line, measured from the robot origin: the distance at which the
 * front of the robot touches the first obstacle (null = none) and the distance of the first
 * sample point without ground (null = ground all the way).
 */
export interface ChargeProbes {
  obstacleDistance: number | null;
  edgeDistance: number | null;
}

/**
 * Pure charge planner: `maxDistance = min(maxChargeDistance, obstacle, edge - safety margin)`.
 * `origin` and `direction` are accepted for the contract (and future use); the probes already
 * carry the world information.
 */
export function planCharge(
  _origin: { x: number; z: number },
  _direction: { x: number; z: number },
  probes: ChargeProbes,
): ChargePlan {
  let maxDistance: number = CHARGER_ROBOT.maxChargeDistance;
  let endsAt: ChargeEnd = 'range';
  if (probes.edgeDistance !== null) {
    const edge = probes.edgeDistance - CHARGER_LOCAL.edgeSafetyMargin;
    if (edge < maxDistance) {
      maxDistance = edge;
      endsAt = 'edge';
    }
  }
  if (probes.obstacleDistance !== null && probes.obstacleDistance <= maxDistance) {
    maxDistance = probes.obstacleDistance;
    endsAt = 'wall';
  }
  return { maxDistance: Math.max(0, maxDistance), endsAt };
}

/** A charge may start in the 8-25 m window, with line of sight and no cooldown left. */
export function canStartCharge(distance: number, hasLos: boolean, cooldownLeft: number): boolean {
  return (
    hasLos &&
    cooldownLeft <= 0 &&
    distance >= CHARGER_ROBOT.chargeTriggerMin &&
    distance <= CHARGER_ROBOT.chargeTriggerMax
  );
}

/**
 * Hit zone for an attack travelling along `attackDir` against a Charger facing `facing` (XZ).
 * Frontal arc -> `armor` (x0.1), flanks and rear -> `critical` (x2). Stunned or not, the same
 * rule applies: a stunned robot does not turn, so its rear stays exposed.
 */
export function zoneForHit(
  facing: { x: number; z: number },
  attackDir: { x: number; z: number },
  _stunned: boolean,
): HitZone {
  return isFrontalHit(facing, attackDir, CHARGER_ROBOT.frontArcHalfAngleDeg) ? 'armor' : 'critical';
}

/**
 * Cheap capsule-vs-box contact test (no physics events): the player capsule (feet position
 * `px,py,pz`) against the robot's oriented box (centre `bx,by,bz`, yaw about Y, yaw 0 faces -Z).
 */
export function playerTouchesBody(
  px: number,
  py: number,
  pz: number,
  bx: number,
  by: number,
  bz: number,
  yaw: number,
): boolean {
  const { halfExtents: h } = CHARGER_ROBOT;
  if (py > by + h.y || py + CHARGER_LOCAL.playerHeight < by - h.y) return false;
  const dx = px - bx;
  const dz = pz - bz;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // robot right = (cos, -sin), forward = (-sin, -cos)
  const lx = dx * cos - dz * sin;
  const lz = -dx * sin - dz * cos;
  const ox = Math.max(Math.abs(lx) - h.x, 0);
  const oz = Math.max(Math.abs(lz) - h.z, 0);
  return ox * ox + oz * oz <= CHARGER_LOCAL.playerRadius * CHARGER_LOCAL.playerRadius;
}
