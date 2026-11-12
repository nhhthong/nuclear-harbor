import { SPHERE_ROBOT } from '@/config/tunables';
import { ENEMY_LOCAL } from './tunables';

/** Observable sphere robot states (GDD 6.1). */
export type SphereState = 'patrol' | 'chase' | 'attack' | 'retreat' | 'destroyed';

export interface SphereBrainInput {
  state: SphereState;
  /** Seconds spent in the current state. */
  timeInState: number;
  /** Horizontal-ish distance to the player (m). */
  distance: number;
  /** Eye-to-eye line of sight against the static world. */
  hasLos: boolean;
  /** Seconds since the robot last saw (or was told about) the player; Infinity if never. */
  timeSinceSeen: number;
  hpFraction: number;
  /** The robot already used its retreat this life. */
  hasRetreated: boolean;
  /** A move order (defend phase) is active and not yet reached. */
  commanded: boolean;
  /** Commanded robot reached its target. */
  commandArrived: boolean;
  playerAlive: boolean;
}

export interface SphereBrainConfig {
  detectionRange: number;
  attackRange: number;
  loseTargetTime: number;
  retreatHpFraction: number;
  retreatDuration: number;
  attackHysteresis: number;
}

export const SPHERE_BRAIN_CONFIG: SphereBrainConfig = {
  detectionRange: SPHERE_ROBOT.detectionRange,
  attackRange: SPHERE_ROBOT.attackRange,
  loseTargetTime: SPHERE_ROBOT.loseTargetTime,
  retreatHpFraction: SPHERE_ROBOT.retreatHpFraction,
  retreatDuration: ENEMY_LOCAL.retreatDuration,
  attackHysteresis: ENEMY_LOCAL.attackRangeHysteresis,
};

/**
 * Pure decision function: current state + perception -> next state. Destroyed is terminal and
 * is entered by the damage path, not by this function.
 */
export function decideSphere(i: SphereBrainInput, cfg: SphereBrainConfig = SPHERE_BRAIN_CONFIG): SphereState {
  if (i.state === 'destroyed') return 'destroyed';

  const sees = i.playerAlive && i.hasLos && i.distance <= cfg.detectionRange;
  const aware = i.playerAlive && (sees || i.timeSinceSeen < cfg.loseTargetTime);

  if (i.state === 'retreat') {
    if (i.timeInState < cfg.retreatDuration) return 'retreat';
    return aware ? 'chase' : 'patrol';
  }

  // retreat once when badly hurt and the player is a threat
  if (!i.hasRetreated && i.hpFraction < cfg.retreatHpFraction && aware && (i.state === 'chase' || i.state === 'attack')) {
    return 'retreat';
  }

  switch (i.state) {
    case 'patrol':
      if (sees || aware) return 'chase';
      if (i.commanded) return 'chase';
      return 'patrol';
    case 'chase':
      if (sees && i.distance <= cfg.attackRange) return 'attack';
      if (!aware) return i.commanded && !i.commandArrived ? 'chase' : 'patrol';
      return 'chase';
    case 'attack':
      if (!aware) return 'patrol';
      if (!i.hasLos || i.distance > cfg.attackRange * cfg.attackHysteresis) return 'chase';
      return 'attack';
    default:
      return i.state;
  }
}
