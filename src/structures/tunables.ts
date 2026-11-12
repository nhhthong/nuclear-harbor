/** Feature-local dimensions for T-04 (metres). Shared numbers live in `@/config/tunables`. */

export const CRANE = {
  /** Leg centres at (+-legX, +-legZ) in the crane's local frame. */
  legX: 8,
  legZ: 5,
  legHalf: 0.7,
  legHeight: 24,
  portalHalf: 0.8,
  portalY: 24.8,
  midY: 11,
  midHalf: 0.5,
  boomY: 27,
  boomHalfWidth: 0.9,
  boomHalfHeight: 1,
  boomZMin: -6,
  boomZMax: 34,
  cabin: { x: 2, y: 1.5, z: 2.5, centerY: 29.5 },
  /** Distance beyond which the 6-box low LOD is shown (GDD 13.3). */
  lodDistance: 150,
  /** Variant colours of the shared frame material (per instance colour). */
  palette: [0xd9a514, 0xc4532a, 0x2f6f9f, 0xa3a8ac, 0x4f8f5a, 0xb8860b],
  accentColor: 0x40464c,
} as const;

export const ANCHOR = {
  /** Anchor points sit this far outside the collider surface they belong to. */
  surfaceOffset: 0.1,
  /** Perch anchor height above the slab (same as the sandbox perch). */
  perchAnchorHeight: 2.2,
  perchAnchorInset: 0.15,
} as const;

export const PERCH = {
  halfWidth: 3,
  slabHalfThickness: 0.2,
  columnHalf: 0.6,
  mastHalf: 0.2,
  mastHalfHeight: 2.5,
  /** Distance of the perch towers from the boss arena centre (outside the keep-clear disc). */
  ringRadius: 34,
  /** Angles (deg, counter-clockwise from +X on the XZ plane) of the six towers, kept on land. */
  ringAnglesDeg: [-20, 30, 80, 130, 180, 220],
} as const;

export const PLATFORM = {
  halfWidth: 4,
  slabHalfThickness: 0.25,
  legOffset: 3.2,
  legHalf: 0.5,
} as const;

export const LAMP = {
  heights: [8, 9, 10],
  postHalf: 0.15,
  armLength: 1.6,
  armHalf: 0.1,
  /** Target spacing of the regular pattern; actual spacing divides each zone evenly. */
  spacing: 36,
  /** Candidate grid for the greedy fill. */
  candidateStep: 5,
  /** Margin kept from keep-clear discs and the land border. */
  keepClearMargin: 2,
  landMargin: 3,
  buildingMargin: 3,
  perchMargin: 5,
} as const;

export const COVERAGE = {
  zones: ['B', 'D'],
  gridStep: 5,
  /** Walkable samples keep this distance from solid ground footprints (player radius + slack). */
  solidMargin: 0.5,
  /** Required share of line-of-sight coverage at runtime (AC3). */
  minLosShare: 0.95,
} as const;
