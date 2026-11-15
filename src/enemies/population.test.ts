import { describe, expect, it, vi } from 'vitest';
import { BOSS_ARENA, LAND, PLAYER_SPAWN, TOWERS, ENEMY_DISTRIBUTION, zoneAt } from '@/config/level';
import { ENEMY_COUNTS } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import { generateContainerLayout } from '@/world/containerLayout';
import { NavGrid } from './nav/NavGrid';
import { structureSolids } from '@/structures/layout';
import { buildBarriers } from '@/world/barriers';
import { ENEMY_LOCAL } from './tunables';
import {
  FALLBACK_LANES,
  authoredHarbor,
  getPopulation,
  harborInputs,
  parseEnemyParam,
  toSpawns,
} from './population';

function ctx(sandbox: boolean, query = '', hooks: Record<string, unknown> = {}): Pick<GameContext, 'flags' | 'testHooks'> {
  return {
    flags: { sandbox, autostart: true, debug: false, params: new URLSearchParams(query) },
    testHooks: hooks,
  };
}

// ---- the real quay geometry as seen by the nav bake (obstacles between 0.2 and 2.0 m) ----------
const layout = generateContainerLayout();

function realNav(): NavGrid {
  const nav = new NavGrid({ minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: LAND.maxZ }, 1.5);
  const eps = 0.74; // cell centres within half a cell of a box are blocked
  const boxes = [
    ...layout.boxes.map((b) => ({ c: b.center, h: b.halfExtents })),
    ...buildBarriers().map((b) => ({ c: b.center, h: b.halfExtents })),
    ...structureSolids().map((b) => ({ c: b.center, h: b.half })),
  ];
  for (const { c, h } of boxes) {
    if (c.y - h.y >= 2.0 || c.y + h.y <= 0.2) continue;
    nav.blockRect(c.x - h.x - eps, c.z - h.z - eps, c.x + h.x + eps, c.z + h.z + eps);
  }
  return nav;
}

const inputs = { lanes: layout.lanes };
const authored = authoredHarbor(inputs);
const count = (t: string) => authored.filter((p) => p.type === t).length;
const dist = (a: readonly [number, number], x: number, z: number) => Math.hypot(a[0] - x, a[1] - z);

describe('parseEnemyParam', () => {
  it('defaults to army, supports lists and none', () => {
    expect(parseEnemyParam(null)).toEqual(['army']);
    expect(parseEnemyParam('spot, duck')).toEqual(['spot', 'duck']);
    expect(parseEnemyParam('none')).toEqual([]);
    expect(parseEnemyParam('bogus')).toEqual([]);
  });
});

describe('sandbox population', () => {
  it('spawns the requested types around (0, -24)', () => {
    const pop = getPopulation(ctx(true, 'enemies=army,spot'));
    expect(pop.map((p) => p.type)).toEqual(['army', 'spot']);
    for (const p of pop) {
      expect(Math.hypot(p.position.x, p.position.z + 24)).toBeLessThan(5);
      expect(p.patrol.length).toBeGreaterThanOrEqual(3);
    }
    expect(getPopulation(ctx(true, 'enemies=none'))).toEqual([]);
    expect(getPopulation(ctx(true))).toHaveLength(1);
  });
});

