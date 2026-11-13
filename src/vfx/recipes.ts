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

const SPARK_HOT: Rgba = [1, 0.85, 0.4, 1];
const SPARK_END: Rgba = [1, 0.25, 0.05, 0];

export const RECIPES: Record<RecipeId, Recipe> = {
  spark: {
    layers: [
      { buffer: 'add', count: 10, speedMin: 3, speedMax: 8, coneDeg: 55, lifeMin: 0.15, lifeMax: 0.4, size0: 0.05, size1: 0.02, gravity: 0.8, drag: 1, from: SPARK_HOT, to: SPARK_END, lowPriority: false, spread: 0.02 },
    ],
  },
  'armor-spark': {
    layers: [
      { buffer: 'add', count: 16, speedMin: 6, speedMax: 14, coneDeg: 22, lifeMin: 0.2, lifeMax: 0.5, size0: 0.07, size1: 0.02, gravity: 0.5, drag: 0.6, from: [0.9, 0.95, 1, 1], to: [0.4, 0.7, 1, 0], lowPriority: false, spread: 0.02 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.5, coneDeg: 180, lifeMin: 0.08, lifeMax: 0.1, size0: 0.45, size1: 0.15, gravity: 0, drag: 0, from: [1, 1, 1, 1], to: [0.6, 0.8, 1, 0], lowPriority: false, spread: 0 },
    ],
  },
  'weakpoint-burst': {
    layers: [
      { buffer: 'add', count: 20, speedMin: 2, speedMax: 7, coneDeg: 80, lifeMin: 0.25, lifeMax: 0.6, size0: 0.12, size1: 0.03, gravity: 0.3, drag: 1.2, from: [1, 0.2, 0.1, 1], to: [0.6, 0, 0, 0], lowPriority: false, spread: 0.04 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.2, coneDeg: 180, lifeMin: 0.12, lifeMax: 0.14, size0: 0.7, size1: 0.3, gravity: 0, drag: 0, from: [1, 0.35, 0.25, 1], to: [1, 0, 0, 0], lowPriority: false, spread: 0 },
    ],
  },
  explosion: {
    layers: [
      { buffer: 'add', count: 36, speedMin: 2, speedMax: 9, coneDeg: 180, lifeMin: 0.3, lifeMax: 0.8, size0: 0.35, size1: 0.1, gravity: 0.2, drag: 1.5, from: [1, 0.8, 0.3, 1], to: [0.8, 0.1, 0, 0], lowPriority: false, spread: 0.2 },
      { buffer: 'add', count: 1, speedMin: 0, speedMax: 0.1, coneDeg: 180, lifeMin: 0.18, lifeMax: 0.2, size0: 1.2, size1: 2.8, gravity: 0, drag: 0, from: [1, 0.95, 0.7, 1], to: [1, 0.4, 0.1, 0], lowPriority: false, spread: 0 },
      { buffer: 'alpha', count: 14, speedMin: 0.5, speedMax: 3, coneDeg: 180, lifeMin: 1, lifeMax: 1.8, size0: 0.5, size1: 2, gravity: -0.15, drag: 1.2, from: [0.25, 0.25, 0.25, 0.7], to: [0.1, 0.1, 0.1, 0], lowPriority: true, spread: 0.3 },
    ],
    flash: { color: 0xffaa55, intensity: 40, range: 14, duration: 0.25 },
    ring: { radius: 3, duration: 0.4, color: 0xffaa55, useRequestDuration: false },
  },
  'big-explosion': {
    layers: [
      { buffer: 'add', count: 120, speedMin: 3, speedMax: 16, coneDeg: 180, lifeMin: 0.5, lifeMax: 1.4, size0: 0.6, size1: 0.15, gravity: 0.25, drag: 1.2, from: [1, 0.85, 0.4, 1], to: [0.9, 0.15, 0, 0], lowPriority: false, spread: 0.6 },
      { buffer: 'add', count: 3, speedMin: 0, speedMax: 0.2, coneDeg: 180, lifeMin: 0.3, lifeMax: 0.4, size0: 3, size1: 8, gravity: 0, drag: 0, from: [1, 0.95, 0.75, 1], to: [1, 0.35, 0.05, 0], lowPriority: false, spread: 0.5 },
      { buffer: 'alpha', count: 40, speedMin: 1, speedMax: 6, coneDeg: 180, lifeMin: 1.5, lifeMax: 2.6, size0: 1.2, size1: 5, gravity: -0.2, drag: 1, from: [0.2, 0.2, 0.2, 0.75], to: [0.08, 0.08, 0.08, 0], lowPriority: true, spread: 0.8 },
    ],
    flash: { color: 0xffbb66, intensity: 120, range: 40, duration: 0.5 },
    ring: { radius: 8, duration: 0.7, color: 0xffbb66, useRequestDuration: false },
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
      { buffer: 'add', count: 18, speedMin: 0.8, speedMax: 3, coneDeg: 180, lifeMin: 0.5, lifeMax: 1, size0: 0.1, size1: 0.02, gravity: -0.25, drag: 1.5, from: [0.6, 1, 0.7, 1], to: [0.2, 0.9, 1, 0], lowPriority: false, spread: 0.2 },
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
