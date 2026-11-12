/**
 * Single source of truth for every gameplay number.
 *
 * Rules:
 *  - Values tagged `GDD x.y` come straight from docs/GDD.md. Do not change them without a playtest
 *    note in the PR description.
 *  - Values tagged `proposed` are not in the GDD; they are engineering defaults that tickets may tune.
 *  - Feature code must NEVER hard-code a gameplay number. Import it from here (or add it here, in the
 *    section owned by your ticket, see docs/PLAN.md "Shared files").
 *  - Units: metres, seconds, m/s, degrees only when the key ends with `Deg`.
 */

export const SIM = {
  /** proposed: fixed logic/physics step. */
  fixedHz: 60,
  /** proposed: clamp for a single frame delta so tab-switches do not explode the accumulator. */
  maxFrameDelta: 0.25,
  /** proposed: max fixed sub-steps per rendered frame (spiral-of-death guard). */
  maxSubSteps: 5,
  /** proposed */
  gravity: -24,
} as const;

export const PLAYER = {
  /** GDD 4.2 */
  maxHp: 100,
  /** GDD 4.2 */
  walkSpeed: 5,
  /** GDD 4.2 */
  sprintSpeed: 7.5,
  /** GDD 4.2: no jump in v1 (Space is the grapple). */
  canJump: false,
  /** GDD 4.2: no regeneration, medkits only. */
  hpRegenPerSecond: 0,
  /** proposed: capsule = radius + 2 * halfHeight (cylinder part) => 1.8 m tall. */
  capsuleRadius: 0.35,
  capsuleHalfHeight: 0.55,
  /** proposed: camera height above the feet. */
  eyeHeight: 1.65,
  /** proposed: ground acceleration / deceleration (m/s^2). */
  groundAccel: 60,
  groundDecel: 50,
  /** proposed: horizontal control while airborne (0..1 of ground accel). */
  airControl: 0.25,
  /** proposed: Rapier KCC settings. */
  kccOffset: 0.02,
  maxStepHeight: 0.35,
  minStepWidth: 0.2,
  maxSlopeDeg: 45,
  snapToGround: 0.3,
  /** proposed: pitch clamp. */
  maxPitchDeg: 89,
  /** proposed: radians per pixel at sensitivity 1.0. */
  lookRadPerPixel: 0.0022,
  /** proposed: falling below this Y kills the player (fell in the sea). */
  killPlaneY: -6,
  /** proposed: brief invulnerability after respawn. */
  respawnInvulnerability: 2.0,
} as const;

export const GRAPPLE = {
  /** GDD 4.1 */
  maxRange: 40,
  /** GDD 4.1 */
  pullSpeed: 18,
  /** GDD 4.1 */
  cooldown: 1.0,
  /** proposed: auto-release when the eye is this close to the anchor point. */
  releaseDistance: 1.5,
  /** proposed: safety auto-release if a pull lasts longer than this (stuck against geometry). */
  maxPullDuration: 4.0,
  /** proposed: auto-release if the player moves less than this many metres in `stuckWindow` seconds. */
  stuckDistance: 0.25,
  stuckWindow: 0.4,
  /** proposed: share of pull velocity kept after release. */
  releaseMomentum: 0.5,
  /** proposed: hook projectile travel speed (visual only; attach is resolved by raycast). */
  hookTravelSpeed: 90,
} as const;

export const WEAPON = {
  /** GDD 5.1 (display name, to be verified against the archive). */
  name: 'MDR Helix',
  /** GDD 5.3 */
  magazineSize: 30,
  /** GDD 5.3 */
  reserveAmmo: 180,
  /** GDD 5.3 */
  damage: 25,
  /** GDD 5.3: rounds per second. */
  fireRate: 8,
  /** GDD 5.3 */
  reloadDuration: 1.8,
  /** GDD 5.3 */
  criticalMultiplier: 2.0,
  /** GDD 5.3 */
  automatic: true,
  /** proposed: hitscan range. */
  range: 200,
  /** proposed: cone half-angle while standing still / max while spraying or sprinting. */
  spreadMinDeg: 0.15,
  spreadMaxDeg: 2.2,
  spreadPerShotDeg: 0.22,
  spreadRecoveryDegPerSec: 6,
  /** proposed: camera kick per shot. */
  recoilPitchDeg: 0.55,
  recoilYawDeg: 0.22,
  recoilRecoveryPerSec: 9,
  /** proposed: pool caps (GDD 13.4). */
  maxTracers: 24,
  maxShellCasings: 32,
  maxImpactDecals: 64,
} as const;

