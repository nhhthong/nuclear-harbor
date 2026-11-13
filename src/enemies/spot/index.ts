import type { EnemyFactory } from '../BaseEnemy';
import { Spot } from './Spot';

/** Spot dog factory (internal enemy id `spider`). */
export const createSpotRobot: EnemyFactory = (deps, spawn) => new Spot(deps, spawn);
