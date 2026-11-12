import { describe, expect, it } from 'vitest';
import { summarise, type BenchContext, type ResourceCounts } from './benchmark';

const rc = (g: number, t: number): ResourceCounts => ({ geometries: g, textures: t, programs: 3, tracked: 10, heapMb: 40 });
const ctx = (): BenchContext => ({
  seconds: 2,
  start: rc(10, 5),
  end: rc(12, 5),
  enemies: { total: 3, active: 1, simplified: 1, dormant: 1 },
  quality: 'medium',
  finishedAt: 0,
});

describe('summarise', () => {
  it('computes fps and peaks', () => {
    const r = summarise({ count: 4, frameMs: [10, 10, 10, 20], drawCalls: [5, 9, 7, 3], triangles: [100, 50, 400, 10] }, ctx());
    expect(r.frames).toBe(4);
    expect(r.frameMs.avg).toBeCloseTo(12.5);
    expect(r.frameMs.max).toBe(20);
    expect(r.fps.avg).toBeCloseTo(80);
    expect(r.fps.min).toBeCloseTo(50);
    expect(r.fps.onePercentLow).toBeCloseTo(50);
    expect(r.maxDrawCalls).toBe(9);
    expect(r.maxTriangles).toBe(400);
  });

  it('reports resource deltas end - start', () => {
    const r = summarise({ count: 1, frameMs: [16], drawCalls: [1], triangles: [1] }, ctx());
    expect(r.delta.geometries).toBe(2);
    expect(r.delta.textures).toBe(0);
    expect(r.start.geometries).toBe(10);
    expect(r.end.geometries).toBe(12);
  });

  it('handles zero samples without NaN', () => {
    const r = summarise({ count: 0, frameMs: [], drawCalls: [], triangles: [] }, ctx());
    expect(r.fps.avg).toBe(0);
    expect(Number.isFinite(r.fps.onePercentLow)).toBe(true);
  });

  it('is JSON serialisable', () => {
    const r = summarise({ count: 1, frameMs: [16], drawCalls: [1], triangles: [1] }, ctx());
    expect(JSON.parse(JSON.stringify(r)).frames).toBe(1);
  });
});
