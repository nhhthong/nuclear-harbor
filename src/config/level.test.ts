import { describe, expect, it } from 'vitest';
import { BOSS_ARENA, CRANE_SITES, ENEMY_DISTRIBUTION, KEEP_CLEAR, LAND, PLAYER_SPAWN, TOWERS, ZONES, isOnLand, zoneAt } from './level';
import { ENEMY_COUNTS, OBJECTIVES, WORLD } from './tunables';

describe('level contract', () => {
  it('is a tiny level: under 100 m on each side', () => {
    expect(LAND.maxX - LAND.minX).toBeLessThanOrEqual(100);
    expect(LAND.maxZ - LAND.minZ).toBeLessThanOrEqual(100);
  });

  it('has four zones that tile the land without gaps', () => {
    expect(Object.keys(ZONES)).toHaveLength(4);
    for (let x = LAND.minX + 1; x < LAND.maxX; x += 5) {
      for (let z = LAND.minZ + 1; z < LAND.maxZ; z += 5) {
        expect(zoneAt(x, z), `(${x}, ${z})`).not.toBeNull();
      }
    }
  });

  it('has one relay tower between the yard and the quay', () => {
    expect(TOWERS).toHaveLength(OBJECTIVES.towerCount);
    for (const t of TOWERS) expect(zoneAt(t.position.x, t.position.z)).toBe(t.zone);
    expect(TOWERS[0]!.zone).toBe('B');
  });

  it('distributes exactly the configured robots', () => {
    const sum = (k: 'army' | 'spot' | 'duck' | 'samurai') => Object.values(ENEMY_DISTRIBUTION).reduce((n, z) => n + z[k], 0);
    expect(sum('army')).toBe(ENEMY_COUNTS.army);
    expect(sum('spot')).toBe(ENEMY_COUNTS.spot);
    expect(sum('duck')).toBe(ENEMY_COUNTS.duck);
    expect(sum('samurai')).toBe(ENEMY_COUNTS.samurai);
    expect(ENEMY_COUNTS.army + ENEMY_COUNTS.spot + ENEMY_COUNTS.duck + ENEMY_COUNTS.samurai).toBe(ENEMY_COUNTS.total);
  });

  it('keeps the crane and the boss arena on the quay, apart from each other and from the spawn', () => {
    expect(CRANE_SITES.length).toBeGreaterThanOrEqual(WORLD.craneCountMin);
    expect(CRANE_SITES.length).toBeLessThanOrEqual(WORLD.craneCountMax);
    for (const c of CRANE_SITES) {
      expect(zoneAt(c.position.x, c.position.z)).toBe(c.zone);
      expect(Math.hypot(c.position.x - BOSS_ARENA.center.x, c.position.z - BOSS_ARENA.center.z)).toBeGreaterThan(BOSS_ARENA.radius + 9.5);
    }
    expect(zoneAt(BOSS_ARENA.center.x, BOSS_ARENA.center.z)).toBe('D');
    for (const a of [0, 90, 180, 270]) {
      const r = (a * Math.PI) / 180;
      expect(isOnLand(BOSS_ARENA.center.x + Math.cos(r) * BOSS_ARENA.radius, BOSS_ARENA.center.z + Math.sin(r) * BOSS_ARENA.radius)).toBe(true);
    }
    expect(Math.hypot(PLAYER_SPAWN.position.x - BOSS_ARENA.center.x, PLAYER_SPAWN.position.z - BOSS_ARENA.center.z)).toBeGreaterThan(40);
    expect(KEEP_CLEAR.length).toBeGreaterThanOrEqual(4);
  });
});
