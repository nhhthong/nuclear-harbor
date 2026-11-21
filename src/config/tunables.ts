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
   * Owner request: a natural jump, not a rocket. Player gravity stays -30 (world `SIM.gravity` is -24). Apex = v^2 / (2 g):
   * a ground jump rises 0.95 m (0.5 s in the air). Spec 33 (owner request 2026-11-21): the air jump now adds 2.25 m, so
   * about 3.2 m when chained near the apex: a one-high container top (2.59 m) is reachable with margin, a
   * two-high stack (5.2 m) is not. (Spec 24: 0.85 m and 1.8 m; originally 3.9 m, +3.3 m, 7.2 m.)
   */
  gravity: -30,
  jumpSpeed: 7.55,
  airJumpSpeed: 11.6,
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
  /**
   * Owner request: fewer supplies (was 10 + 6 crates, 4 + 2 medkits). Spec 29: + 1 crate at `WAREHOUSE.supplySpot`
   * (under the mezzanine) for the four roster drones. Spec 33 (owner request): + 4 crates around the map.
   */
  ammoCratesInZones: 12,
  ammoCratesInBossArena: 4,
  medkitHeal: 40,
  medkitsInZones: 2,
  medkitsInBossArena: 1,
  /** GDD 5.4: chance for a destroyed robot to drop ammo. */
  enemyAmmoDropChance: 0.1,
  /** proposed: size of an enemy drop. */
  enemyAmmoDropAmount: 15,
  /** proposed: cap on drops per zone ("limited by the per-zone ammo budget"). */
  maxEnemyDropsPerZone: 1,
  /** proposed */
  pickupRadius: 1.2,
  /** proposed: dropped pickups despawn after this long. */
  dropLifetime: 60,
  /** Assumed accuracy used by the ammo budget test (GDD 5.4 said 0.5; raised with the smaller supply). */
  assumedAccuracy: 0.65,
} as const;

export const ENEMY_COUNTS = {
  /** Whole roster over all areas. Robots are streamed by area, see `ENEMY_LOCAL.area` (live cap). */
  army: 5,
  spot: 6,
  duck: 4,
  biped: 4,
  /** Elites: twice the HP and damage of a regular robot, one per area. */
  samurai: 3,
  /** Ground roster (the five types above). */
  total: 22,
  /**
   * Flying dragonfly drones of the roster (spec 29): two over the yard's west leg / warehouse roof line, two over
   * the court and quay. Not in `total` or ENEMY_DISTRIBUTION (they fly, no nav grid). The anti-camping call-in
   * drones (`DRONE.callIn`, src/enemies/drone/tunables.ts) come on top and are not part of the roster.
   */
  drone: 4,
} as const;

/**
 * GDD 6.1 role (14 of them), now the Medium Mech Striker (spec 26): slow patrol, disciplined combat movement,
 * 3-round bursts and, now and then, a telegraphed rocket with splash damage. HP, speeds and ranges are
 * proposals; the weapon numbers live in `src/enemies/army/tunables.ts` (`STRIKER`).
 */
export const ARMY_ROBOT = {
  hp: 150,
  /** Rocket centre damage (splash falls off linearly to 0 at `splashRadius`). */
  damage: 14,
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
  detectionRange: 36,
  /** Preferred firing band to the player (m) and the distance below which the mech backs off. */
  bandMin: 14,
  bandMax: 30,
  retreatDistance: 8,
  rocketSpeed: 24,
  splashRadius: 4,
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

/**
 * Final boss: the Gunslinger Crab Mech (spec 27-crab-boss; GDD 9 described TITAN-04 with weak points,
 * see docs/DEVIATIONS.md). One tanky HP pool, no weak points, no core stage. The skill numbers live in
 * `src/boss/tunables.ts`.
 */
export const BOSS = {
  name: 'GUNSLINGER CRAB MECH',
  /** Single HP pool: 232 hits at 25 damage (ammo budget, `src/combat/damage.test.ts`). */
  hp: 5800,
  /** Walk speed of the full-size boss (m/s, scaled by the boss scale). */
  speed: 2.5,
  /** Legacy: the crab has no armour zone (every hit does full damage); kept for the armour unit test. */
  armorDamageMultiplier: 0,
  /** Awakening (landing cinematic) length, seconds. */
  awakeningDuration: 4,
  /** Pause between two skills (s). */
  attackInterval: 2.2,
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
  grade: { vignette: 0.34, grain: 0.02, aberration: 0.0004, exposure: 1.05, desaturate: 0.25 },
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

/** Aim down sights (hold right mouse). `aimAmount` 0..1 blends hip -> aimed. */
export const ADS = {
  /** Camera FOV at full aim (hip FOV is `CAMERA.fovDeg`). */
  fovDeg: 55,
  /** Exponential response (1/s): about 0.2 s to 95%. */
  response: 14,
  /** Walk speed multiplier at full aim. */
  moveSpeedScale: 0.7,
  /** Spread and camera recoil multipliers at full aim. */
  spreadScale: 0.5,
  recoilScale: 0.5,
  /** Below this aim amount sprint is still allowed (it is blocked while the aim button is held anyway). */
  sprintBlockAbove: 0.1,
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
  ADS,
} as const;

export type QualityPreset = keyof typeof PERFORMANCE.quality;
