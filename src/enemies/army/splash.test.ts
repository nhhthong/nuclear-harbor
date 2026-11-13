import { describe, expect, it } from 'vitest';
import { splashDamage } from './splash';

describe('splashDamage', () => {
  it('is full at the centre, linear, and zero at the radius', () => {
    expect(splashDamage(0, 3, 12)).toBe(12);
    expect(splashDamage(1.5, 3, 12)).toBeCloseTo(6, 6);
    expect(splashDamage(3, 3, 12)).toBe(0);
    expect(splashDamage(10, 3, 12)).toBe(0);
  });
  it('clamps a negative distance', () => {
    expect(splashDamage(-1, 3, 12)).toBe(12);
  });
});
