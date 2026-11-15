/** Feature-local numbers of the army mech (shared GDD/ticket numbers live in ARMY_ROBOT). */
export const ARMY_LOCAL = {
  /** Centre height of the kinematic body above the ground (m); the model is offset down by this. */
  centerHeight: 1.9,
  /** Radius used for separation. */
  radius: 0.9,
  /** Distance beyond which the far (1 draw call) model is shown (m). */
  lodFarDistance: 45,
  /** Retreat ends this many metres beyond the retreat distance. */
  retreatExitMargin: 3,
  /** Engage ends when the player is this factor beyond the band. */
  engageHysteresis: 1.12,
  /** Strafe: step length towards the goal (m) and time between direction flips (s). */
  strafeStep: 5,
  strafeFlipMin: 2.5,
  strafeFlipMax: 5,
  /** Retreat goal distance behind the mech (m). */
  retreatGoalDistance: 10,
  /** Patrol: idle scan pause at a waypoint (s) and head scan amplitude (rad). */
  patrolPause: 1.6,
  scanAmplitude: 0.7,
  /** Cooldown before the first telegraph after entering engage (s). */
  firstShotDelay: 0.6,
  /** Foot-down dust puff is only spawned this close to the player (m). */
  footDustRange: 30,
  /** Rocket muzzle in mech-local space (x is mirrored per side; forward is -z, y above the centre). */
  muzzle: { x: 0.64, y: 1.05, z: -0.75 },
  /** Aim height above the player's feet (m). */
  aimHeight: 1.2,
  /** Missile-cell glow intensity per level (index = round(level * (n - 1))). */
  glowLevels: [0.05, 0.8, 1.6, 2.6, 3.6],
  /** Hit volumes in game space relative to the body centre (forward is -z). */
  hit: {
    torso: { y: 0.95, hx: 0.95, hy: 0.65, hz: 0.55 },
    legs: { y: -0.9, hx: 0.75, hy: 1.0, hz: 0.4 },
    head: { y: 0.95, z: -0.38, hx: 0.3, hy: 0.28, hz: 0.3 },
  },
} as const;
