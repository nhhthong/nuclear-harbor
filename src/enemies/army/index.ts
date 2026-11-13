import type { EnemyFactory } from '../BaseEnemy';
import { ArmyRobot } from './ArmyRobot';

/** Vanguard army mech (T-20): enemy type `army`. */
export const createArmyRobot: EnemyFactory = (deps, spawn) => new ArmyRobot(deps, spawn);
