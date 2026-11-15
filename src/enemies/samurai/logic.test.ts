import { describe, expect, it } from 'vitest';
import { coneHit, dashUsesDue, deflectedDamage, distanceToSegment, pickDashPoint } from './logic';
import { SAMURAI } from './tunables';

describe('samurai logic', () => {
  it('is twice a regular robot', () => {
    expect(SAMURAI.hp).toBe(300);
    expect(SAMURAI.leap.damage).toBe(24);
  });

  it('deflects frontal damage only while spinning', () => {
    expect(deflectedDamage(100, 0, true)).toBeCloseTo(100 * (1 - SAMURAI.spin.reduction));
    expect(deflectedDamage(100, Math.PI, true)).toBe(100);
    expect(deflectedDamage(100, 0, false)).toBe(100);
  });

  it('cone hit respects radius, angle and height', () => {
    expect(coneHit(2, 0.2, 0, 3, 1, 1.8)).toBe(true);
    expect(coneHit(4, 0.2, 0, 3, 1, 1.8)).toBe(false);
    expect(coneHit(2, 2.5, 0, 3, 1, 1.8)).toBe(false);
    expect(coneHit(2, 0.2, 2.2, 3, 1, 1.8)).toBe(false);
  });

  it('measures the distance to a dash segment', () => {
    expect(distanceToSegment(5, 2, 0, 0, 10, 0)).toBeCloseTo(2);
    expect(distanceToSegment(-3, 0, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distanceToSegment(1, 1, 4, 4, 4, 4)).toBeCloseTo(Math.hypot(3, 3));
  });

  it('spends the dash at 70% and 35% HP, twice at most', () => {
    expect(dashUsesDue(1)).toBe(0);
    expect(dashUsesDue(0.7)).toBe(1);
    expect(dashUsesDue(0.5)).toBe(1);
    expect(dashUsesDue(0.2)).toBe(2);
    expect(SAMURAI.dash.uses).toBe(2);
  });

  it('picks dash points inside the area, far enough, on a clear line', () => {
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const out = { x: 0, z: 0 };
    for (let i = 0; i < 50; i++) {
      pickDashPoint(0, 0, 3, 3, rand, () => true, out);
      expect(Math.hypot(out.x - 3, out.z - 3)).toBeLessThanOrEqual(SAMURAI.dash.radius + 1e-6);
      expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(SAMURAI.dash.minLength);
    }
    // nothing reachable: stays where it is
    pickDashPoint(1, 2, 3, 3, rand, () => false, out);
    expect(out).toEqual({ x: 1, z: 2 });
  });
});
