/** Feature-local numbers for the pickups module (shared economy numbers live in ECONOMY). */
export const PICKUP = {
  /** Max vertical distance between the player's feet and the pickup's resting surface. */
  verticalReach: 1.5,
  /** Ray start height used to find the first surface below a candidate (ticket: 40 m). */
  rayStartY: 40,
  rayMaxDistance: 60,
  /** Non-elevated pickups should rest near the ground: higher hits trigger a nearby re-search. */
  groundMaxY: 1,
  /** Re-search ring radii (m) and number of directions. */
  searchRadii: [2, 4] as readonly number[],
  searchDirections: 8,
  /** Visual hover above the surface plus bob and spin. */
  hover: 0.55,
  bobAmplitude: 0.1,
  bobSpeed: 2,
  spinSpeed: 1.2,
  /** Drops blink during their last seconds. */
  blinkWindow: 5,
  blinkHz: 4,
  /** Per-kind instanced capacity (38 placed + drops + test spawns). */
  capacityPerKind: 48,
  /** Boss supply ring distance beyond BOSS_ARENA.radius. */
  bossRingOffset: 2.5,
  /** Number of zones the drop pool is sized for. */
  zoneCount: 4,
} as const;
