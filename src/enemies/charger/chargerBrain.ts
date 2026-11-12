import { CHARGER_ROBOT } from '@/config/tunables';
import { canStartCharge } from './chargePlan';
import { CHARGER_LOCAL } from './tunables';

export type ChargerState = 'patrol' | 'detect' | 'windup' | 'charge' | 'stunned' | 'recover' | 'destroyed';

export interface ChargerBrainInput {
  state: ChargerState;
  timeInState: number;
  distance: number;
  hasLos: boolean;
  timeSinceSeen: number;
  cooldownLeft: number;
  playerAlive: boolean;
}

/**
 * Time-driven transitions only (checked every fixed tick): wind-up -> charge, stunned/recover ->
 * detect. The end of a charge (wall, edge, range) is decided by the motion itself.
 */
export function timedNext(state: ChargerState, timeInState: number): ChargerState {
  switch (state) {
    case 'windup':
      return timeInState >= CHARGER_ROBOT.telegraphDuration ? 'charge' : state;
    case 'stunned':
      return timeInState >= CHARGER_ROBOT.wallStunDuration ? 'detect' : state;
    case 'recover':
      return timeInState >= CHARGER_ROBOT.recoverDuration ? 'detect' : state;
    default:
      return state;
  }
}

/** Next state given perception (GDD 6.3): patrol -> detect -> windup -> charge -> stunned|recover. */
export function decideCharger(i: ChargerBrainInput): ChargerState {
  if (i.state === 'destroyed') return 'destroyed';
  const timed = timedNext(i.state, i.timeInState);
  if (timed !== i.state) return timed;
  switch (i.state) {
    case 'patrol':
      return i.playerAlive && i.hasLos && i.distance <= CHARGER_ROBOT.detectionRange ? 'detect' : 'patrol';
    case 'detect':
      if (!i.playerAlive || (!i.hasLos && i.timeSinceSeen > CHARGER_LOCAL.loseTargetTime)) return 'patrol';
      return canStartCharge(i.distance, i.hasLos, i.cooldownLeft) ? 'windup' : 'detect';
    default:
      return i.state;
  }
}
