/**
 * All numbers of the scorpion semi-boss. Starting values to be playtested; `proposed`
 * unless the ticket (docs/tickets/ROBOT-REFRESH.md) fixes them.
 */
export const SCORPION = {
  /** ticket: HP about 1500, about 9 m tall. */
  hp: 1300,
  /** Scaled for the tiny quay (the first version was 9 m on a much larger map). */
  /** Height of the arched tail; the body is about 1.4 m high and 6 m long with the claws. */
  heightM: 4.6,
  /** Collision/avoidance radius of the body (m). */
  bodyRadius: 2.2,
  /** ticket: spawns when the player first comes this close to its tower (horizontal, m). */
  triggerRadius: 15,
  /** Number of guarded towers per run. */
  guardCount: 1,
  /** Distance from the tower where the scorpion appears (m); the spot search rotates around it. */
  spawnRing: 9,
  /** Free-space probe radius used by the spawn spot search (m). */
  spawnClearRadius: 3,
  /** Max distance from its guard spot (m). */
  leashRadius: 20,
  /** Ground covered by one full gait cycle (m); the leg phase is advanced by distance, not time. */
  strideLength: 1.5,
  walkSpeed: 4.2,
  /** Turn rate while walking (rad/s). */
  turnRate: 1.5,
  /** Detect/forget the player (m). */
  aggroRange: 34,
  /** Below this HP share the scorpion is enraged: brighter glow, lashing tail, smoke, shorter recovery. */
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
      /** Thrown straight back along the charge, with some lift. */
      knockback: 22,
      knockUp: 6,
      stun: 2.5,
      cooldown: 7,
      stripWidth: 4.4,
    },
    /** Venom shot: the stinger lobs a glob that bursts into a green pool; the pool keeps hurting. */
    venom: {
      min: 7,
      max: 30,
      telegraph: 1.1,
      /** Flight time (s) and arc height (m) of the glob. */
      flight: 0.8,
      apex: 5,
      radius: 4.5,
      /** Burst damage at the centre and the fraction left at the edge. */
      damage: 14,
      edgeFraction: 0.4,
      /** The pool: lifetime, damage per tick and tick length (s); feet above `poolHeight` are safe. */
      poolSeconds: 5,
      tickDamage: 5,
      tickInterval: 0.5,
      poolHeight: 1.2,
      cooldown: 8,
    },
    /** Tail slam: the tail whips over the head into the ground; blasts run outwards in a fan. */
    tailSlam: {
      max: 8.5,
      telegraph: 0.9,
      /** Time of the strike itself and the hold afterwards (s). */
      strikeSeconds: 0.2,
      holdSeconds: 0.45,
      radius: 9,
      /** Half opening angle of the fan (rad). */
      halfAngle: 0.6,
      damage: 28,
      /** Player feet this far above the ground are safe (double jump dodge). */
      clearance: 1.9,
      knockback: 9,
      cooldown: 5,
    },
    /** Below `venom.min` the scorpion prefers the tail slam, below this the venom shot, beyond it the charge. */
    venomPreferMax: 14,
  },
  /**
   * Claw guard: after taking `triggerDamage` within about `window` seconds the scorpion crosses its
   * claws and raises a hex shield for `seconds`. Hits from inside the front arc lose `reduction`.
   */
  guard: { reduction: 0.8, seconds: 2.8, cooldown: 7, triggerDamage: 90, window: 1.5, frontHalfAngle: 1.3 },
  /** Player vertical reach for stomp/ram checks. */
  ramHeight: 2.4,
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
  /**
   * Getting out of a wedge (spec 33): it wanted to walk but moved less than `minMove` m in `window` s.
   * It then crawls along the most open of `headings` probe rays for `crawlSeconds`; stuck again within
   * `repeatWithin` s, or boxed in on every side (nothing clear beyond `boxedClearance` m), it is moved to
   * the nearest free spot instead (rings of `relocateStep` m up to `relocateMax` m).
   */
  stuck: {
    window: 3,
    minMove: 1,
    headings: 16,
    probeLength: 6,
    crawlSeconds: 1.8,
    crawlSpeedFactor: 0.8,
    repeatWithin: 8,
    boxedClearance: 1.8,
    relocateStep: 2,
    relocateMax: 16,
    /** Free radius needed at a relocation spot (m). */
    freeRadius: 3,
  },
  /** Spawn sandbox fixture position. */
  sandboxSpot: { x: 0, z: -14 },
  /** Debug HP bar visible within this distance (m). */
  hpBarRange: 40,
} as const;
