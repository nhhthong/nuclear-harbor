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
  /** Owner request (faster than GDD 4.2's 5 / 7.5): quicker traversal now that the grapple is gone. */
  walkSpeed: 6.5,
  sprintSpeed: 10,
  /**
   * Owner request: double jump replaces the grappling hook. With gravity -24 a ground jump rises
   * 1.9 m and the air jump adds 1.7 m (3.6 m when chained at the apex): one container (2.59 m) or
   * the 3 m tower-3 gantry needs both jumps.
   */
  jumpSpeed: 9.6,
  airJumpSpeed: 9.0,
  airJumps: 1,
  /** Jump still allowed this long after walking off an edge (s). */
  coyoteTime: 0.1,
  /** A jump press is remembered this long before landing (s). */
  jumpBufferTime: 0.12,
  /** proposed: capsule = radius + 2 * halfHeight (cylinder part) => 1.8 m tall. */
  capsuleRadius: 0.35,
  capsuleHalfHeight: 0.55,
  /** proposed: camera height above the feet. */
  eyeHeight: 1.65,
  /** proposed: ground acceleration / deceleration (m/s^2). */
  groundAccel: 60,
  groundDecel: 50,
  /** proposed: horizontal control while airborne (0..1 of ground accel). */
  airControl: 0.55,
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
  name: 'G36C',
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
  ammoCratesInZones: 6,
  ammoCratesInBossArena: 6,
  medkitHeal: 40,
  medkitsInZones: 3,
  medkitsInBossArena: 2,
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
  army: 3,
  spot: 3,
  duck: 2,
  total: 8,
} as const;

/**
 * GDD 6.1 role (14 of them), now the T-20 Vanguard army mech: slow patrol, disciplined combat movement,
 * telegraphed rocket salvos. HP, speeds and ranges are proposals (ROBOT-REFRESH T-20).
 */
export const ARMY_ROBOT = {
  hp: 150,
  /** Rocket centre damage (splash falls off linearly to 0 at `splashRadius`). */
  damage: 12,
  /** Patrol walk speed (m/s). */
  speed: 1.5,
  /** Combat speeds (m/s). */
  advanceSpeed: 3.4,
  strafeSpeed: 1.6,
  retreatSpeed: 2.4,
  /** Speed change limits (m/s^2) and yaw turn rate (rad/s). */
  accel: 1.8,
  decel: 2.6,
  turnRate: 1.1,
  detectionRange: 30,
  /** Preferred firing band to the player (m) and the distance below which the mech backs off. */
  bandMin: 18,
  bandMax: 25,
  retreatDistance: 8,
  rocketSpeed: 25,
  splashRadius: 3,
  /** Salvo size range, delay between rockets, telegraph before the first one, cooldown after the last (s). */
  salvoMin: 2,
  salvoMax: 3,
  shotInterval: 0.5,
  telegraphTime: 1.0,
  cooldown: 3,
  loseTargetTime: 4,
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
  towerCount: 1,
  interactRange: 2,
  activationHoldSeconds: 5,
  countdownSeconds: 8 * 60,
  /** proposed (REVIEW #6): defend phase pulls existing robots of the zone, no extra spawns. */
  defendPullRadius: 40,
  /**
   * T-17: incoming damage multiplier while a tower is being activated (the hold cannot be combined with
   * dodging, scripted probe: 100 -> 0 HP in 3.4 s at tower 2 before this). See docs/PLAYTEST.md.
   */
  activationDamageMultiplier: 0.5,
  /** proposed: progress decay per second when the hold is interrupted (0 = reset instantly). */
  activationResetInstant: true,
  /** proposed: countdown HUD turns critical below this. */
  countdownCriticalSeconds: 120,
} as const;

/** GDD 9 */
export const BOSS = {
  name: 'TITAN-04',
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
  attackInterval: 5,
  heavyCannon: { damage: 30, telegraph: 1.2, projectileSpeed: 40, splashRadius: 4, cooldown: 6 },
  groundSlam: { damage: 35, telegraph: 1.5, radius: 14, cooldown: 9 },
  missileBarrage: { damage: 18, telegraph: 2.0, count: 6, splashRadius: 4.5, cooldown: 12 },
  maxProjectiles: 16,
} as const;

/** GDD 13.9 / 10 / 13.6 */
export const PERFORMANCE = {
  lowEndFps: 30,
  /** proposed budgets used by the perf monitor warnings. */
  maxDrawCalls: 350,
  maxTriangles: 1_500_000,
  jsHeapWarnMb: 512,
  /** Bloom post-process (medium/high presets): only HDR-bright pixels (emissives, muzzle flash, sun glints) glow. */
  bloom: { strength: 0.4, radius: 0.6, threshold: 1.0, msaaSamples: 4 },
  /** Final grade (display space): vignette, film grain, chromatic aberration, lift/gain tint. */
  grade: { vignette: 0.32, grain: 0.02, aberration: 0.0004, exposure: 1.0 },
  quality: {
    // T-17: fogFraction = [near, far] as a share of viewDistance; dynamicShadowHz = refresh rate of the
    // otherwise static sun shadow for moving casters (0 = static only).
    low: { pixelRatioCap: 1, shadowMapSize: 1024, shadows: false, viewDistance: 300, fogFraction: [0.18, 0.95], dynamicShadowHz: 0, bloom: false, reflections: false, reflectionScale: 0.3, reflectionEvery: 2, ao: false },
    medium: { pixelRatioCap: 1.5, shadowMapSize: 2048, shadows: true, viewDistance: 450, fogFraction: [0.18, 0.95], dynamicShadowHz: 6, bloom: true, reflections: true, reflectionScale: 0.33, reflectionEvery: 2, ao: false },
    high: { pixelRatioCap: 2, shadowMapSize: 4096, shadows: true, viewDistance: 600, fogFraction: [0.18, 0.95], dynamicShadowHz: 12, bloom: true, reflections: true, reflectionScale: 0.5, reflectionEvery: 1, ao: true },
  },
} as const;

/** proposed: world dimensions not fixed by the GDD. */
export const WORLD = {
  /** ISO 20 ft container (length, height, width). */
  container: { length: 6.06, height: 2.59, width: 2.44 },
  maxContainerStack: 3,
  /** GDD 6.3: Duck lanes. */
  chargerLaneWidth: 6,
  /** GDD 7.4 */
  craneCountMin: 1,
  craneCountMax: 1,
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
  ARMY_ROBOT,
  AI_SCHEDULING,
  OBJECTIVES,
  BOSS,
  PERFORMANCE,
  WORLD,
  CAMERA,
} as const;

export type QualityPreset = keyof typeof PERFORMANCE.quality;
