/** Bomber Duck numbers (T-19). Enemy id `duck`. */
export const DUCK = {
  hp: 60,
  detectionRange: 28,
  loseTargetTime: 4,
  /** Walk speed while patrolling (m/s). */
  patrolSpeed: 2,
  /** Average hop speed (m/s): above the player's walk (6.5), below the sprint (10). */
  hopSpeed: 8,
  /** One hop lasts this long (s); the duck is grounded for `landFraction` of it. */
  hopPeriod: 0.62,
  landFraction: 0.2,
  hopHeight: 0.55,
  /** Within this distance (m) the duck stops and arms. */
  armDistance: 2.5,
  /** Fuse: counts of `countSeconds` each. */
  countdownCount: 3,
  countSeconds: 1,
  /** Blast: fixed damage inside the radius (m). */
  blastDamage: 15,
  blastRadius: 4,
  /** Impulse pushing the player away from the blast (m/s). */
  blastKnockback: 6,
  blastKnockbackUp: 2,
  /** Player chest height used for the blast distance (m). */
  blastAimHeight: 0.9,
  /** Visual and physical size. */
  centerHeight: 0.62,
  /** Hit volumes relative to the robot centre: torso+legs box and the head ball (critical). */
  bodyHalf: { x: 0.42, y: 0.45, z: 0.32 },
  bodyCenterY: -0.12,
  headRadius: 0.36,
  headUp: 0.75,
  /** Separation radius reported to the base class. */
  radius: 0.5,
  modelScale: 0.5,
  /** Beacon pulse of the whole model on each count (fraction). */
  beepPulse: 0.12,
  /** Beacon flash rate (Hz) for count 3, 2, 1. */
  flashHz: [2, 4, 8],
  /** Ground ring while arming. */
  ringY: 0.06,
  ringColor: 0xff3b1f,
  ringOpacity: 0.4,
  /** Far LOD switch distance (m). */
  lodFar: 38,
  /** Scale of the detonation effect. */
  blastVfxScale: 2.6,
  /** Waypoint tolerance (m). */
  arriveRadius: 0.8,
} as const;
