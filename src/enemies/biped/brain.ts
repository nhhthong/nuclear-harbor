import { BIPED } from './tunables';

/** Observable states of the biped. `crouch` is the telegraph, `recover` the freeze after a landing. */
export type BipedState = 'patrol' | 'chase' | 'crouch' | 'leap' | 'recover' | 'claw' | 'destroyed';

export interface BipedBrainInput {
  state: BipedState;
  /** Horizontal distance to the player (m). */
  distance: number;
  hasLos: boolean;
  /** Seconds since the biped last saw (or was told about) the player; Infinity if never. */
  timeSinceSeen: number;
  playerAlive: boolean;
  /** A defend-phase move order is active and not yet reached. */
  commanded: boolean;
  leapCooldown: number;
  clawCooldown: number;
}

/**
 * Decisions taken at the scheduled think rate. Timed transitions (crouch -> leap -> recover -> chase, claw -> chase)
 * come from `nextTimed`; `destroyed` is terminal.
 */
export function decideBiped(i: BipedBrainInput): BipedState {
  if (i.state === 'destroyed') return 'destroyed';
  if (i.state === 'crouch' || i.state === 'leap' || i.state === 'recover' || i.state === 'claw') return i.state;
  const tracking = i.playerAlive && (i.timeSinceSeen < BIPED.loseTargetTime || (i.hasLos && i.distance <= BIPED.detectionRange));
  if (!tracking && !i.commanded) return 'patrol';
  if (i.state === 'patrol') return 'chase';
  if (!i.playerAlive) return 'chase';
  if (i.distance <= BIPED.claw.range && i.clawCooldown <= 0) return 'claw';
  if (i.hasLos && i.distance >= BIPED.leap.min && i.distance <= BIPED.leap.max && i.leapCooldown <= 0) return 'crouch';
  return 'chase';
}

/** Timed transitions evaluated every fixed tick. `timeInState` is seconds since the state was entered. */
export function nextTimed(state: BipedState, timeInState: number): BipedState {
  switch (state) {
    case 'crouch':
      return timeInState >= BIPED.leap.telegraph ? 'leap' : state;
    case 'recover':
      return timeInState >= BIPED.leap.recover ? 'chase' : state;
    case 'claw':
      return timeInState >= BIPED.claw.windup + BIPED.claw.recover ? 'chase' : state;
    default:
      return state;
  }
}

/** Cooldown countdown (never below zero). */
export function tickCooldown(value: number, dt: number): number {
  return value > dt ? value - dt : 0;
}

export interface LeapPlan {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Horizontal length of the jump (m). */
  distance: number;
  /** Flight time (s) and apex height (m). */
  airTime: number;
  apex: number;
}

/**
 * Plans the jump from `(fromX, fromZ)` to where the player stood: the landing is `leap.standOff` short of the player's
 * position, at most `leap.max` away. `walkable` is the fraction (0..1) of the straight line that stays on walkable ground
 * (`NavGrid.raycastGrid`); the landing is pulled back to just before the first blocked cell.
 */
export function planLeap(fromX: number, fromZ: number, targetX: number, targetZ: number, walkable = 1, out?: LeapPlan): LeapPlan {
  const c = BIPED.leap;
  const dx = targetX - fromX;
  const dz = targetZ - fromZ;
  const d = Math.hypot(dx, dz);
  const wanted = Math.max(0, Math.min(d, c.max) - c.standOff);
  const reach = wanted * Math.max(0, Math.min(1, walkable - (walkable < 1 ? 0.04 : 0)));
  const k = d > 1e-6 ? reach / d : 0;
  const plan = out ?? { fromX, fromZ, toX: 0, toZ: 0, distance: 0, airTime: 0, apex: 0 };
  plan.fromX = fromX;
  plan.fromZ = fromZ;
  plan.toX = fromX + dx * k;
  plan.toZ = fromZ + dz * k;
  plan.distance = reach;
  plan.airTime = Math.max(c.minAir, Math.min(c.maxAir, reach / c.speed));
  plan.apex = Math.max(c.minApex, Math.min(c.maxApex, reach * c.apexPerMetre));
  return plan;
}

/** Ground position (x, z) and height above the ground (y) at flight progress `u` in [0, 1] (parabola, 0 at both ends). */
export function leapAt(plan: LeapPlan, u: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const k = Math.max(0, Math.min(1, u));
  out.x = plan.fromX + (plan.toX - plan.fromX) * k;
  out.z = plan.fromZ + (plan.toZ - plan.fromZ) * k;
  out.y = 4 * plan.apex * k * (1 - k);
  return out;
}

/** True when the claw reaches the player: within `radius` on the ground plane and not above `clearance` (double jump). */
export function clawReaches(distance: number, feetAbove: number, radius: number, clearance: number): boolean {
  return distance <= radius && feetAbove <= clearance;
}
