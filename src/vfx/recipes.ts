import type { VfxKind } from '@/core/types';

/** Internal recipe ids: every public `VfxKind` plus effects that have no public kind. */
export type RecipeId = VfxKind | 'weakpoint-burst';

export type BlendLayer = 'add' | 'alpha';
type Rgba = readonly [number, number, number, number];

/** One emission of a recipe. Count, speed and size are multiplied by the request scale. */
interface ParticleLayer {
  buffer: BlendLayer;
  count: number;
  speedMin: number;
  speedMax: number;
  /** Half-angle of the emission cone around the normal in degrees (180 = sphere). */
  coneDeg: number;
  lifeMin: number;
  lifeMax: number;
  size0: number;
  size1: number;
  /** Multiple of g; negative rises. */
  gravity: number;
  drag: number;
  from: Rgba;
  to: Rgba;
  /** Dropped first when the buffer is nearly full. */
  lowPriority: boolean;
  /** Random start offset radius in metres. */
  spread: number;
}

interface FlashLight {
  color: number;
  intensity: number;
  range: number;
  duration: number;
}

interface RingSpec {
  /** Final radius in metres at scale 1. */
  radius: number;
  duration: number;
  color: number;
  /** Request `duration` overrides the ring duration (telegraph-ring). */
  useRequestDuration: boolean;
}

export interface Recipe {
  layers: readonly ParticleLayer[];
  flash?: FlashLight;
  ring?: RingSpec;
}

// Additive colours are linear HDR: components above 1 feed the bloom pass.
const SPARK_HOT: Rgba = [3.2, 2.3, 0.9, 1];
const SPARK_END: Rgba = [1.2, 0.25, 0.05, 0];

