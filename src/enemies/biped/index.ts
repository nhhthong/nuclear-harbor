import type { EnemyFactory } from '../BaseEnemy';
import { Biped } from './Biped';

/** Biped robot factory (enemy id `biped`). */
export const createBipedRobot: EnemyFactory = (deps, spawn) => new Biped(deps, spawn);