/** GDD 5.4 */
export const ECONOMY = {
  ammoCrateAmount: 30,
  ammoCratesInZones: 14,
  ammoCratesInBossArena: 8,
  medkitHeal: 40,
  medkitsInZones: 10,
  medkitsInBossArena: 3,
  /** GDD 5.4: chance for a destroyed robot to drop ammo. */
  enemyAmmoDropChance: 0.15,
  /** proposed: size of an enemy drop. */
  enemyAmmoDropAmount: 15,
  /** proposed: cap on drops per zone ("limited by the per-zone ammo budget"). */
  maxEnemyDropsPerZone: 2,
  /** proposed */
  pickupRadius: 1.2,
  /** proposed: dropped pickups despawn after this long. */
  dropLifetime: 60,
  /** GDD 5.4: assumed accuracy used by the ammo budget test. */
  assumedAccuracy: 0.5,
} as const;

export const ENEMY_COUNTS = {
  /** GDD 6 */
  sphere: 14,
  spider: 10,
  charger: 6,
  total: 30,
} as const;

/** GDD 6.1 */
export const SPHERE_ROBOT = {
  hp: 100,
  damage: 8,
  speed: 3.5,
  attackRange: 20,
  detectionRange: 25,
  /** proposed */
  radius: 0.7,
  hoverHeight: 1.2,
  fireInterval: 1.2,
  projectileSpeed: 30,
  /** proposed: stop approaching at this fraction of attack range. */
  preferredRangeFactor: 0.7,
  /** proposed: retreat when HP fraction is below this (GDD: "retreat, if designed"). */
  retreatHpFraction: 0.25,
  loseTargetTime: 4,
} as const;

/** GDD 6.2 */
export const SPIDER_ROBOT = {
  hp: 150,
  damage: 12,
  speed: 5,
  attackRange: 12,
  detectionRange: 30,
  legCount: 6,
  /** proposed */
  bodyRadius: 0.8,
  bodyHeight: 0.9,
  fireInterval: 0.9,
  projectileSpeed: 26,
  flankAngleDeg: 55,
  flankDistance: 9,
  hopMaxObstacleHeight: 1.0,
  loseTargetTime: 5,
} as const;

/** GDD 6.3 */
export const CHARGER_ROBOT = {
  hp: 200,
  /** contact damage */
  damage: 20,
  walkSpeed: 3,
  /** GDD: 10-12 m/s, faster than the player's sprint. */
  chargeSpeedMin: 10,
  chargeSpeedMax: 12,
  maxChargeDistance: 30,
  chargeTriggerMin: 8,
  chargeTriggerMax: 25,
  detectionRange: 25,
  cooldown: 6,
  /** GDD: 90% reduction from the front. */
  frontDamageMultiplier: 0.1,
  /** GDD: back and flanks take crit x2. */
  rearCritMultiplier: 2.0,
  telegraphDuration: 1.0,
  wallStunDuration: 2.5,
  /** proposed: hits within this half-angle of the facing direction count as frontal. */
  frontArcHalfAngleDeg: 60,
  /** proposed */
  knockbackSpeed: 12,
  knockbackUp: 5,
  halfExtents: { x: 0.9, y: 0.9, z: 1.3 },
  /** proposed: forward probe distance for obstacles and the dock edge. */
  edgeProbeDistance: 2.5,
  edgeProbeDepth: 1.5,
  recoverDuration: 1.0,
} as const;

