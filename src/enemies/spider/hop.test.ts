import { describe, expect, it } from 'vitest';
import { canHop, hopHeight, hopLerp } from './hop';

describe('canHop', () => {
  it('requires low ray blocked, high ray clear and a walkable landing', () => {
    expect(canHop(true, false, true)).toBe(true);
    expect(canHop(false, false, true)).toBe(false);
    expect(canHop(true, true, true)).toBe(false);
    expect(canHop(true, false, false)).toBe(false);
  });
});

describe('hop parabola', () => {
  it('starts and ends on the ground with the apex mid-hop', () => {
    expect(hopHeight(0, 1.4)).toBeCloseTo(0);
    expect(hopHeight(1, 1.4)).toBeCloseTo(0);
    expect(hopHeight(0.5, 1.4)).toBeCloseTo(1.4);
    expect(hopHeight(-1, 1.4)).toBe(0);
    expect(hopHeight(2, 1.4)).toBe(0);
  });

  it('interpolates horizontally', () => {
    expect(hopLerp(2, 10, 0.25)).toBeCloseTo(4);
    expect(hopLerp(2, 10, 5)).toBeCloseTo(10);
  });
});
