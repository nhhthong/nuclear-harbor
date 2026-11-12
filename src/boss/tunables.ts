import { BOSS } from '@/config/tunables';

/** Weak point order: index into every weak point array. */
export const WEAK_POINT = { front: 0, back: 1, left: 2, right: 3 } as const;

/**
 * Boss-local numbers that are not part of the shared GDD table (docs/PLAN.md section 3). Anything
 * the GDD fixes lives in `BOSS` (src/config/tunables.ts).
 */
export const BOSS_LOCAL = {
  /** `?sandbox`: scale and spawn position so the boss fits the test scene (ticket step 5). */
  sandbox: { scale: 0.4, position: { x: -20, y: 0, z: 24 }, arenaRadius: 14 },
  /** Body centre height of the full-size boss (overall height = this + body radius = 22 m). */
  bodyCenterY: 14.5,
  /** `?boss` waits this long (sim seconds) after boot so listeners are attached. */
  bootSpawnDelay: 0.4,
  /** Height above the ground the boss drops from while awakening (full size). */
  dropHeight: 40,
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
  missile: { spread: 8, flightTime: 1.1, spawnHeight: 30, arcHeight: 14, minGap: 2.5 },
  heavyCannon: { muzzleForward: 6, muzzleHeight: 17 },
  /** Pool caps besides BOSS.maxProjectiles (cannon shots). */
  pools: { missiles: 12, markers: 12 },
  /** Damage is applied at 1 m above the feet (body centre of the player). */
  playerCentreHeight: 1,

  collapseDuration: 3,
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
