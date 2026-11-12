import { describe, expect, it, vi } from 'vitest';
import { CRANE_SITES, BOSS_ARENA, LAND, PLAYER_SPAWN, TOWERS, ZONES, ENEMY_DISTRIBUTION, zoneAt, type ZoneId } from '@/config/level';
import { ENEMY_COUNTS } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import { buildControlCenter, buildWarehouse } from '@/world/buildings';
import { generateContainerLayout } from '@/world/containerLayout';
import { NavGrid } from './nav/NavGrid';
import {
  FALLBACK_CORRIDOR,
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

// ---- the real harbor geometry as seen by the nav bake (obstacles between 0.2 and 2.0 m) ----------
const layout = generateContainerLayout();
const warehouse = buildWarehouse();

function realNav(): NavGrid {
  const nav = new NavGrid({ minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: LAND.maxZ }, 1.5);
  const eps = 0.74; // cell centres within half a cell of a box are blocked
  const boxes = [
    ...layout.boxes.map((b) => ({ c: b.center, h: b.halfExtents })),
    ...[...warehouse.boxes, ...buildControlCenter()].filter((b) => b.kind !== 'roof').map((b) => ({ c: b.center, h: b.halfExtents })),
  ];
  for (const { c, h } of boxes) {
    if (c.y - h.y >= 2.0 || c.y + h.y <= 0.2) continue;
    nav.blockRect(c.x - h.x - eps, c.z - h.z - eps, c.x + h.x + eps, c.z + h.z + eps);
  }
  return nav;
}

const inputs = { lanes: layout.lanes, corridor: warehouse.corridor };
const authored = authoredHarbor(inputs);
const count = (t: string) => authored.filter((p) => p.type === t).length;
const dist = (a: readonly [number, number], x: number, z: number) => Math.hypot(a[0] - x, a[1] - z);

describe('parseEnemyParam', () => {
  it('defaults to sphere, supports lists and none', () => {
    expect(parseEnemyParam(null)).toEqual(['sphere']);
    expect(parseEnemyParam('spider, charger')).toEqual(['spider', 'charger']);
    expect(parseEnemyParam('none')).toEqual([]);
    expect(parseEnemyParam('bogus')).toEqual([]);
  });
});

describe('sandbox population', () => {
  it('spawns the requested types around (0, -24)', () => {
    const pop = getPopulation(ctx(true, 'enemies=sphere,spider'));
    expect(pop.map((p) => p.type)).toEqual(['sphere', 'spider']);
    for (const p of pop) {
      expect(Math.hypot(p.position.x, p.position.z + 24)).toBeLessThan(5);
      expect(p.patrol.length).toBeGreaterThanOrEqual(3);
    }
    expect(getPopulation(ctx(true, 'enemies=none'))).toEqual([]);
    expect(getPopulation(ctx(true))).toHaveLength(1);
  });
});

describe('authored harbor population (AC4)', () => {
  it('has exactly 14 sphere / 10 spider / 6 charger', () => {
    expect(count('sphere')).toBe(ENEMY_COUNTS.sphere);
    expect(count('spider')).toBe(ENEMY_COUNTS.spider);
    expect(count('charger')).toBe(ENEMY_COUNTS.charger);
  });

  it('honours ENEMY_DISTRIBUTION per zone', () => {
    for (const zone of Object.keys(ZONES) as ZoneId[]) {
      for (const type of ['sphere', 'spider', 'charger'] as const) {
        const n = authored.filter((p) => p.type === type && zoneAt(p.at[0], p.at[1]) === zone).length;
        expect(n, `${type} in ${zone}`).toBe(ENEMY_DISTRIBUTION[zone][type]);
      }
    }
  });

  it('keeps every robot more than 40 m from the player spawn', () => {
    for (const p of authored) expect(dist(p.at, PLAYER_SPAWN.position.x, PLAYER_SPAWN.position.z)).toBeGreaterThan(40);
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
      for (let i = 1; i < p.patrol.length; i++) {
        const a = p.patrol[i - 1]!;
        const b = p.patrol[i]!;
        expect(nav.findPath(a[0], a[1], b[0], b[1]), `${p.type} ${a} -> ${b}`).not.toBeNull();
      }
    }
  });

  it('puts most Chargers on straight yard lanes', () => {
    const onLane = authored
      .filter((p) => p.type === 'charger')
      .filter((p) =>
        layout.lanes.some((l) => {
          const half = l.width / 2;
          return l.axis === 'z'
            ? Math.abs(p.at[0] - l.start.x) <= half && p.at[1] >= l.start.z && p.at[1] <= l.end.z
            : Math.abs(p.at[1] - l.start.z) <= half && p.at[0] >= l.start.x && p.at[0] <= l.end.x;
        }),
      );
    expect(onLane.length).toBeGreaterThanOrEqual(4);
  });

  it('runs one Charger through the warehouse corridor and one over the open dock', () => {
    const chargers = authored.filter((p) => p.type === 'charger');
    const c = warehouse.corridor;
    expect(chargers.some((p) => p.at[1] > c.minZ && p.at[1] < c.maxZ && p.at[0] >= c.minX && p.at[0] <= c.maxX)).toBe(true);
    expect(chargers.some((p) => zoneAt(p.at[0], p.at[1]) === 'D')).toBe(true);
  });

  it('keeps robots out of crane discs and the boss arena', () => {
    for (const p of authored) {
      for (const pt of [p.at, ...p.patrol]) {
        for (const crane of CRANE_SITES) expect(dist(pt, crane.position.x, crane.position.z), `${p.type} ${pt} near ${crane.id}`).toBeGreaterThan(14);
        expect(dist(pt, BOSS_ARENA.center.x, BOSS_ARENA.center.z)).toBeGreaterThan(BOSS_ARENA.radius + 4);
      }
    }
  });

  it('guards tower 1 lightly and tower 4 the heaviest', () => {
    const guards = TOWERS.map((t) => authored.filter((p) => dist(p.at, t.position.x, t.position.z) <= 40).length);
    expect(guards[0]).toBeLessThanOrEqual(2);
    expect(guards[3]).toBe(Math.max(...guards));
    expect(guards[3]).toBeGreaterThan(guards[1]!);
    expect(guards[3]).toBeGreaterThan(guards[2]!);
    expect(guards[0]).toBe(Math.min(...guards));
  });

  it('is deterministic', () => {
    expect(JSON.stringify(authoredHarbor(inputs))).toBe(JSON.stringify(authoredHarbor(inputs)));
  });
});

