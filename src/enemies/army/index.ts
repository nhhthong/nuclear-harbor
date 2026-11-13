import type { EnemyFactory } from '../BaseEnemy';
import { ArmyRobot } from './ArmyRobot';

/** Vanguard army mech (T-20): internal type `sphere` until T-23 renames it. */
export const createArmyRobot: EnemyFactory = (deps, spawn) => new ArmyRobot(deps, spawn);

export { ArmyRobot } from './ArmyRobot';
