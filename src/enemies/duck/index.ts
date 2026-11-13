import type { EnemyFactory } from '../BaseEnemy';
import { Duck } from './Duck';

/** Bomber Duck factory (enemy id `duck`). */
export const createDuckRobot: EnemyFactory = (deps, spawn) => new Duck(deps, spawn);