describe('lane data', () => {
  it('the fallback lanes equal the world generator output', () => {
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

  it('the fallback corridor equals the warehouse corridor', () => {
    expect(FALLBACK_CORRIDOR).toMatchObject({
      minX: warehouse.corridor.minX,
      maxX: warehouse.corridor.maxX,
      minZ: warehouse.corridor.minZ,
      maxZ: warehouse.corridor.maxZ,
    });
  });

  it('reads the world hook when present and rejects malformed data', () => {
    const good = harborInputs(ctx(false, '', { world: { lanes: layout.lanes, corridor: warehouse.corridor } }));
    expect(good.lanes).toEqual(layout.lanes);
    expect(harborInputs(ctx(false, '', { world: { lanes: [{ id: 3 }] } })).lanes).toBe(FALLBACK_LANES);
    expect(harborInputs(ctx(false)).corridor).toBe(FALLBACK_CORRIDOR);
  });
});

describe('getPopulation on the harbor', () => {
  it('returns 14 / 10 / 6 spawns on walkable cells', () => {
    const nav = realNav();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pop = getPopulation(ctx(false, '', { world: { lanes: layout.lanes, corridor: warehouse.corridor } }), nav);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    const n = (t: string) => pop.filter((p) => p.type === t).length;
    expect([n('sphere'), n('spider'), n('charger')]).toEqual([14, 10, 6]);
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
