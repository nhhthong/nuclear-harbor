import type { EnemyType } from '@/core/types';
import type { EnemyFactory } from './BaseEnemy';
import { createDuckRobot } from './duck';
import { SphereRobot } from './SphereRobot';
import { createSpotRobot } from './spot';

export const createSphereRobot: EnemyFactory = (deps, spawn) => new SphereRobot(deps, spawn);

/** One factory per enemy type. T-19: `spider` is the Spot dog, `charger` is the Bomber Duck (ids renamed in T-23). */
export const ENEMY_FACTORIES: Readonly<Record<EnemyType, EnemyFactory>> = {
  sphere: createSphereRobot,
  spider: createSpotRobot,
  charger: createDuckRobot,
};