/** GDD 13.7 */
export const AI_SCHEDULING = {
  nearHz: 30,
  midHz: 10,
  farHz: 2,
  /** proposed distance bands (m). */
  nearDistance: 35,
  midDistance: 80,
  /** proposed: beyond this, enemies are dormant (event driven). */
  dormantDistance: 140,
  /** proposed: nav grid cell size. */
  navCellSize: 1.5,
} as const;

/** GDD 8.1 / 8.2 */
export const OBJECTIVES = {
  towerCount: 4,
  interactRange: 2,
  activationHoldSeconds: 5,
  countdownSeconds: 20 * 60,
  /** proposed (REVIEW #6): defend phase pulls existing robots of the zone, no extra spawns. */
  defendPullRadius: 60,
  /** proposed: progress decay per second when the hold is interrupted (0 = reset instantly). */
  activationResetInstant: true,
  /** proposed: countdown HUD turns critical below this. */
  countdownCriticalSeconds: 120,
} as const;

/** GDD 9 */
export const BOSS = {
  name: 'TITAN-04',
  bodyDiameter: 15,
  totalHeight: 22,
  legCount: 4,
  coreHp: 4000,
  weakPointCount: 4,
  weakPointHp: 500,
  speed: 2.5,
  /** GDD 9.2: armour is immune ("cannot finish the boss"). */
  armorDamageMultiplier: 0,
  /** proposed (REVIEW #2): perch heights around the arena. */
  perchHeights: [8, 14, 20],
  /** proposed */
  awakeningDuration: 4,
  weakPointRadius: 1.2,
  attackInterval: 5,
  heavyCannon: { damage: 30, telegraph: 1.2, projectileSpeed: 40, splashRadius: 4, cooldown: 6 },
  groundSlam: { damage: 35, telegraph: 1.5, radius: 14, cooldown: 9 },
  missileBarrage: { damage: 18, telegraph: 2.0, count: 6, splashRadius: 4.5, cooldown: 12 },
  maxProjectiles: 16,
} as const;

/** GDD 13.9 / 10 / 13.6 */
export const PERFORMANCE = {
  targetFps: 60,
  lowEndFps: 30,
  dynamicShadowLights: 1,
  /** proposed budgets used by the perf monitor warnings. */
  maxDrawCalls: 350,
  maxTriangles: 1_500_000,
  jsHeapWarnMb: 512,
  quality: {
    low: { pixelRatioCap: 1, shadowMapSize: 1024, shadows: false, viewDistance: 300 },
    medium: { pixelRatioCap: 1.5, shadowMapSize: 2048, shadows: true, viewDistance: 450 },
    high: { pixelRatioCap: 2, shadowMapSize: 4096, shadows: true, viewDistance: 600 },
  },
} as const;

/** proposed: world dimensions not fixed by the GDD. */
export const WORLD = {
  /** ISO 20 ft container (length, height, width). */
  container: { length: 6.06, height: 2.59, width: 2.44 },
  maxContainerStack: 3,
  /** GDD 6.3: Charger lanes. */
  chargerLaneMinLength: 30,
  chargerLaneWidth: 6,
  /** GDD 7.4 */
  craneCountMin: 5,
  craneCountMax: 6,
  /** GDD 7.2: 07:00 morning sun. */
  sunElevationDeg: 18,
  sunAzimuthDeg: 105,
  fogNear: 80,
  fogFar: 520,
} as const;

export const CAMERA = {
  /** proposed */
  fovDeg: 75,
  near: 0.05,
  far: 600,
} as const;

export const TUNABLES = {
  SIM,
  PLAYER,
  GRAPPLE,
  WEAPON,
  ECONOMY,
  ENEMY_COUNTS,
  SPHERE_ROBOT,
  SPIDER_ROBOT,
  CHARGER_ROBOT,
  AI_SCHEDULING,
  OBJECTIVES,
  BOSS,
  PERFORMANCE,
  WORLD,
  CAMERA,
} as const;

export type Tunables = typeof TUNABLES;
export type QualityPreset = keyof typeof PERFORMANCE.quality;
