import { describe, expect, it } from 'vitest';
import { PERFORMANCE } from '@/config/tunables';
import { ShadowScheduler, clampVolume, effectivePixelRatio, fogRange, minFrameIntervalMs } from './quality';

describe('quality helpers', () => {
  it('caps the pixel ratio per preset', () => {
    expect(effectivePixelRatio(3, PERFORMANCE.quality.low.pixelRatioCap)).toBe(1);
    expect(effectivePixelRatio(3, PERFORMANCE.quality.high.pixelRatioCap)).toBe(2);
    expect(effectivePixelRatio(1, 1.5)).toBe(1);
    expect(effectivePixelRatio(Number.NaN, 1.5)).toBe(1);
    expect(effectivePixelRatio(0.1, 1.5)).toBe(0.5);
  });

  it('converts an FPS cap into a frame interval', () => {
    expect(minFrameIntervalMs(0)).toBe(0);
    expect(minFrameIntervalMs(60)).toBeCloseTo(16.667, 2);
    expect(minFrameIntervalMs(30)).toBeCloseTo(33.333, 2);
    expect(minFrameIntervalMs(-5)).toBe(0);
    expect(minFrameIntervalMs(Number.NaN)).toBe(0);
  });

  it('clamps the volume', () => {
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(Number.NaN)).toBe(0);
    expect(clampVolume(0.3)).toBe(0.3);
  });

  it('derives the fog range from the view distance', () => {
    const r = fogRange(300, [0.2, 0.9]);
    expect(r.near).toBeCloseTo(60);
    expect(r.far).toBeCloseTo(270);
  });

  it('presets are monotonic: low is cheaper than high', () => {
    const { low, medium, high } = PERFORMANCE.quality;
    expect(low.shadows).toBe(false);
    expect(low.shadowMapSize).toBeLessThanOrEqual(medium.shadowMapSize);
    expect(medium.shadowMapSize).toBeLessThanOrEqual(high.shadowMapSize);
    expect(low.viewDistance).toBeLessThan(medium.viewDistance);
    expect(medium.viewDistance).toBeLessThan(high.viewDistance);
    expect(low.dynamicShadowHz).toBeLessThanOrEqual(medium.dynamicShadowHz);
  });
});

describe('ShadowScheduler', () => {
  it('renders the first frame, then only on markDirty when hz is 0', () => {
    const s = new ShadowScheduler();
    expect(s.frame(0.016, true)).toBe(true);
    for (let i = 0; i < 100; i++) expect(s.frame(0.016, true)).toBe(false);
    s.markDirty();
    expect(s.frame(0.016, true)).toBe(true);
    expect(s.frame(0.016, true)).toBe(false);
  });

  it('refreshes at the dynamic rate only while dynamic casters are active', () => {
    const s = new ShadowScheduler();
    s.hz = 10;
    s.frame(0.016, true);
    let refreshes = 0;
    for (let i = 0; i < 60; i++) if (s.frame(1 / 60, true)) refreshes++;
    expect(refreshes).toBe(10);
    let idle = 0;
    for (let i = 0; i < 60; i++) if (s.frame(1 / 60, false)) idle++;
    expect(idle).toBe(0);
  });
});
