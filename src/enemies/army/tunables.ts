import { ARMY_ROBOT } from '@/config/tunables';

/**
 * Medium Mech Striker weapons and authored look (spec 26). The robot keeps the type id `army` and the stats in
 * ARMY_ROBOT. Model: "Medium Mech Striker" (Sketchfab, CC-BY 4.0, MSGDI), built by tools/asset-pipeline/enemies_sf.py.
 */
export const STRIKER = {
  /** Bursts of bullets: `size` rounds `interval` seconds apart, a new burst every `period` seconds (start to start). */
  burst: { size: 3, interval: 0.09, period: 1.6, damage: 5, spread: 0.03, speed: 75, minRange: 8, maxRange: 35 },
  /** A rocket now and then: telegraph (the pods glow, the mech stands still), launch, short recovery. */
  rocket: {
    minGap: 6,
    maxGap: 9,
    telegraph: 1.1,
    recover: 0.8,
    damage: ARMY_ROBOT.damage,
    splashRadius: ARMY_ROBOT.splashRadius,
    speed: ARMY_ROBOT.rocketSpeed,
    /** The first rocket needs this long in the fight (s). */
    firstGap: 3,
  },
  /** Muzzle points of the guns and the rocket pods in robot space (x mirrored per side, forward is -z, y above the feet). */
  gun: { x: 0.72, y: 2.25, z: -1.15 },
  pod: { x: 0.45, y: 3.4, z: -0.25 },
  /** Recoil kick of the body per round (rad) and its decay (1/s). */
  recoil: 0.018,
  recoilDecay: 14,
  skin: {
    url: 'assets/enemies/striker.glb',
    /** Ground speed (m/s) at which the `walk` / `run` clips at time scale 1 keep the feet planted (measured on the clips). */
    walkSpeed: 3.4,
    runSpeed: 3.6,
    /** Above this speed the run clip plays instead of the walk clip. */
    runAbove: 2.6,
    /** Lift (m) so the feet rest on the ground. */
    footLift: 0.07,
    /** Time scale limits of the locomotion clips. */
    minScale: 0.3,
    maxScale: 1.6,
    glowColor: 0xff7a2a,
    glowRadius: 0.3,
    /** Bones that carry the cues (left is -x): shoulders for the pods, forearms for the muzzle flashes. */
    podBones: ['Shoulder_L_012', 'Shoulder_R_015'],
    gunBones: ['LowerArm_L_014', 'LowerArm_R_017'],
  },
} as const;

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