describe('authored harbor population', () => {
  it('has exactly the configured roster', () => {
    expect(count('army')).toBe(ENEMY_COUNTS.army);
    expect(count('spot')).toBe(ENEMY_COUNTS.spot);
    expect(count('duck')).toBe(ENEMY_COUNTS.duck);
    expect(count('samurai')).toBe(ENEMY_COUNTS.samurai);
    expect(authored).toHaveLength(ENEMY_COUNTS.total);
  });

  it('honours ENEMY_DISTRIBUTION per zone', () => {
    for (const zone of ['A', 'B', 'C', 'D'] as const) {
      for (const type of ['army', 'spot', 'duck', 'samurai'] as const) {
        const n = authored.filter((p) => p.type === type && zoneAt(p.at[0], p.at[1]) === zone).length;
        expect(n, `${type} in ${zone}`).toBe(ENEMY_DISTRIBUTION[zone][type]);
      }
    }
  });

  it('keeps every robot, and every point of its patrol, away from the player spawn', () => {
    for (const p of authored) {
      for (const pt of [p.at, ...p.patrol]) expect(dist(pt, PLAYER_SPAWN.position.x, PLAYER_SPAWN.position.z), `${p.type} ${pt.join(', ')}`).toBeGreaterThan(ENEMY_LOCAL.minDistanceFromSpawn);
    }
  });

  it('puts every spawn and patrol point on a walkable cell of the real layout', () => {
    const nav = realNav();
    for (const p of authored) {
      for (const pt of [p.at, ...p.patrol]) {
        expect(nav.isWalkable(pt[0], pt[1]), `${p.type} point ${pt.join(', ')}`).toBe(true);
      }
      expect(p.patrol.length).toBeGreaterThanOrEqual(2);
      expect(p.patrol.length).toBeLessThanOrEqual(4);
    }
  });

  it('lets robots reach their patrol points (a path exists between consecutive points)', () => {
    const nav = realNav();
    for (const p of authored) {
      for (let i = 0; i < p.patrol.length; i++) {
        const a = p.patrol[i]!;
        const b = p.patrol[(i + 1) % p.patrol.length]!;
        expect(nav.findPath(a[0], a[1], b[0], b[1]), `${p.type} ${a} -> ${b}`).not.toBeNull();
      }
    }
  });

  it('runs the yard Ducks along yard aisles and keeps robots out of the boss arena', () => {
    const ducks = authored.filter((p) => p.type === 'duck' && zoneAt(p.at[0], p.at[1]) === 'A');
    for (const d of ducks) expect(layout.lanes.some((l) => (l.axis === 'x' ? Math.abs(l.start.z - d.at[1]) : Math.abs(l.start.x - d.at[0])) < 0.01)).toBe(true);
    for (const p of authored) {
      for (const pt of [p.at, ...p.patrol]) expect(dist(pt, BOSS_ARENA.center.x, BOSS_ARENA.center.z)).toBeGreaterThan(BOSS_ARENA.radius);
    }
  });

  it('guards the relay tower', () => {
    const t = TOWERS[0]!;
    expect(authored.filter((p) => dist(p.at, t.position.x, t.position.z) <= 8).length).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic and the fallback lanes equal the world generator output', () => {
    expect(JSON.stringify(authoredHarbor(inputs))).toBe(JSON.stringify(authoredHarbor(inputs)));
    expect(FALLBACK_LANES).toHaveLength(layout.lanes.length);
    for (const l of layout.lanes) {
      const f = FALLBACK_LANES.find((x) => x.id === l.id);
      expect(f, l.id).toBeDefined();
      expect(f!.axis).toBe(l.axis);
      expect(f!.start.x).toBeCloseTo(l.start.x, 1);
      expect(f!.start.z).toBeCloseTo(l.start.z, 1);
      expect(f!.end.x).toBeCloseTo(l.end.x, 1);
      expect(f!.end.z).toBeCloseTo(l.end.z, 1);
    }
  });

  it('reads the world hook when present and rejects malformed data', () => {
    const good = harborInputs(ctx(false, '', { world: { lanes: layout.lanes } }));
    expect(good.lanes).toEqual(layout.lanes);
    expect(harborInputs(ctx(false, '', { world: { lanes: [{ id: 3 }] } })).lanes).toBe(FALLBACK_LANES);
  });
});

describe('getPopulation on the harbor', () => {
  it('returns the whole roster on walkable cells without warnings', () => {
    const nav = realNav();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pop = getPopulation(ctx(false, '', { world: { lanes: layout.lanes } }), nav);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    const n = (t: string) => pop.filter((p) => p.type === t).length;
    expect([n('army'), n('spot'), n('duck')]).toEqual([ENEMY_COUNTS.army, ENEMY_COUNTS.spot, ENEMY_COUNTS.duck]);
    for (const p of pop) expect(nav.isWalkable(p.position.x, p.position.z)).toBe(true);
  });

  it('warns and nudges a blocked point to the nearest walkable cell', () => {
    const nav = realNav();
    const first = authored[0]!;
    nav.blockRect(first.at[0] - 2, first.at[1] - 2, first.at[0] + 2, first.at[1] + 2);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pop = toSpawns(authored, nav);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(nav.isWalkable(pop[0]!.position.x, pop[0]!.position.z)).toBe(true);
    expect(pop[0]!.patrol.every((v) => nav.isWalkable(v.x, v.z))).toBe(true);
  });

  it('returns nothing without a nav grid', () => {
    expect(getPopulation(ctx(false), undefined)).toEqual([]);
  });
});
