import { describe, expect, it } from 'vitest';
import { WAREHOUSE } from '@/config/warehouse';
import { footstepSurface, heartbeatRate, impactMaterial, lowHealthLevel } from './rules';
import { AUDIO } from './tunables';

describe('low-health level (spec 32)', () => {
  it('is silent above 35 % and when dead, full at 10 %, monotonic in between', () => {
    expect(lowHealthLevel(100, 100)).toBe(0);
    expect(lowHealthLevel(36, 100)).toBe(0);
    expect(lowHealthLevel(AUDIO.lowHealth.start * 100, 100)).toBe(0);
    expect(lowHealthLevel(10, 100)).toBe(1);
    expect(lowHealthLevel(5, 100)).toBe(1);
    expect(lowHealthLevel(0, 100)).toBe(0);
    expect(lowHealthLevel(50, 0)).toBe(0);
    let prev = 0;
    for (let hp = 34; hp >= 10; hp--) {
      const l = lowHealthLevel(hp, 100);
      expect(l).toBeGreaterThanOrEqual(prev);
      expect(l).toBeLessThanOrEqual(1);
      prev = l;
    }
    expect(lowHealthLevel(22.5, 100)).toBeCloseTo(0.5, 5);
  });

  it('speeds the heartbeat up with the level', () => {
    expect(heartbeatRate(0)).toBe(AUDIO.lowHealth.rateMin);
    expect(heartbeatRate(1)).toBe(AUDIO.lowHealth.rateMax);
    expect(heartbeatRate(2)).toBe(AUDIO.lowHealth.rateMax);
    expect(heartbeatRate(0.5)).toBeGreaterThan(heartbeatRate(0.2));
  });
});

describe('footstep surface', () => {
  it('is concrete on the ground outdoors and on the warehouse slab', () => {
    expect(footstepSurface({ x: -15, y: 0, z: 29 })).toBe('concrete');
    expect(footstepSurface({ x: 20, y: 0, z: 0 })).toBe('concrete');
  });

  it('is metal on the stair, the mezzanine and container tops', () => {
    const s = WAREHOUSE.stairs;
    expect(footstepSurface({ x: (s.minX + s.maxX) / 2, y: 0.18, z: s.bottomZ - 0.2 })).toBe('metal');
    expect(footstepSurface({ x: 20, y: WAREHOUSE.mezzanine.floorY, z: -20 })).toBe('metal');
    expect(footstepSurface({ x: -20, y: 2.6, z: 0 })).toBe('metal');
  });
});

describe('impact material', () => {
  it('is concrete for ground floors and the perimeter wall', () => {
    expect(impactMaterial({ x: 3, y: 0.01, z: 5 }, { x: 0, y: 1, z: 0 })).toBe('concrete');
    expect(impactMaterial({ x: -35.7, y: 3, z: 0 }, { x: 1, y: 0, z: 0 })).toBe('concrete');
  });

  it('is metal for containers, steel walls, the mezzanine and props', () => {
    expect(impactMaterial({ x: -10, y: 1.4, z: 5 }, { x: 0, y: 0, z: 1 })).toBe('metal');
    expect(impactMaterial({ x: 20, y: WAREHOUSE.mezzanine.floorY, z: -20 }, { x: 0, y: 1, z: 0 })).toBe('metal');
    expect(impactMaterial({ x: -10, y: 2.6, z: 5 }, { x: 0, y: 1, z: 0 })).toBe('metal');
  });
});
