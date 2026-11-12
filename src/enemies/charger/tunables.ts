/** Feature-local numbers for the Charger (shared GDD numbers live in CHARGER_ROBOT). */
export const CHARGER_LOCAL = {
  /** Distance between ground samples along the planned line (m). */
  edgeSampleStep: 2,
  /**
   * The charge stops this far before the first sample without ground (m). Covers the sample step
   * plus the in-charge edge probe, so the robot never reaches the real edge.
   */
  edgeSafetyMargin: 5.5,
  /** Obstacle contact tolerance when the per-tick forward probe stops the robot (m). */
  wallContactGap: 0.05,
  /** Lateral offset of the side rays used to plan against walls (fraction of half width). */
  sideRayFactor: 0.95,
  /** Lose the target after this long without line of sight (s). */
  loseTargetTime: 4,
  /** Player hit radius used by the capsule-vs-box contact test (m). */
  playerRadius: 0.45,
  playerHeight: 1.8,
  /** Move away when the player is closer than the charge window, this far (m). */
  backOffDistance: 10,
  /** Telegraph strip. */
  stripWidth: 1.6,
  stripY: 0.04,
  /** Emissive levels of the shared light materials (index = ramp step). */
  lightLevels: [0.1, 0.6, 1.2, 1.9, 2.6, 3.4],
  ventBase: 0.5,
  ventStunned: 4,
  /** Model proportions. */
  shieldThickness: 0.22,
  shieldTilt: 0.45,
} as const;
