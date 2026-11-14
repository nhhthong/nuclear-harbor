/** Numbers of the quay structures (flood lights, fence). Placement lives in `layout.ts`. */
export const STRUCTURES = {
  /** Global gain on the candela values in `FLOOD_LIGHTS` (one knob for the exposure balance). */
  floodGain: 0.36,
  floodRange: 60,
  /** Half cone angle (rad) and penumbra share of the spot lights. */
  floodAngle: 0.66,
  floodPenumbra: 0.6,
  floodShadowSize: 1024,
  /** Brightness of the fake volumetric beams. */
  beamStrength: 0.5,
  fenceHeight: 2.6,
} as const;