export const RECIPES: Record<RecipeId, Recipe> = {
  // bullet impact: fast ricochet sparks, a hot core flash and a small puff of dust
  spark: {
    layers: [
      { buffer: 'add', count: 14, speedMin: 4, speedMax: 13, coneDeg: 50, lifeMin: 0.15, lifeMax: 0.45, size0: 0.055, size1: 0.015, gravity: 1, drag: 1, from: SPARK_HOT, to: SPARK_END, lowPriority: false, spread: 0.02 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.2, coneDeg: 180, lifeMin: 0.06, lifeMax: 0.08, size0: 0.38, size1: 0.1, gravity: 0, drag: 0, from: [4, 3, 1.6, 1], to: [1.5, 0.6, 0.1, 0], lowPriority: false, spread: 0 },
      { buffer: 'alpha', count: 4, speedMin: 0.4, speedMax: 1.6, coneDeg: 60, lifeMin: 0.35, lifeMax: 0.7, size0: 0.12, size1: 0.5, gravity: -0.03, drag: 2, from: [0.6, 0.58, 0.55, 0.4], to: [0.5, 0.48, 0.45, 0], lowPriority: true, spread: 0.04 },
    ],
  },
  'armor-spark': {
    layers: [
      { buffer: 'add', count: 20, speedMin: 7, speedMax: 16, coneDeg: 24, lifeMin: 0.2, lifeMax: 0.5, size0: 0.07, size1: 0.02, gravity: 0.6, drag: 0.6, from: [1.8, 2.4, 3.4, 1], to: [0.4, 0.7, 1.4, 0], lowPriority: false, spread: 0.02 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.5, coneDeg: 180, lifeMin: 0.08, lifeMax: 0.1, size0: 0.55, size1: 0.15, gravity: 0, drag: 0, from: [3, 3.4, 4, 1], to: [0.6, 0.8, 1.2, 0], lowPriority: false, spread: 0 },
    ],
  },
  'weakpoint-burst': {
    layers: [
      { buffer: 'add', count: 26, speedMin: 2, speedMax: 9, coneDeg: 80, lifeMin: 0.25, lifeMax: 0.7, size0: 0.13, size1: 0.03, gravity: 0.4, drag: 1.2, from: [3.6, 0.7, 0.3, 1], to: [1, 0, 0, 0], lowPriority: false, spread: 0.04 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.2, coneDeg: 180, lifeMin: 0.12, lifeMax: 0.16, size0: 0.9, size1: 0.3, gravity: 0, drag: 0, from: [4, 1.2, 0.8, 1], to: [1.5, 0, 0, 0], lowPriority: false, spread: 0 },
    ],
    flash: { color: 0xff4020, intensity: 18, range: 9, duration: 0.14 },
  },
  // fireball core, fast embers that arc and fall, rolling smoke, light flash and a shock ring
  explosion: {
    layers: [
      { buffer: 'add', count: 30, speedMin: 2, speedMax: 9, coneDeg: 180, lifeMin: 0.3, lifeMax: 0.8, size0: 0.42, size1: 0.1, gravity: 0.15, drag: 1.6, from: [3.4, 2.2, 0.7, 1], to: [1, 0.12, 0, 0], lowPriority: false, spread: 0.25 },
      { buffer: 'add', count: 2, speedMin: 0, speedMax: 0.1, coneDeg: 180, lifeMin: 0.18, lifeMax: 0.24, size0: 1.3, size1: 3.2, gravity: 0, drag: 0, from: [5, 4, 2.4, 1], to: [1.6, 0.5, 0.1, 0], lowPriority: false, spread: 0.1 },
      { buffer: 'add', count: 22, speedMin: 8, speedMax: 20, coneDeg: 180, lifeMin: 0.5, lifeMax: 1.1, size0: 0.07, size1: 0.02, gravity: 1.1, drag: 0.5, from: [4, 2.6, 0.8, 1], to: [1.4, 0.2, 0, 0], lowPriority: true, spread: 0.1 },
      { buffer: 'alpha', count: 16, speedMin: 0.5, speedMax: 3.2, coneDeg: 180, lifeMin: 1.1, lifeMax: 2.2, size0: 0.55, size1: 2.4, gravity: -0.16, drag: 1.2, from: [0.22, 0.2, 0.19, 0.75], to: [0.1, 0.1, 0.1, 0], lowPriority: true, spread: 0.3 },
    ],
    flash: { color: 0xffa040, intensity: 90, range: 20, duration: 0.3 },
    ring: { radius: 4, duration: 0.4, color: 0xffb060, useRequestDuration: false },
  },
  'big-explosion': {
    layers: [
      { buffer: 'add', count: 110, speedMin: 3, speedMax: 16, coneDeg: 180, lifeMin: 0.5, lifeMax: 1.4, size0: 0.7, size1: 0.15, gravity: 0.2, drag: 1.2, from: [3.6, 2.4, 0.9, 1], to: [1.1, 0.15, 0, 0], lowPriority: false, spread: 0.6 },
      { buffer: 'add', count: 4, speedMin: 0, speedMax: 0.2, coneDeg: 180, lifeMin: 0.3, lifeMax: 0.45, size0: 3.2, size1: 9, gravity: 0, drag: 0, from: [5.5, 4.4, 2.6, 1], to: [1.6, 0.4, 0.05, 0], lowPriority: false, spread: 0.5 },
      { buffer: 'add', count: 60, speedMin: 12, speedMax: 34, coneDeg: 180, lifeMin: 0.7, lifeMax: 1.6, size0: 0.1, size1: 0.03, gravity: 1, drag: 0.4, from: [4.2, 2.8, 0.9, 1], to: [1.4, 0.2, 0, 0], lowPriority: true, spread: 0.3 },
      { buffer: 'alpha', count: 44, speedMin: 1, speedMax: 6, coneDeg: 180, lifeMin: 1.6, lifeMax: 3, size0: 1.3, size1: 5.5, gravity: -0.2, drag: 1, from: [0.2, 0.19, 0.18, 0.8], to: [0.08, 0.08, 0.08, 0], lowPriority: true, spread: 0.8 },
    ],
    flash: { color: 0xffb860, intensity: 260, range: 55, duration: 0.6 },
    ring: { radius: 11, duration: 0.7, color: 0xffc070, useRequestDuration: false },
  },
  smoke: {
    layers: [
      { buffer: 'alpha', count: 10, speedMin: 0.3, speedMax: 1.5, coneDeg: 40, lifeMin: 1.2, lifeMax: 2.4, size0: 0.4, size1: 1.8, gravity: -0.12, drag: 0.8, from: [0.3, 0.3, 0.3, 0.6], to: [0.12, 0.12, 0.12, 0], lowPriority: true, spread: 0.15 },
    ],
  },
  dust: {
    layers: [
      { buffer: 'alpha', count: 8, speedMin: 0.5, speedMax: 2.5, coneDeg: 70, lifeMin: 0.4, lifeMax: 0.9, size0: 0.15, size1: 0.6, gravity: -0.02, drag: 2, from: [0.65, 0.58, 0.48, 0.55], to: [0.55, 0.5, 0.42, 0], lowPriority: true, spread: 0.08 },
    ],
  },
  pickup: {
    layers: [
      { buffer: 'add', count: 18, speedMin: 0.8, speedMax: 3, coneDeg: 180, lifeMin: 0.5, lifeMax: 1, size0: 0.1, size1: 0.02, gravity: -0.25, drag: 1.5, from: [1.4, 2.6, 1.8, 1], to: [0.3, 1.2, 1.6, 0], lowPriority: false, spread: 0.2 },
    ],
  },
  'telegraph-ring': {
    layers: [],
    ring: { radius: 1, duration: 1, color: 0xff3a2a, useRequestDuration: true },
  },
};

export const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];

/** Particle buffers touched by a recipe (used for budget and distinctness checks). */
export function recipeParticleCount(id: RecipeId, scale = 1): number {
  let total = 0;
  for (const layer of RECIPES[id].layers) total += Math.max(1, Math.round(layer.count * scale));
  return total;
}
