import { BOSS } from '@/config/tunables';

/**
 * Weak point order: index into every weak point array. T-22: the four weak points are the knee LED
 * rings of the four legs; the name is the ability the leg is tied to (GDD 9.2): 0 front-left leg
 * (cannon), 1 back-right leg (slam), 2 back-left leg and 3 front-right leg (missiles).
 */
export const WEAK_POINT = { front: 0, back: 1, left: 2, right: 3 } as const;

/** Reference leg angle (radians in the reference model frame) of the leg that carries weak point i. */
export const WEAK_POINT_LEG_ANGLE: readonly number[] = [0.78, -2.28, 2.28, -0.78];

/**
 * Boss-local numbers that are not part of the shared GDD table (docs/PLAN.md section 3). Anything
 * the GDD fixes lives in `BOSS` (src/config/tunables.ts).
 */
export const BOSS_LOCAL = {
  /** `?sandbox`: scale and spawn position so the boss fits the test scene (ticket step 5). */
  sandbox: { scale: 0.4, position: { x: -20, y: 0, z: 24 }, arenaRadius: 14 },
  /**
   * T-22 reference port: the reference walker is ~2.5 units tall, so scale 7.2 gives ~18 m (twice
   * the 9 m dinosaur, well above the 10 m warehouse). Body centre / hull radius follow from it.
   */
  model: { scale: 7.2, bodyCenterUnits: 1.16, hullRadiusUnits: 1.07, eyeUnits: { y: 1.13, z: 0.96 }, topUnits: 2.5 },
  /** Body centre height of the full-size boss. */
  bodyCenterY: 1.16 * 7.2,
  /** Radius of the ground footprint of the four feet (full size). */
  footprintRadius: 12,
  /** Hit radius of a knee weak point (full size, a little bigger than the LED ring). */
  weakPointHitRadius: 1.9,
  /** Landing cinematic (GDD-free, ticket T-22). Times in seconds. */
  cinematic: {
    duration: 6.2,
    /** E skips only after this long. */
    skipAfter: 2,
    /** Boss starts to fall into view / hits the ground. */
    descentStart: 0.9,
    impactAt: 3.9,
    /** Start height above the ground (full size). */
    skyHeight: 240,
    /** Camera stands this far (full size) from the landing spot, towards the player. */
    cameraDistance: 78,
    cameraHeight: 4,
    /** Invulnerability kept after control returns. */
    graceAfter: 1.5,
    shockwaveRadius: 55,
    shockwaveSeconds: 1.5,
    shakeAmount: 1.6,
    barsFraction: 0.12,
  },
  /** Landing spot search. */
  landing: { clearance: 8, enemyRadius: 4, probeHeight: 40, probeMaxGround: 1.5, rings: 3, perRing: 12 },
  /** `?boss` waits this long (sim seconds) after boot so listeners are attached. */
  bootSpawnDelay: 0.4,
  /** Preferred distance band to the player (full size) and arena containment. */
  rangeMin: 20,
  rangeMax: 35,
  arenaMargin: 6,
  /** Yaw turn rate towards the player (rad/s): slow, so weak points swing out of view. */
  turnRate: 0.35,

  /** GDD 9.2 ability loss per destroyed weak point (ticket step 2 mapping). */
  abilities: {
    frontCannonCooldownFactor: 1.5,
    sideMissileCountReduction: 2,
    rearSlamRadiusFactor: 0.7,
    /** REVIEW #12: in core-exposed the remaining attacks come a little faster. */
    coreExposedCooldownFactor: 0.8,
  },

  /** Attack selection ranges (full size, metres). */
  ranges: { cannonMin: 6, cannonMax: 90, missileMin: 8, missileMax: 70 },
  groundSlam: { safeHeight: 3, knockback: 14, knockbackUp: 5 },
  missile: { spread: 8, flightTime: 1.1, spawnHeight: 17, arcHeight: 14, minGap: 2.5 },
  /** Pool caps besides BOSS.maxProjectiles (cannon shots). */
  pools: { missiles: 12, markers: 12 },
  /** Damage is applied at 1 m above the feet (body centre of the player). */
  playerCentreHeight: 1,

  collapseDuration: 3,
  /** Metres the folded body settles into the ground while collapsing (full size). */
  collapseSink: 1.5,
  /** Leg gait. */
  gait: { stride: 2.2, stepHeight: 1.6, cycleLength: 9 },
  weakPointProud: 0.2,
  coreRadius: 2.2,
  /** Fraction of body radius where the core centre sits on the hatch direction. */
  coreDepth: 0.95,
  flickerHz: 11,
} as const;

/** Same 2,000 + 4,000 budget the GDD 5.4 check uses. */
export const BOSS_TOTAL_HP = BOSS.weakPointCount * BOSS.weakPointHp + BOSS.coreHp;
