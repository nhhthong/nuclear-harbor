import type { EnemyType } from '@/core/types';
import type { EnemyFactory } from './BaseEnemy';
import { createChargerRobot } from './charger';
import { SphereRobot } from './SphereRobot';
import { createSpiderRobot } from './spider';

export const createSphereRobot: EnemyFactory = (deps, spawn) => new SphereRobot(deps, spawn);

/** One factory per enemy type. T-13 / T-14 replace only their own folder. */
export const ENEMY_FACTORIES: Readonly<Record<EnemyType, EnemyFactory>> = {
  sphere: createSphereRobot,
  spider: createSpiderRobot,
  charger: createChargerRobot,
};
