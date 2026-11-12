import { SPIDER_ROBOT } from '@/config/tunables';
import type { EnemyFactory } from '../BaseEnemy';
import { SphereRobot } from '../SphereRobot';

/**
 * Placeholder spider robot (T-13 replaces this folder): a recoloured sphere robot with the
 * spider type and HP. Keep the export name and the EnemyFactory signature.
 */
export const createSpiderRobot: EnemyFactory = (deps, spawn) =>
  new SphereRobot(deps, spawn, { type: 'spider', hp: SPIDER_ROBOT.hp, color: 0x5a3d78 });
