/**
 * All numbers of the dinosaur semi-boss (T-21). Starting values to be playtested; `proposed`
 * unless the ticket (docs/tickets/ROBOT-REFRESH.md) fixes them.
 */
export const DINO = {
  /** ticket: HP about 1500, about 9 m tall. */
  hp: 1300,
  /** Scaled for the tiny quay (the first version was 9 m on a much larger map). */
  heightM: 6,
  /** Collision/avoidance radius of the body (m). */
  bodyRadius: 2.2,
  /** ticket: spawns when the player first comes this close to its tower (horizontal, m). */
  triggerRadius: 15,
  /** Number of guarded towers per run. */
  guardCount: 1,
  /** Distance from the tower where the dinosaur appears (m); the spot search rotates around it. */
  spawnRing: 9,
  /** Free-space probe radius used by the spawn spot search (m). */
  spawnClearRadius: 3,
  /** Max distance from its guard spot (m). */
  leashRadius: 20,
  walkSpeed: 4.2,
  /** Turn rate while walking (rad/s). */
  turnRate: 1.5,
  /** Detect/forget the player (m). */
  aggroRange: 34,
  /** Below this HP share the dinosaur is enraged: brighter glow, lashing tail, smoke, shorter recovery. */
  enrageFraction: 0.4,
  enragedRecover: 0.55,
  /** Pause after any skill before it may act again (s). */
  recover: 0.9,
  spawn: {
    /** Rise-out-of-the-ground time (s). */
    riseSeconds: 2.4,
    roarSeconds: 1.8,
    /** Camera shake amplitude (m) and length (s). */
    shake: 0.14,
    shakeSeconds: 2,
  },
  skills: {
    ram: {
      min: 11,
      max: 30,
      telegraph: 1.0,
      speed: 16,
      /** Max charge length (m). */
      maxDistance: 28,
      damage: 25,
      /** Contact radius around the body centre (m). */
      hitRadius: 2.6,
      knockback: 14,
      stun: 2.5,
      cooldown: 7,
      stripWidth: 4.4,
    },
    leapStomp: {
      min: 6,
      max: 22,
      telegraph: 1.0,
      airTime: 0.85,
      apex: 5,
      radius: 6,
      damage: 30,
      /** Damage fraction at the edge of the radius. */
      edgeFraction: 0.3,
      stun: 1.4,
      cooldown: 8,
      knockback: 10,
    },
    tailSpin: {
      max: 7,
      telegraph: 0.9,
      spinSeconds: 0.8,
      radius: 6.5,
      damage: 20,
      /** Half angular width of the tail sweep (rad). */
      sweepHalfWidth: 0.5,
      /** Player feet this far above the dinosaur's ground level are safe (grapple/perch dodge). */
      clearance: 1.9,
      knockback: 9,
      cooldown: 5,
    },
    /** Below this distance the dinosaur prefers the tail spin, below `leapPreferMax` the leap. */
    leapPreferMax: 13,
  },
  /** Player vertical reach for stomp/ram checks. */
  stompHeight: 2.6,
  ramHeight: 3.6,
  drops: {
    ammoCrates: 4,
    medkits: 1,
    /** Scatter radius around the corpse (m). */
    scatter: 3.5,
    /** Max live drop pickups at once. */
    capacity: 12,
    lifetimeSeconds: 120,
    pickupRadius: 1.4,
  },
  /** Telegraph decal. */
  telegraphY: 0.06,
  /** Camera shake from a stomp landing / roar. */
  stompShake: 0.22,
  /** Distance after which the shake fades out (m). */
  shakeRange: 50,
  /** Wall probe: distance ahead of the body radius (m) and probe heights (m). */
  probeAhead: 1.2,
  probeHeights: [1, 2.4] as readonly number[],
  /** The body may not walk or charge closer than this to the land edge (m). */
  edgeMargin: 4,
  /** Spawn sandbox fixture position. */
  sandboxSpot: { x: 0, z: -14 },
  /** Debug HP bar visible within this distance (m). */
  hpBarRange: 40,
} as const;
