/** Feature-local numbers for the enemy framework (shared GDD numbers live in src/config/tunables.ts). */
export const ENEMY_LOCAL = {
  /** Dormant robots do a coarse patrol advance this often (s). */
  dormantInterval: 1,
  /** Sphere robot retreat lasts this long (s), once per life. */
  retreatDuration: 3.5,
  /** Retreat goal distance behind the robot, away from the player (m). */
  retreatDistance: 10,
  /** Hysteresis: attack state is kept until the player is this much beyond attack range. */
  attackRangeHysteresis: 1.1,
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
  /** Visual bobbing. */
  bobAmplitude: 0.08,
  bobSpeed: 3,
  /** Sensor (critical) collider. */
  sensorRadius: 0.22,
  sensorForwardFactor: 0.85,
  sensorUp: 0.15,
  /** Delay before the first shot after entering attack (s). */
  firstShotDelay: 1.0,
  /** Aim point above the player's feet for bolts (m). */
  aimHeight: 1.2,
  /** Sandbox nav slab half size (the foundation sandbox ground is 80 x 80 m). */
  sandboxNavHalf: 40,
  /** Sandbox population. */
  sandboxCenter: { x: 0, z: -24 },
  sandboxRingRadius: 3,
  sandboxPatrolHalf: 4,
  /** Harbor population. */
  /** Authored population keeps robots at least this far from the player spawn (checked in population.ts). */
  minDistanceFromSpawn: 40,
  // T-17: populationSeed, patrolPoints, patrolRadius and sampleAttempts were removed (unused since the
  // harbor population became authored, T-16).
} as const;

/** Pooled enemy bolts (GDD 13.4). */
export const ENEMY_PROJECTILE = {
  poolCap: 48,
  radius: 0.12,
  lifetime: 3,
  maxRange: 60,
  /** Player hit capsule used when no physics collider represents the player. */
  fallbackPlayerRadius: 0.45,
  fallbackPlayerHeight: 1.8,
} as const;
