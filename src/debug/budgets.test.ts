import { describe, expect, it } from 'vitest';
import { PERFORMANCE } from '@/config/tunables';
import { evaluateBudgets, LowFpsTracker } from './budgets';

const ok = { drawCalls: 10, triangles: 1000, heapMb: 50, lowFpsSustained: false };

describe('evaluateBudgets', () => {
  it('returns nothing within budget', () => {
    expect(evaluateBudgets(ok, PERFORMANCE)).toEqual([]);
  });

  it('flags each exceeded budget', () => {
    const keys = evaluateBudgets(
      { drawCalls: PERFORMANCE.maxDrawCalls + 1, triangles: PERFORMANCE.maxTriangles + 1, heapMb: PERFORMANCE.jsHeapWarnMb + 1, lowFpsSustained: true },
      PERFORMANCE,
    ).map((w) => w.key);
    expect(keys).toEqual(['drawCalls', 'triangles', 'heap', 'fps']);
  });

  it('ignores unavailable heap', () => {
    expect(evaluateBudgets({ ...ok, heapMb: NaN }, PERFORMANCE)).toEqual([]);
  });

  it('exactly at the limit is fine', () => {
    expect(evaluateBudgets({ ...ok, drawCalls: PERFORMANCE.maxDrawCalls }, PERFORMANCE)).toEqual([]);
  });
});

describe('LowFpsTracker', () => {
  it('raises only after the sustained time', () => {
    const t = new LowFpsTracker(30, 2);
    let raised = false;
    for (let i = 0; i < 90; i++) raised = t.update(20, 0.02);
    expect(raised).toBe(false); // 1.8 s
    expect(t.update(20, 0.3)).toBe(true);
  });

  it('resets when fps recovers', () => {
    const t = new LowFpsTracker(30, 2);
    t.update(10, 3);
    expect(t.update(60, 0.016)).toBe(false);
    expect(t.update(10, 1)).toBe(false);
  });
});
