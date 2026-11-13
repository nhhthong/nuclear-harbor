import { SPOT } from './tunables';

export type SpotState = 'patrol' | 'chase' | 'telegraph' | 'lunge' | 'retreat' | 'destroyed';

export interface SpotBrainInput {
  state: SpotState;
  timeInState: number;
  distance: number;
  hasLos: boolean;
  timeSinceSeen: number;
  playerAlive: boolean;
  /** Seconds left before the next lunge may be prepared. */
  cooldownLeft: number;
  /** A defend-phase move order is active and not yet reached. */
  commanded: boolean;
}

/**
 * Pure decision: patrol -> chase -> telegraph -> lunge -> retreat -> chase. The robot itself ends a
 * lunge (contact, wall, range) by setting `retreat`; this function never leaves `lunge` or `destroyed`.
 */
export function decideSpot(i: SpotBrainInput): SpotState {
  if (i.state === 'destroyed' || i.state === 'lunge') return i.state;
  const sees = i.playerAlive && i.hasLos && i.distance <= SPOT.detectionRange;
  const aware = i.playerAlive && (sees || i.timeSinceSeen < SPOT.loseTargetTime);
  switch (i.state) {
    case 'patrol':
      if (aware) return 'chase';
      return i.commanded ? 'chase' : 'patrol';
    case 'chase':
      if (!aware) return i.commanded ? 'chase' : 'patrol';
      if (i.hasLos && i.distance <= SPOT.lungeRange && i.cooldownLeft <= 0) return 'telegraph';
      return 'chase';
    case 'telegraph':
      if (!aware) return 'patrol';
      return i.timeInState >= SPOT.telegraphTime ? 'lunge' : 'telegraph';
    case 'retreat':
      if (!aware) return 'patrol';
      return i.cooldownLeft <= 0 ? 'chase' : 'retreat';
  }
}

/** Horizontal and vertical test of a lunging Spot against the player (feet position). */
export function lungeTouchesPlayer(dx: number, dz: number, playerFeetY: number, spotGroundY: number): boolean {
  const dy = playerFeetY - spotGroundY;
  return dx * dx + dz * dz <= SPOT.contactReach * SPOT.contactReach && dy > -0.5 && dy < SPOT.contactHeight;
}

/** Retreat goal: first straight away from the player, then a tangent around it at the circle radius. */
export function retreatDirection(
  timeInState: number,
  awayX: number,
  awayZ: number,
  circleSign: 1 | -1,
  out: { x: number; z: number },
): { x: number; z: number } {
  if (timeInState < SPOT.backoffTime) {
    out.x = awayX;
    out.z = awayZ;
  } else {
    out.x = -awayZ * circleSign;
    out.z = awayX * circleSign;
  }
  return out;
}
