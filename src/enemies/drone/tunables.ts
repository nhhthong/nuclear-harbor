import { WAREHOUSE } from '@/config/warehouse';

/**
 * Flying dragonfly drone (enemy type `drone`, spec 29). Roster size lives in `ENEMY_COUNTS.drone`
 * (src/config/tunables.ts); everything else is here. Distances in metres, times in seconds.
 */
export const DRONE = {
  /** Two rifle hits (25 each). */
  hp: 40,
  /** Hit ball (Groups.enemy) and the radius of the sphere cast used to fly around the world. */
  hitRadius: 0.6,
  bodyRadius: 0.45,
  /** Gap kept to static geometry in the direction of motion. */
  skin: 0.15,
  modelScale: 1,

  /** Cruise band above the floor under the drone, and the gap kept below a ceiling. */
  cruiseMin: 3,
  cruiseMax: 6,
  ceilingMargin: 0.9,
  /** Down/up probe length (beyond it the floor is taken at y = 0 and the sky is open). */
  probeDown: 30,
  probeUp: 20,
  /** Stand-off band around the player (horizontal), orbit speed (rad/s) and the orbit lead of the target (rad). */
  standoffMin: 5,
  standoffMax: 10,
  orbitSpeed: 0.55,
  orbitLead: 0.5,
  /** Preferred height above the player's eye while engaging (clamped into the cruise band). */
  aboveEye: 1.2,

  speed: 7,
  patrolSpeed: 4,
  /** Slower through openings. */
  openingSpeed: 3.5,
  /** Horizontal acceleration limit (m/s^2) so the drone eases in and out. */
  accel: 10,
  turnRate: 5,

  /** Avoidance: look this far ahead; candidate yaw offsets (rad) and pitch offsets tried when the way is blocked. */
  lookAhead: 4,
  yawOffsets: [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2, Math.PI] as readonly number[],
  pitchOffsets: [0, 0.6, -0.5] as readonly number[],
  /** Unstick: less than `progress` metres moved (net) in `window` s while the target is away -> climb for `climbTime`, then turn. */
  stuck: { window: 1.5, progress: 0.4, climbTime: 1.0, turnTime: 1.2, turnAngle: Math.PI / 2 },

  /** Perception and memory. */
  detectionRange: 32,
  memory: 10,

  /** Boss-style bolt: glow telegraph (`tell`) then a fast plasma bolt. */
  bolt: { damage: 4, speed: 24, tell: 0.55, interval: [1.8, 2.8] as readonly [number, number], range: 30 },
  /** Telegraph glow radius at full level (m). */
  glowRadius: 0.5,

  /** Openings: the approach point is this far outside the wall along the normal, the inside point this far inside. */
  opening: { approach: 3.5, inside: 3, arrive: 0.7 },

  /** Death: the wreck falls with this gravity and spin, then bursts (small explosion) on the floor. */
  death: { gravity: 16, spin: 7, maxTime: 3, explosionScale: 0.7, cap: 8 },

  /** Anti-camping call-in (player on the mezzanine). Call-in drones are not part of the roster. */
  callIn: {
    campSeconds: 8,
    count: 2,
    /** Only while fewer than this many call-in drones are alive. */
    maxAlive: 2,
    maxPerRun: 6,
    /** The player counts as on the mezzanine above `floorY - yMargin`. */
    yMargin: 0.5,
    /** Spawn this far beyond the approach point of the chosen opening. */
    spawnOut: 5,
  },
} as const;

/**
 * The closed south-east block (loading dock, outside the play area): drones never target a point in it.
 * East of the warehouse's west wall (minus a margin) and south of its south wall.
 */
export const DRONE_NO_FLY = {
  minX: WAREHOUSE.footprint.minX - 2,
  maxX: 40,
  minZ: WAREHOUSE.footprint.maxZ,
  maxZ: 40,
} as const;
