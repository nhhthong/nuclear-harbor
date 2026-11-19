import { describe, expect, it } from 'vitest';
import { BOSS_ARENA, CRANE_SITES, ENEMY_DISTRIBUTION, SPAWN_SAFE_RADIUS, fromLegacyZ, KEEP_CLEAR, LAND, PLAYER_SPAWN, TOWERS, ZONES, isInClosedBlock, isInPlayArea, isOnLand, zoneAt } from './level';
import { SPAWN_L, WAREHOUSE } from './warehouse';
import { ENEMY_COUNTS, OBJECTIVES, WORLD } from './tunables';

describe('level contract', () => {
  it('is a small level: 72 m wide, under 130 m deep', () => {
    expect(LAND.maxX - LAND.minX).toBeLessThanOrEqual(100);
    expect(LAND.maxZ - LAND.minZ).toBeLessThanOrEqual(130);
  });

  it('zone depths of the L (spec 29): yard and warehouse 36, court 16, apron 22, quay 48', () => {
    const depth = (id: 'A' | 'B' | 'C' | 'D') => ZONES[id].maxZ - ZONES[id].minZ;
    expect([depth('A'), depth('B'), depth('C'), depth('D')]).toEqual([36, 16, 22, 48]);
  });

  it('maps legacy z onto the stretched zones and keeps the zone borders', () => {
    expect(fromLegacyZ(20)).toBe(16);
    expect(fromLegacyZ(-10)).toBe(-28);
    expect(fromLegacyZ(-18)).toBe(-40);
    expect(fromLegacyZ(-52)).toBe(-88);
    expect(fromLegacyZ(34)).toBe(34);
    expect(fromLegacyZ(-86.5)).toBe(-86.5);
  });

  it('has four zones that tile the L-shaped play area; the closed loading dock has no zone', () => {
    expect(Object.keys(ZONES)).toHaveLength(4);
    for (let x = LAND.minX + 1; x < LAND.maxX; x += 2.5) {
      for (let z = LAND.minZ + 1; z < LAND.maxZ; z += 2.5) {
        if (isInPlayArea(x, z)) expect(zoneAt(x, z), `(${x}, ${z})`).not.toBeNull();
        else {
          expect(zoneAt(x, z), `(${x}, ${z})`).toBeNull();
          expect(isOnLand(x, z)).toBe(false);
          expect(isInClosedBlock(x, z)).toBe(true);
        }
      }
    }
    // the closed block is the south-east corner beside and behind the warehouse
    expect(isInClosedBlock(20, 25)).toBe(true);
    expect(isInClosedBlock(35, 0)).toBe(true);
    expect(isInClosedBlock(-15, 25)).toBe(false);
    expect(isInClosedBlock(20, -30)).toBe(false);
    expect(zoneAt(20, 0)).toBe('A'); // the warehouse floor counts as zone A
    expect(isInPlayArea(WAREHOUSE.footprint.minX - 1, -4)).toBe(true); // apron in front of the roller door
  });

  it('has one relay tower between the yard and the quay', () => {
    expect(TOWERS).toHaveLength(OBJECTIVES.towerCount);
    for (const t of TOWERS) expect(zoneAt(t.position.x, t.position.z)).toBe(t.zone);
    expect(TOWERS[0]!.zone).toBe('B');
  });

  it('keeps the player spawn in the empty gate apron, far from every robot area', () => {
    expect(zoneAt(PLAYER_SPAWN.position.x, PLAYER_SPAWN.position.z)).toBe('C');
    expect(PLAYER_SPAWN.position).toEqual(SPAWN_L);
    expect(Object.values(ENEMY_DISTRIBUTION.C).every((n) => n === 0)).toBe(true);
    expect(SPAWN_SAFE_RADIUS).toBeGreaterThanOrEqual(30);
    expect(ENEMY_DISTRIBUTION.B.samurai).toBe(0);
  });

  it('distributes exactly the configured robots', () => {
    const sum = (k: 'army' | 'spot' | 'duck' | 'biped' | 'samurai') => Object.values(ENEMY_DISTRIBUTION).reduce((n, z) => n + z[k], 0);
    expect(sum('army')).toBe(ENEMY_COUNTS.army);
    expect(sum('spot')).toBe(ENEMY_COUNTS.spot);
    expect(sum('duck')).toBe(ENEMY_COUNTS.duck);
    expect(sum('biped')).toBe(ENEMY_COUNTS.biped);
    expect(sum('samurai')).toBe(ENEMY_COUNTS.samurai);
    expect(ENEMY_COUNTS.army + ENEMY_COUNTS.spot + ENEMY_COUNTS.duck + ENEMY_COUNTS.biped + ENEMY_COUNTS.samurai).toBe(ENEMY_COUNTS.total);
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
