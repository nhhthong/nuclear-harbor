import { describe, expect, it } from 'vitest';
import { ENEMY_COUNTS } from '@/config/tunables';
import { LAND, PLAYER_SPAWN } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import { NavGrid } from './nav/NavGrid';
import { getPopulation, parseEnemyParam } from './population';

function ctx(sandbox: boolean, query = ''): Pick<GameContext, 'flags'> {
  return {
    flags: { sandbox, autostart: true, debug: false, params: new URLSearchParams(query) },
  };
}

describe('parseEnemyParam', () => {
  it('defaults to sphere, supports lists and none', () => {
    expect(parseEnemyParam(null)).toEqual(['sphere']);
    expect(parseEnemyParam('spider, charger')).toEqual(['spider', 'charger']);
    expect(parseEnemyParam('none')).toEqual([]);
    expect(parseEnemyParam('bogus')).toEqual([]);
  });
});

describe('getPopulation', () => {
  it('sandbox spawns the requested types around (0, -24)', () => {
    const pop = getPopulation(ctx(true, 'enemies=sphere,spider'));
    expect(pop.map((p) => p.type)).toEqual(['sphere', 'spider']);
    for (const p of pop) {
      expect(Math.hypot(p.position.x, p.position.z + 24)).toBeLessThan(5);
      expect(p.patrol.length).toBeGreaterThanOrEqual(3);
    }
    expect(getPopulation(ctx(true, 'enemies=none'))).toEqual([]);
    expect(getPopulation(ctx(true))).toHaveLength(1);
  });

  it('harbor creates exactly 14 / 10 / 6 robots on walkable cells, far from the player spawn (AC1)', () => {
    const nav = new NavGrid({ minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: LAND.maxZ }, 1.5);
    nav.blockRect(-60, -20, -20, -15); // some obstacles
    nav.blockRect(20, 0, 60, 30);
    const pop = getPopulation(ctx(false), nav);
    const count = (t: string) => pop.filter((p) => p.type === t).length;
    expect(count('sphere')).toBe(ENEMY_COUNTS.sphere);
    expect(count('spider')).toBe(ENEMY_COUNTS.spider);
    expect(count('charger')).toBe(ENEMY_COUNTS.charger);
    for (const p of pop) {
      expect(nav.isWalkable(p.position.x, p.position.z)).toBe(true);
      expect(Math.hypot(p.position.x - PLAYER_SPAWN.position.x, p.position.z - PLAYER_SPAWN.position.z)).toBeGreaterThan(40);
      expect(p.patrol.length).toBeGreaterThanOrEqual(2);
      expect(p.patrol.length).toBeLessThanOrEqual(4);
    }
  });

  it('is deterministic', () => {
    const nav = new NavGrid({ minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: LAND.maxZ }, 1.5);
    const a = getPopulation(ctx(false), nav);
    const b = getPopulation(ctx(false), nav);
    expect(a.map((p) => p.position.x)).toEqual(b.map((p) => p.position.x));
  });
});
