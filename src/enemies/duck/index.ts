import type { EnemyFactory } from '../BaseEnemy';
import { Duck } from './Duck';

/** Bomber Duck factory (internal enemy id `charger`). */
export const createDuckRobot: EnemyFactory = (deps, spawn) => new Duck(deps, spawn);
