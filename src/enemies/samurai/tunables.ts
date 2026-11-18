/**
 * Cyber samurai (enemy type `samurai`): an elite, twice as tough and twice as dangerous as a regular
 * robot (army mech: 150 HP, 12 damage). One per area at most, never in the semi-boss's area.
 */
export const SAMURAI = {
  hp: 300,
  /** Model height about 3.2 m; the root sits at the body centre. */
  centerHeight: 1.5,
  /** Authored look (CC-BY robot + CC0 naginata), see skin.ts; same-origin, relative to the page. */
  skinUrl: 'assets/enemies/samurai.glb',
  /** With the skin the pose's weapon angles are applied as pitch about the rest value, so the rest angle is 0. */
  skinRestAngle: 0,
  /** The skin's naginata points forward from the wrist, tip lowered by this much (rad), like the source katana. */
  skinWeaponDroop: 0.15,
  /** With the skin, the charge-up glow tints the whole armour: emissive per unit of glow above the rest value. */
  skinGlowTint: 0.12,
  radius: 0.8,
  patrolSpeed: 2.4,
  chaseSpeed: 6.2,
  /** Speed changes are eased (m/s^2) so it steps off and settles instead of snapping. */
  acceleration: 9,
  deceleration: 16,
  detectionRange: 34,
  loseTargetTime: 4,
  arriveRadius: 1.2,
  /** Quick cut when the player stands close. */
  cut: { range: 3.2, windup: 0.35, recover: 0.45, damage: 18, cooldown: 1.3, halfAngle: 1.0 },
  /** Skill 1: leap to the player and cleave on landing. */
  leap: {
    min: 5,
    max: 17,
    telegraph: 0.5,
    airTime: 0.55,
    apex: 3.2,
    /** Lands this far short of the locked position (m). */
    standOff: 1.7,
    radius: 3.4,
    halfAngle: 1.25,
    damage: 24,
    knockback: 7,
    recover: 0.55,
    cooldown: 4.5,
    /** Player feet this far above the ground dodge the cleave (double jump). */
    clearance: 1.8,
  },
  /** Skill 2: spins the polearm like a fan and deflects shots from the front. */
  spin: { seconds: 3, cooldown: 7, reduction: 0.85, frontHalfAngle: 1.35, triggerDamage: 50, window: 1.2, advanceSpeed: 1.6, spinRate: 22 },
  /** Skill 3: charges, then flashes between random points of an area, leaving faint lightning. */
  dash: {
    uses: 2,
    /** HP fractions at which a use is spent (first below 70%, second below 35%). */
    hpGates: [0.7, 0.35] as readonly number[],
    range: 16,
    charge: 0.8,
    count: 6,
    radius: 8.5,
    /** Seconds per dash and pause between two dashes. */
    time: 0.1,
    pause: 0.07,
    minLength: 5,
    hitRadius: 1.5,
    damage: 12,
    recover: 0.7,
    /** Lightning trail fade time (s). */
    trailSeconds: 0.9,
  },
} as const;
