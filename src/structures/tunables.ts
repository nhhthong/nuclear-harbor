/** Numbers of the quay structures. Placement lives in `layout.ts`. */
export const STRUCTURES = {
  fenceHeight: 2.6,
  /** Same-origin, relative to the page (CC0 / CC-BY models, see docs/ASSETS.md). */
  vehiclesUrl: 'assets/props/vehicles.glb',
  /** Smoke above burning wrecks: one puff every interval (s) while the player is within range (m). */
  smokeInterval: 0.25,
  smokeRange: 75,
  smokeScale: 2.4,
} as const;
