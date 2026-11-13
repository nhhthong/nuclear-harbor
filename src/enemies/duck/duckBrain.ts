import { DUCK } from './tunables';

export type DuckState = 'patrol' | 'hop' | 'arming' | 'destroyed';

export interface DuckBrainInput {
  state: DuckState;
  distance: number;
  hasLos: boolean;
  timeSinceSeen: number;
  playerAlive: boolean;
}

/** Pure decision: patrol -> hop (aware) -> arming (close and in view). Arming is final. */
export function decideDuck(i: DuckBrainInput): DuckState {
  if (i.state === 'destroyed' || i.state === 'arming') return i.state;
  const sees = i.playerAlive && i.hasLos && i.distance <= DUCK.detectionRange;
  const aware = i.playerAlive && (sees || i.timeSinceSeen < DUCK.loseTargetTime);
  if (!aware) return 'patrol';
  if (i.hasLos && i.distance <= DUCK.armDistance) return 'arming';
  return 'hop';
}
