import type { EnemyFactory } from '../BaseEnemy';
import { Charger } from './Charger';

/** Charger robot (GDD 6.3, T-14): heavy shielded rhino with a telegraphed, locked-line charge. */
export const createChargerRobot: EnemyFactory = (deps, spawn) => new Charger(deps, spawn);

export { Charger } from './Charger';
