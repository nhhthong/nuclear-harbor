import type { EnemyFactory } from '../BaseEnemy';
import { Drone } from './Drone';

/** Flying dragonfly drone factory (enemy id `drone`, spec 29). */
export const createDroneRobot: EnemyFactory = (deps, spawn) => new Drone(deps, spawn);

export { Drone } from './Drone';
export { CallInDirector, callInSpawnPoints, onMezzanine } from './callIn';
export { DRONE } from './tunables';
export { clearWrecks, stepWrecks } from './wrecks';
