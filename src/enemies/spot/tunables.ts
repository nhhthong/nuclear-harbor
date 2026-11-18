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
  /** Body drop (m) at the end of the crouch telegraph; the trot itself lives in `src/enemies/gait.ts`. */
  crouchDrop: 0.1,
  /** Far LOD switch distance (m). */
  lodFar: 38,
  /** Waypoint tolerance (m). */
  arriveRadius: 0.8,
  /** Defend-phase arrival tolerance (m). */
  commandArriveRadius: 3,
  /**
   * Authored look (spec 26): "Walking Robotic Dog" (Sketchfab, CC-BY 4.0, reececreoplan), built by
   * tools/asset-pipeline/enemies_sf.py. Behaviour, stats and hit volumes are unchanged.
   */
  skin: {
    url: 'assets/enemies/spot.glb',
    /** Ground speed (m/s) at which the `walk` clip (6.3 s per cycle) at time scale 1 keeps the feet planted (measured on the clip). */
    walkSpeed: 2.1,
    /** Time scale limits of the walk clip. */
    minScale: 0.3,
    maxScale: 4,
    /** Lift (m) so the feet rest on the ground. */
    footLift: 0.02,
    /** Glow colours of the telegraph (lamps in the procedural model): the head glows red while it crouches. */
    glowColor: 0xff2a1a,
    glowRadius: 0.2,
    glowBone: 'Joint_1_00_26',
  },
} as const;
