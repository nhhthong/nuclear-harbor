import { SPAWN_SAFE_RADIUS } from '@/config/level';

/** Feature-local numbers for the enemy framework (shared GDD numbers live in src/config/tunables.ts). */
export const ENEMY_LOCAL = {
  /** Dormant robots do a coarse patrol advance this often (s). */
  dormantInterval: 1,
  /** Waypoint / goal reached tolerance (m). */
  arriveRadius: 0.8,
  /** Commanded robots (defend phase) hold this close to the target (m). */
  commandArriveRadius: 3,
  /** Re-path when the goal moved more than this since the last path (m). */
  repathDistance: 2.5,
  /** Separation between robots. */
  separationRadius: 2.2,
  separationStrength: 2.0,
  /** Turn rate (rad/s) of the visual/collider yaw. */
  turnRate: 8,
  /** Sandbox nav slab half size (the foundation sandbox ground is 80 x 80 m). */
  sandboxNavHalf: 40,
  /** Sandbox population. */
  sandboxCenter: { x: 0, z: -24 },
  sandboxRingRadius: 3,
  sandboxPatrolHalf: 4,
  /** Harbor population. */
  /** Authored population keeps robots at least this far from the player spawn (checked in population.ts). */
  minDistanceFromSpawn: SPAWN_SAFE_RADIUS,
  /** Area streaming (see `areaSpawner.ts`): robots appear when the player nears an area and are removed after they left. */
  area: { liveCap: 10, enterMargin: 5, exitMargin: 12, exitDelay: 3, despawnDistance: 40, minSpawnDistance: 18, spawnRadius: 46, interval: 0.25 },
  // T-17: populationSeed, patrolPoints, patrolRadius and sampleAttempts were removed (unused since the
  // harbor population became authored, T-16).
} as const;

/** Pooled enemy bolts (GDD 13.4). */
export const ENEMY_PROJECTILE = {
  poolCap: 48,
  radius: 0.12,
  /** Visual radius of the drone plasma bolt (spec 29; collision still uses `radius`). */
  plasmaRadius: 0.3,
  lifetime: 3,
  maxRange: 60,
  /** Player hit capsule used when no physics collider represents the player. */
  fallbackPlayerRadius: 0.45,
  fallbackPlayerHeight: 1.8,
  /** Rockets (army mech, T-20): separate bounded pool so bolts and rockets never starve each other. */
  rocketPoolCap: 12,
  rocketRadius: 0.16,
  rocketLength: 1.1,
  rocketLifetime: 5,
  rocketMaxRange: 100,
} as const;
