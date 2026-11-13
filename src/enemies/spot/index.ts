import type { EnemyFactory } from '../BaseEnemy';
import { Spot } from './Spot';

/** Spot dog factory (enemy id `spot`). */
export const createSpotRobot: EnemyFactory = (deps, spawn) => new Spot(deps, spawn);
