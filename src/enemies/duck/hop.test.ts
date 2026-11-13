import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { DUCK } from './tunables';
import { hopArc, hopPhase, hopSpeedFactor, isGrounded } from './hop';

describe('duck hop', () => {
  it('is faster than the walk and slower than the sprint', () => {
    expect(DUCK.hopSpeed).toBeGreaterThan(PLAYER.walkSpeed);
    expect(DUCK.hopSpeed).toBeLessThan(PLAYER.sprintSpeed);
  });

  it('the arc is a parabola that peaks mid-air and is zero on the ground', () => {
    const l = DUCK.landFraction;
    expect(hopArc(0.05, l, 1)).toBe(0);
    expect(hopArc(l, l, 1)).toBeCloseTo(0, 6);
    expect(hopArc(l + (1 - l) / 2, l, 1)).toBeCloseTo(1, 6);
    expect(hopArc(0.999999, l, 1)).toBeCloseTo(0, 3);
  });

  it('keeps the nominal average speed over a cycle', () => {
    const l = DUCK.landFraction;
    let sum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) sum += hopSpeedFactor(i / n, l);
    expect(sum / n).toBeCloseTo(1, 2);
    expect(isGrounded(0.1, l)).toBe(true);
    expect(isGrounded(0.5, l)).toBe(false);
  });

  it('wraps the phase', () => {
    expect(hopPhase(0.62 * 3.5, 0.62)).toBeCloseTo(0.5, 6);
  });
});
