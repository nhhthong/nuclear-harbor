/** Spot dog numbers (T-19). Enemy id `spot`. Speeds start from GDD 6.2 (speed 5, detection 30). */
export const SPOT = {
  hp: 70,
  detectionRange: 30,
  loseTargetTime: 5,
  patrolSpeed: 2.5,
  /** Chase speed (m/s): above the player's walk (6.5), below the sprint (10). */
  chaseSpeed: 8.6,
  /** Start the crouch telegraph within this distance (m) with line of sight. */
  lungeRange: 7,
  /** Crouch before the leap (s), also the glow ramp. */
  telegraphTime: 0.45,
  lungeSpeed: 15,
  lungeMaxDistance: 9,
  /** Leap arc height (visual, m). */
  lungeArcHeight: 0.5,
  damage: 10,
  /** Knockback applied to the player (m/s) along the lunge direction, plus lift. */
  knockbackSpeed: 7,
  knockbackUp: 2.5,
  /** Seconds after a lunge before the next telegraph may start. */
  cooldown: 2.5,
  /** Backing away right after the lunge (s, m/s), then circling the player at `circleRadius` (m). */
  backoffTime: 0.8,
  backoffSpeed: 6.5,
  circleRadius: 6,
  circleSpeed: 5,
  /** Contact test: horizontal reach (m) = player radius + Spot half length, and vertical reach (m). */
  contactReach: 1.15,
  contactHeight: 1.6,
  /** Size. */
  modelScale: 0.55,
  centerHeight: 0.8,
  /** Hit volumes relative to the centre: chassis box and the sensor nose (critical). */
  bodyHalf: { x: 0.5, y: 0.5, z: 0.85 },
  bodyCenterY: 0,
  noseHalf: { x: 0.3, y: 0.2, z: 0.2 },
  noseForward: 0.75,
  noseUp: 0.25,
  radius: 0.8,
  /** Trot animation. */
  trotFrequency: 2.4,
  /** Leg swing amplitude (rad) while trotting, and the stretched gallop pose during the lunge. */
  trotSwing: 0.45,
  lungeSwing: 0.6,
  crouchDrop: 0.1,
  /** Far LOD switch distance (m). */
  lodFar: 38,
  /** Waypoint tolerance (m). */
  arriveRadius: 0.8,
  /** Defend-phase arrival tolerance (m). */
  commandArriveRadius: 3,
} as const;
