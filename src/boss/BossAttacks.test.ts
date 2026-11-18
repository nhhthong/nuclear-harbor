import { describe, expect, it } from 'vitest';
import { angleDelta, clampToArena, inSplash, rangeIntent } from './BossAttacks';

describe('boss geometry helpers', () => {
  it('clampToArena keeps points inside radius minus margin', () => {
    const c = { x: -10, z: -66 };
    expect(clampToArena({ x: -10, z: -66 }, c, 17, 6)).toEqual({ x: -10, z: -66 });
    const p = clampToArena({ x: 40, z: -66 }, c, 17, 6);
    expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(11, 5);
    expect(clampToArena({ x: -5, z: -66 }, c, 17, 6)).toEqual({ x: -5, z: -66 });
  });

  it('rangeIntent holds the preferred band', () => {
    expect(rangeIntent(5, 10, 17)).toBe(-1);
    expect(rangeIntent(12, 10, 17)).toBe(0);
    expect(rangeIntent(25, 10, 17)).toBe(1);
  });

  it('angleDelta wraps to the shortest way', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 6);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 6);
    expect(angleDelta(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('splash danger is a sphere', () => {
    expect(inSplash({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 0 }, 5)).toBe(true);
    expect(inSplash({ x: 0, y: 0, z: 0 }, { x: 5, y: 1, z: 0 }, 5)).toBe(false);
  });
});
