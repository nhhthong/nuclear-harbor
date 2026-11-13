import { describe, expect, it } from 'vitest';
import { BOSS_ARENA } from '@/config/level';
import { pickLandingSpot } from './landing';
import { BOSS_LOCAL } from './tunables';

const base = {
  centre: { x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z },
  arenaRadius: BOSS_ARENA.radius,
  footprint: BOSS_LOCAL.footprintRadius,
  obstacles: [],
};
const gap = BOSS_LOCAL.landing.clearance;

describe('pickLandingSpot', () => {
  it('lands at the arena centre when the player is far away', () => {
    const s = pickLandingSpot({ ...base, player: { x: 0, z: 96 } });
    expect(s).toEqual({ x: base.centre.x, z: base.centre.z, clear: true });
  });

  it('moves off the centre when the player stands on it, never overlapping', () => {
    const s = pickLandingSpot({ ...base, player: { ...base.centre } });
    expect(s.clear).toBe(true);
    expect(Math.hypot(s.x - base.centre.x, s.z - base.centre.z)).toBeGreaterThan(0);
  });

  it('never overlaps the player over a grid of player positions inside the arena', () => {
    let clear = 0;
    for (let dx = -30; dx <= 30; dx += 3) {
      for (let dz = -30; dz <= 30; dz += 3) {
        const player = { x: base.centre.x + dx, z: base.centre.z + dz };
        const s = pickLandingSpot({ ...base, player });
        if (s.clear) {
          clear++;
          expect(Math.hypot(s.x - player.x, s.z - player.z)).toBeGreaterThanOrEqual(base.footprint + gap - 1e-6);
        }
        expect(Math.hypot(s.x - base.centre.x, s.z - base.centre.z)).toBeLessThanOrEqual(base.arenaRadius);
      }
    }
    expect(clear).toBeGreaterThan(400);
  });

  it('avoids obstacles and blocked probes', () => {
    const s = pickLandingSpot({ ...base, player: { x: 0, z: 96 }, obstacles: [{ ...base.centre, r: 3 }] });
    expect(s.clear).toBe(true);
    expect(Math.hypot(s.x - base.centre.x, s.z - base.centre.z)).toBeGreaterThanOrEqual(base.footprint + 3);
    const t = pickLandingSpot({ ...base, player: { x: 0, z: 96 }, blocked: (x, z) => Math.hypot(x - base.centre.x, z - base.centre.z) < 5 });
    expect(t.clear).toBe(true);
    expect(Math.hypot(t.x - base.centre.x, t.z - base.centre.z)).toBeGreaterThanOrEqual(5);
  });

  it('falls back to the least bad spot when everything is blocked', () => {
    const s = pickLandingSpot({ ...base, player: { x: 0, z: 96 }, blocked: () => true });
    expect(s.clear).toBe(false);
  });
});
