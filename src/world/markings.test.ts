import { describe, expect, it } from 'vitest';
import { LAND, isInPlayArea, isInWarehouse } from '@/config/level';
import { WAREHOUSE } from '@/config/warehouse';
import { VEHICLES } from '@/structures/layout';
import { MARKINGS, cutRange, markingPoints, paintMarkings, type Marking } from './markings';

describe('road markings', () => {
  it('cuts ranges around gaps', () => {
    expect(cutRange(0, 10, [[3, 4]])).toEqual([
      [0, 3],
      [4, 10],
    ]);
    expect(cutRange(0, 10, [[-1, 11]])).toEqual([]);
    expect(cutRange(0, 10, [[20, 30]])).toEqual([[0, 10]]);
  });

  it('paints only on the outdoor play area, never in the closed dock or under the warehouse', () => {
    for (const m of MARKINGS) {
      for (const [x, z] of markingPoints(m)) {
        expect(x, `${m.kind} at ${x}, ${z}`).toBeGreaterThanOrEqual(LAND.minX);
        expect(x).toBeLessThanOrEqual(LAND.maxX);
        expect(z).toBeGreaterThanOrEqual(LAND.minZ);
        expect(z).toBeLessThanOrEqual(LAND.maxZ);
        expect(isInPlayArea(x, z), `${m.kind} at ${x}, ${z}`).toBe(true);
        // the warehouse floor covers the ground inside the footprint: nothing to paint there
        const inside = x > WAREHOUSE.footprint.minX + 0.5 && x < WAREHOUSE.footprint.maxX - 0.5 && z > WAREHOUSE.footprint.minZ + 0.5 && z < WAREHOUSE.footprint.maxZ - 0.5;
        expect(inside && isInWarehouse(x, z), `${m.kind} at ${x}, ${z}`).toBe(false);
      }
    }
  });

  it('has zebra crossings, parking bays, zone names and the two rings', () => {
    const count = (k: Marking['kind']): number => MARKINGS.filter((m) => m.kind === k).length;
    expect(count('zebra')).toBeGreaterThanOrEqual(4);
    expect(count('ring')).toBeGreaterThanOrEqual(2);
    const texts = MARKINGS.filter((m): m is Extract<Marking, { kind: 'text' }> => m.kind === 'text').map((m) => m.text);
    for (const name of ['YARD  A', 'COURT  B', 'GATE  C', 'QUAY  D']) expect(texts).toContain(name);
    expect(texts.filter((t) => /^\d\d$/.test(t)).length).toBeGreaterThanOrEqual(7);
  });

  it('puts every parked car of the gate apron inside a painted bay', () => {
    const lines = MARKINGS.filter((m): m is Extract<Marking, { kind: 'line' }> => m.kind === 'line' && m.paint === 'white' && m.a[0] === m.b[0]);
    for (const v of VEHICLES.filter((q) => q.z > 12 && (q.kind === 'sedan' || q.kind === 'hatchback' || q.kind === 'suv' || q.kind === 'van' || q.kind === 'pickup'))) {
      const left = lines.filter((l) => l.a[0] < v.x && Math.min(l.a[1], l.b[1]) <= v.z && Math.max(l.a[1], l.b[1]) >= v.z).map((l) => l.a[0]);
      const right = lines.filter((l) => l.a[0] > v.x && Math.min(l.a[1], l.b[1]) <= v.z && Math.max(l.a[1], l.b[1]) >= v.z).map((l) => l.a[0]);
      expect(left.length, `${v.kind} at ${v.x}`).toBeGreaterThan(0);
      expect(right.length, `${v.kind} at ${v.x}`).toBeGreaterThan(0);
      const w = Math.min(...right) - Math.max(...left);
      expect(w, `${v.kind} at ${v.x}`).toBeGreaterThan(2.3);
      expect(w).toBeLessThan(3.4);
    }
  });

  it('draws every marking kind through the canvas API', () => {
    const calls: string[] = [];
    const g = new Proxy(
      {},
      {
        get: (_t, prop: string) => (prop === 'canvas' ? {} : (..._a: unknown[]) => calls.push(prop)),
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    paintMarkings(g, 4);
    for (const c of ['fillRect', 'stroke', 'fillText', 'arc', 'fill', 'strokeRect']) expect(calls).toContain(c);
  });
});
