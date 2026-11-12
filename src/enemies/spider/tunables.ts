/** Feature-local numbers for the spider robot (shared GDD numbers live in SPIDER_ROBOT). */
export const SPIDER_LOCAL = {
  /** Patrol speed as a fraction of SPIDER_ROBOT.speed. */
  patrolSpeedFactor: 0.6,
  /** Strafe speed while attacking, as a fraction of full speed. */
  strafeSpeedFactor: 0.3,
  strafeDistance: 3,
  strafeFlipTime: 2.5,
  /** Flank state: minimum / maximum time (s) and reach tolerance (m). */
  flankMinTime: 0.6,
  flankTimeout: 6,
  flankArriveRadius: 1.5,
  /** Player moved this far (m) from where the flank point was computed: stop flanking. */
  flankPlayerMoveLimit: 12,
  /** Attack range hysteresis (attack kept until the player is this much beyond range). */
  attackRangeHysteresis: 1.1,
  /** Bolts per burst and the gap between them (s). */
  burstCount: 2,
  burstGap: 0.12,
  firstShotDelay: 0.5,
  aimHeight: 1.2,
  /** Hop: probe distance ahead, ray heights, duration (s), cooldown (s). */
  hopProbeDistance: 2,
  hopLowRayHeight: 0.3,
  hopClearMargin: 0.2,
  hopDuration: 0.5,
  hopApexExtra: 0.4,
  hopCooldown: 1.2,
  /** Arrival tolerances. */
  arriveRadius: 0.8,
  commandArriveRadius: 3,
  /** Body geometry. */
  centerHeight: 0.75,
  bodyHalfHeight: 0.22,
  domeRadius: 0.34,
  domeUp: 0.18,
  /** Legs. */
  hipY: -0.05,
  hipX: 0.62,
  hipZSpacing: 0.5,
  homeX: 1.75,
  homeZSpacing: 0.9,
  legRadius: 0.05,
  strideThreshold: 0.55,
  stepDuration: 0.2,
  stepHeight: 0.32,
  stepLead: 0.45,
  kneeLift: 0.35,
  /** Speed (m/s) below which the spider counts as idle for the gait. */
  idleSpeed: 0.2,
  /** Simplified level body bob. */
  bobAmplitude: 0.04,
  bobSpeed: 4,
  /** Colors. */
  bodyColor: 0x4a3a5c,
  legColor: 0x2d2638,
  domeColor: 0x300000,
  domeEmissive: 0xff2a1a,
} as const;
