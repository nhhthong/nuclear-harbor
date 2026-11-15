import { describe, expect, it } from 'vitest';
import { approach, createGaitPose, gaitPose, hipAmplitude, strideLength } from './gait';

describe('samurai gait', () => {
  const L = 1.62;
  it('legs are half a cycle apart and the swinging knee folds', () => {
    const p = gaitPose(0.6, 1, 0.5, L, createGaitPose());
    expect(Math.sign(p.left.hip)).toBe(-Math.sign(p.right.hip));
    // phase 0: left leg mid-swing (cos = 1) -> its knee is bent far more than the standing one
    const q = gaitPose(0, 1, 0.5, L, createGaitPose());
    expect(q.left.knee).toBeLessThan(q.right.knee - 0.5);
    expect(q.left.knee).toBeLessThan(0);
    expect(q.right.knee).toBeLessThanOrEqual(0);
  });

  it('stands still at amount 0 and never lifts the pelvis', () => {
    const p = gaitPose(1.3, 0, 1, L, createGaitPose());
    expect(p.left.hip).toBeCloseTo(0);
    expect(p.bob).toBeCloseTo(0);
    for (let a = 0; a < 6.3; a += 0.3) expect(gaitPose(a, 1, 1, L, createGaitPose()).bob).toBeLessThanOrEqual(0);
  });

  it('stride grows from walk to run and matches the stance sweep', () => {
    expect(strideLength(L, 1)).toBeGreaterThan(strideLength(L, 0));
    expect(strideLength(L, 0)).toBeCloseTo(4 * L * Math.sin(hipAmplitude(0)));
  });

  it('approach eases without overshoot', () => {
    expect(approach(0, 6, 1)).toBe(1);
    expect(approach(5.5, 6, 1)).toBe(6);
    expect(approach(6, 0, 2)).toBe(4);
  });
});
