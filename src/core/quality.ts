import type { QualityPreset } from '@/config/tunables';

/**
 * Pure helpers for the graphics settings (T-17). No three.js, DOM or WebGL types here, so the
 * logic is unit-testable; `Renderer` and `Game` apply the results.
 */

export interface QualityLike {
  readonly pixelRatioCap: number;
  readonly shadowMapSize: number;
  readonly shadows: boolean;
  readonly viewDistance: number;
  /** Fog range as a fraction of the view distance: [near, far]. */
  readonly fogFraction: readonly [number, number];
  /** How often the (otherwise static) sun shadow is refreshed for moving casters, in Hz (0 = never). */
  readonly dynamicShadowHz: number;
}

/** Effective pixel ratio: never above the preset cap, never below 0.5 or a broken device value. */
export function effectivePixelRatio(devicePixelRatio: number, cap: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(0.5, Math.min(dpr, cap));
}

/** Minimum milliseconds between rendered frames for an FPS cap (0 or invalid = uncapped). */
export function minFrameIntervalMs(fpsCap: number): number {
  return Number.isFinite(fpsCap) && fpsCap > 0 ? 1000 / fpsCap : 0;
}

/** Clamp a master volume into 0..1 (NaN becomes 0). */
export function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Fog near/far for a view distance, so that geometry fades out before the far plane pops it. */
export function fogRange(viewDistance: number, fraction: readonly [number, number]): { near: number; far: number } {
  return { near: viewDistance * fraction[0], far: viewDistance * fraction[1] };
}

/**
 * Decides when the sun shadow map is re-rendered (REVIEW #4: static world once, moving casters at
 * a low rate). `markDirty()` forces one refresh (world ready, quality change); otherwise a refresh
 * is due every `1 / hz` seconds while `dynamicActive` is true.
 */
export class ShadowScheduler {
  private dirty = true;
  private sinceRefresh = 0;

  /** Dynamic refresh rate in Hz; 0 = only on markDirty. */
  hz = 0;

  markDirty(): void {
    this.dirty = true;
  }

  /** Returns true when the shadow map must be rendered this frame. `dt` in seconds. */
  frame(dt: number, dynamicActive: boolean): boolean {
    this.sinceRefresh += dt;
    if (this.dirty) {
      this.dirty = false;
      this.sinceRefresh = 0;
      return true;
    }
    if (dynamicActive && this.hz > 0 && this.sinceRefresh >= 1 / this.hz - 1e-9) {
      this.sinceRefresh = 0;
      return true;
    }
    return false;
  }
}

export type { QualityPreset };
