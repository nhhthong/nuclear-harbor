import type { QualityPreset } from '@/config/tunables';

/** Feature-local VFX numbers (proposed, GDD 13.4 / 16). */
export const VFX = {
  /** Total live particle budget per quality preset. */
  budget: { low: 600, medium: 1500, high: 3000 } satisfies Record<QualityPreset, number>,
  /** Share of the budget that goes to the additive buffer (the rest is the alpha buffer). */
  additiveShare: 0.6,
  /** Low-priority effects (dust, smoke) are refused once their buffer is this full. */
  lowPriorityFill: 0.8,
  /** Absolute buffer capacity (largest preset). */
  maxCapacity: 3000,
  maxLights: 3,
  maxRings: 8,
  maxScheduled: 32,
  /** `player:landed` below this impact speed (m/s) shows nothing. */
  hardLandingSpeed: 8,
  landingScaleMax: 2.5,
  landingSpeedForMaxScale: 20,
  defaultRingDuration: 1,
  ringStartFraction: 0.2,
  decalSize: 0.35,
  decalOffset: 0.012,
  spriteSize: 64,
  maxPointPixels: 256,
  testInterval: 2,
  testDistance: 6,
  testHeight: 1.2,
  /** Boss defeat: staged explosions over about 2 s (offsets in metres relative to the boss). */
  bossDefeatStages: [
    { t: 0.0, x: 0, y: 3, z: 0, kind: 'explosion', scale: 1.6 },
    { t: 0.3, x: 3, y: 5, z: -2, kind: 'explosion', scale: 1.8 },
    { t: 0.6, x: -3, y: 2, z: 2, kind: 'explosion', scale: 2 },
    { t: 0.9, x: 2, y: 7, z: 3, kind: 'explosion', scale: 2.2 },
    { t: 1.2, x: -2, y: 4, z: -3, kind: 'explosion', scale: 2.4 },
    { t: 1.5, x: 0, y: 6, z: 0, kind: 'explosion', scale: 2.6 },
    { t: 1.8, x: 0, y: 4, z: 0, kind: 'smoke', scale: 3 },
    { t: 2.0, x: 0, y: 4, z: 0, kind: 'big-explosion', scale: 3 },
  ],
  bossCoreExposedScale: 1.5,
  weakPointBurstScale: 2.5,
  towerActivatedScale: 2.5,
  chargerStunScale: 1.2,
} as const;
