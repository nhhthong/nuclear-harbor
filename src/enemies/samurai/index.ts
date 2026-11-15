import type { EnemyFactory } from '../BaseEnemy';
import { Samurai } from './Samurai';

/** Cyber samurai factory (enemy id `samurai`). */
export const createSamuraiRobot: EnemyFactory = (deps, spawn) => new Samurai(deps, spawn);
