import type { EnemyType } from '@/core/types';
import type { EnemyFactory } from './BaseEnemy';
import { createArmyRobot } from './army';
import { createChargerRobot } from './charger';
import { createSpiderRobot } from './spider';

/** One factory per enemy type. T-13 / T-14 replace only their own folder. */
export const ENEMY_FACTORIES: Readonly<Record<EnemyType, EnemyFactory>> = {
  sphere: createArmyRobot,
  spider: createSpiderRobot,
  charger: createChargerRobot,
};
