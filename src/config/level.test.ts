import { describe, expect, it } from 'vitest';
import { BOSS_ARENA, CRANE_SITES, ENEMY_DISTRIBUTION, LAND, TOWERS, ZONES, isOnLand, zoneAt } from './level';
import { ENEMY_COUNTS, OBJECTIVES, WORLD } from './tunables';

describe('level contract', () => {
  it('has four zones that tile the land without gaps', () => {
    expect(Object.keys(ZONES)).toHaveLength(4);
    for (let x = LAND.minX + 1; x < LAND.maxX; x += 7) {
      for (let z = LAND.minZ + 1; z < LAND.maxZ; z += 7) {
        expect(zoneAt(x, z), `(${x}, ${z})`).not.toBeNull();
      }
    }
  });

  it('places one tower per zone as in GDD 8', () => {
    expect(TOWERS).toHaveLength(OBJECTIVES.towerCount);
    expect(TOWERS.map((t) => t.zone)).toEqual(['C', 'A', 'B', 'D']);
    for (const t of TOWERS) expect(zoneAt(t.position.x, t.position.z)).toBe(t.zone);
  });

  it('distributes exactly 14 / 10 / 6 robots (GDD 6)', () => {
    const sum = (k: 'sphere' | 'spider' | 'charger') => Object.values(ENEMY_DISTRIBUTION).reduce((n, z) => n + z[k], 0);
    expect(sum('sphere')).toBe(ENEMY_COUNTS.sphere);
    expect(sum('spider')).toBe(ENEMY_COUNTS.spider);
    expect(sum('charger')).toBe(ENEMY_COUNTS.charger);
  });

  it('has 5-6 cranes on land and a boss arena inside the dock zone (GDD 7.4, 9.1)', () => {
    expect(CRANE_SITES.length).toBeGreaterThanOrEqual(WORLD.craneCountMin);
    expect(CRANE_SITES.length).toBeLessThanOrEqual(WORLD.craneCountMax);
    for (const c of CRANE_SITES) expect(zoneAt(c.position.x, c.position.z)).toBe(c.zone);
    expect(zoneAt(BOSS_ARENA.center.x, BOSS_ARENA.center.z)).toBe('D');
    expect(isOnLand(BOSS_ARENA.center.x, BOSS_ARENA.center.z - BOSS_ARENA.radius)).toBe(true);
  });
});
