import type { EnemyType } from '@/core/types';
import type { EnemyFactory } from './BaseEnemy';
import { createArmyRobot } from './army';
import { createDuckRobot } from './duck';
import { createSpotRobot } from './spot';

/**
 * One factory per enemy type. Ids are kept from the placeholders and renamed in T-23 phase B:
 * `army` = Vanguard army mech (T-20), `spot` = Spot dog (T-19), `duck` = Bomber Duck (T-19).
 */
export const ENEMY_FACTORIES: Readonly<Record<EnemyType, EnemyFactory>> = {
  army: createArmyRobot,
  spot: createSpotRobot,
  duck: createDuckRobot,
};
