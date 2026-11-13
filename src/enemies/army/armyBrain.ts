import { ARMY_ROBOT } from '@/config/tunables';
import { ARMY_LOCAL } from './tunables';

/** Observable states of the army mech. */
export type ArmyState = 'patrol' | 'advance' | 'engage' | 'retreat' | 'destroyed';

export interface ArmyBrainInput {
  state: ArmyState;
  /** Distance to the player's eye (m). */
  distance: number;
  /** Eye-to-eye line of sight against the static world. */
  hasLos: boolean;
  /** Seconds since the mech last saw (or was told about) the player; Infinity if never. */
  timeSinceSeen: number;
  /** A defend-phase move order is active and not yet reached. */
  commanded: boolean;
  playerAlive: boolean;
}

export interface ArmyBrainConfig {
  detectionRange: number;
  bandMin: number;
  bandMax: number;
  retreatDistance: number;
  /** Retreat ends once the player is this much farther than `retreatDistance` (m). */
  retreatExitMargin: number;
  /** Engage ends once the player is this factor beyond `bandMax`. */
  engageHysteresis: number;
  loseTargetTime: number;
}

export const ARMY_BRAIN_CONFIG: ArmyBrainConfig = {
  detectionRange: ARMY_ROBOT.detectionRange,
  bandMin: ARMY_ROBOT.bandMin,
  bandMax: ARMY_ROBOT.bandMax,
  retreatDistance: ARMY_ROBOT.retreatDistance,
  retreatExitMargin: ARMY_LOCAL.retreatExitMargin,
  engageHysteresis: ARMY_LOCAL.engageHysteresis,
  loseTargetTime: ARMY_ROBOT.loseTargetTime,
};

/**
 * Pure decision function: current state + perception -> next state. `destroyed` is terminal and is
 * entered by the damage path.
 */
export function decideArmy(i: ArmyBrainInput, cfg: ArmyBrainConfig = ARMY_BRAIN_CONFIG): ArmyState {
  if (i.state === 'destroyed') return 'destroyed';

  const sees = i.playerAlive && i.hasLos && i.distance <= cfg.detectionRange;
  const aware = i.playerAlive && (sees || i.timeSinceSeen < cfg.loseTargetTime);

  if (!aware) return i.commanded ? 'advance' : 'patrol';

  switch (i.state) {
    case 'patrol':
      return 'advance';
    case 'advance':
      if (i.distance < cfg.retreatDistance) return 'retreat';
      if (sees && i.distance <= cfg.bandMax) return 'engage';
      return 'advance';
    case 'engage':
      if (i.distance < cfg.retreatDistance) return 'retreat';
      if (!i.hasLos || i.distance > cfg.bandMax * cfg.engageHysteresis) return 'advance';
      return 'engage';
    case 'retreat':
      if (i.distance >= cfg.retreatDistance + cfg.retreatExitMargin) {
        return sees && i.distance <= cfg.bandMax ? 'engage' : 'advance';
      }
      return 'retreat';
    default:
      return i.state;
  }
}

/**
 * -1..1 radial intent inside the firing band: +1 = close in, -1 = back off, 0 = hold the ring.
 * A dead zone around the middle of the band keeps the mech from jittering.
 */
export function radialIntent(distance: number, cfg: ArmyBrainConfig = ARMY_BRAIN_CONFIG): number {
  const mid = (cfg.bandMin + cfg.bandMax) / 2;
  const half = (cfg.bandMax - cfg.bandMin) / 2;
  const v = (distance - mid) / half;
  if (Math.abs(v) < 0.4) return 0;
  return Math.max(-1, Math.min(1, v));
}

export interface XZ {
  x: number;
  z: number;
}

/**
 * Strafe goal around the player: `step` metres sideways (side +1 / -1) plus a radial component
 * (`radial` > 0 moves towards the player). Writes into `out` and returns it.
 */
export function engageGoal(out: XZ, mech: XZ, player: XZ, side: 1 | -1, radial: number, step: number): XZ {
  let ux = mech.x - player.x;
  let uz = mech.z - player.z;
  const len = Math.hypot(ux, uz);
  if (len < 1e-4) {
    ux = 1;
    uz = 0;
  } else {
    ux /= len;
    uz /= len;
  }
  out.x = mech.x + -uz * side * step - ux * radial * step;
  out.z = mech.z + ux * side * step - uz * radial * step;
  return out;
}
