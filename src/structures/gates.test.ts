import { describe, expect, it } from 'vitest';
import { PLAYER_SPAWN, isInPlayArea } from '@/config/level';
import { WAREHOUSE } from '@/config/warehouse';
import { WORLD_LOCAL } from '@/world/tunables';
import { generateContainerLayout } from '@/world/containerLayout';
import { SHELTERS } from '@/world/shelters';
import { ZONE_PLACEMENTS, BOSS_PLACEMENTS } from '@/pickups/placements';
import { structureSolids } from './layout';
import { GateState, GateSystem, distanceToLeaf, fenceBoxes, fenceRuns, gateDefs, leafBox } from './gates';
import { GATES } from './tunables';

const overlaps = (a: { center: { x: number; z: number }; half: { x: number; z: number } }, c: { x: number; z: number }, h: { x: number; z: number }, pad = 0): boolean =>
  Math.abs(a.center.x - c.x) < a.half.x + h.x + pad && Math.abs(a.center.z - c.z) < a.half.z + h.z + pad;

describe('fences and gates layout', () => {
  it('leaves a gap exactly where each gate is, and fills the rest of each line', () => {
    const runs = fenceRuns();
    for (const g of gateDefs()) {
      for (const r of runs.filter((q) => q.z === g.z)) {
        const inGap = r.x1 > g.x - g.width / 2 + 0.01 && r.x0 < g.x + g.width / 2 - 0.01;
        expect(inGap, `run ${r.x0}..${r.x1} crosses gate ${g.id}`).toBe(false);
      }
      const span = g.leaves.reduce((s, l) => s + l.length, 0);
      expect(span).toBeCloseTo(g.width);
    }
    for (const l of GATES.lines) {
      const covered = runs.filter((r) => r.z === l.z).reduce((s, r) => s + (r.x1 - r.x0), 0);
      const gaps = GATES.gates.filter((g) => g.line === l.id).reduce((s, g) => s + g.width, 0);
      expect(covered + gaps).toBeCloseTo(l.x1 - l.x0, 1);
    }
  });

  it('puts the lane gates on the yard lanes', () => {
    for (const x of WORLD_LOCAL.yard.nsLanesX) {
      const g = gateDefs().find((q) => q.z === 12.4 && Math.abs(q.x - x) < 0.01);
      expect(g, `gate on lane x ${x}`).toBeDefined();
      expect(g!.width).toBeGreaterThanOrEqual(WORLD_LOCAL.yard.laneWidth - 0.01);
    }
  });

  it('keeps fences and gates on the play area, clear of containers, structures, shelters and supplies', () => {
    const layout = generateContainerLayout();
    const solids = structureSolids();
    const boxes = [...fenceBoxes(), ...gateDefs().flatMap((g) => g.leaves.map(leafBox))];
    for (const b of boxes) {
      expect(isInPlayArea(b.center.x - b.half.x + 0.1, b.center.z)).toBe(true);
      expect(isInPlayArea(b.center.x + b.half.x - 0.1, b.center.z)).toBe(true);
      for (const c of layout.boxes) {
        const cs = Math.abs(Math.cos(c.yaw ?? 0));
        const sn = Math.abs(Math.sin(c.yaw ?? 0));
        const h = { x: c.halfExtents.x * cs + c.halfExtents.z * sn, z: c.halfExtents.x * sn + c.halfExtents.z * cs };
        expect(overlaps(b, c.center, h), `fence at ${b.center.x}, ${b.center.z} hits a container at ${c.center.x}, ${c.center.z}`).toBe(false);
      }
      for (const s of solids) expect(overlaps(b, s.center, s.half), `fence at ${b.center.x}, ${b.center.z} hits a structure at ${s.center.x}, ${s.center.z}`).toBe(false);
      for (const sh of SHELTERS) expect(overlaps(b, sh, { x: 3.5, z: 3.5 }), `fence near shelter ${sh.id}`).toBe(false);
      for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS]) expect(overlaps(b, p, { x: 0.5, z: 0.5 }), `fence on a supply at ${p.x}, ${p.z}`).toBe(false);
      expect(overlaps(b, WAREHOUSE.footprint.minX < b.center.x ? { x: 0, z: 0 } : { x: 1e6, z: 1e6 }, { x: 0, z: 0 })).toBe(false);
    }
    expect(Math.hypot(gateDefs()[0]!.x - PLAYER_SPAWN.position.x, gateDefs()[0]!.z - PLAYER_SPAWN.position.z)).toBeGreaterThan(5);
  });
});

describe('gate motion', () => {
  const def = gateDefs().find((g) => g.leaves.length === 2)!;

  it('opens when the player touches a leaf, swings away from the player, then closes once nobody is near', () => {
    const sys = new GateSystem([def]);
    const g = sys.gates[0]!;
    const south = { x: def.x - 1, z: def.z + 0.6 };
    expect(distanceToLeaf(def.leaves[0]!, south.x, south.z)).toBeLessThan(GATES.touchDistance);
    const ev = sys.update(1 / 60, south, []);
    expect(ev[0]?.event).toBe('opened');
    expect(g.side).toBe(-1); // pushed from the south: swings north
    expect(g.passable).toBe(true);
    for (let i = 0; i < 120; i++) sys.update(1 / 60, south, []);
    expect(g.phase).toBe('open');
    expect(g.angle).toBeCloseTo(GATES.openAngle);
    // still near: stays open
    for (let i = 0; i < 60 * (GATES.closeDelay + 1); i++) sys.update(1 / 60, { x: def.x, z: def.z - 1.5 }, []);
    expect(g.phase).toBe('open');
    // walk away: closes after the delay
    let closed = false;
    for (let i = 0; i < 60 * (GATES.closeDelay + 4); i++) if (sys.update(1 / 60, { x: def.x + 30, z: def.z + 30 }, []).some((e) => e.event === 'closed')) closed = true;
    expect(closed).toBe(true);
    expect(g.passable).toBe(false);
  });

  it('opens for a robot that walks up to it', () => {
    const sys = new GateSystem([def]);
    sys.update(1 / 60, null, [{ x: def.x + 2.9, z: def.z - 1.5 }]); // near the outer end of a leaf
    expect(sys.gates[0]!.phase).toBe('opening');
    expect(sys.gates[0]!.side).toBe(1); // pushed from the north: swings south
  });

  it('leaf yaw points each leaf towards the swing side', () => {
    const g = new GateState(def);
    g.side = 1;
    g.angle = Math.PI / 2;
    for (const leaf of def.leaves) {
      const base = leaf.dir === -1 ? Math.PI : 0;
      const yaw = base + g.leafYaw(leaf);
      // three.js: +x rotated by yaw about +y -> (cos, -sin): the leaf tip must move to +z
      expect(-Math.sin(yaw)).toBeGreaterThan(0.99);
    }
  });
});
