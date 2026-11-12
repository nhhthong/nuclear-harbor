import type { EnemyFactory } from '../BaseEnemy';
import { SpiderRobot } from './SpiderRobot';

/** Spider robot factory (GDD 6.2). */
export const createSpiderRobot: EnemyFactory = (deps, spawn) => new SpiderRobot(deps, spawn);
