import { CHARGER_ROBOT } from '@/config/tunables';
import type { EnemyFactory } from '../BaseEnemy';
import { SphereRobot } from '../SphereRobot';

/**
 * Placeholder charger robot (T-14 replaces this folder): a recoloured sphere robot with the
 * charger type and HP. Keep the export name and the EnemyFactory signature.
 */
export const createChargerRobot: EnemyFactory = (deps, spawn) =>
  new SphereRobot(deps, spawn, { type: 'charger', hp: CHARGER_ROBOT.hp, color: 0xc9731f });
