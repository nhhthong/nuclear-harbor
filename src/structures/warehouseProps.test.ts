import { describe, expect, it } from 'vitest';
import { WAREHOUSE } from '@/config/warehouse';
import {
  STAIR_RECT,
  WAREHOUSE_PROP_SIZE,
  ceilingRect,
  distanceToOpening,
  layoutWarehouseProps,
  propFootprint,
  rackAisles,
  rackRows,
  rectInside,
  rectsOverlap,
  type PlacedProp,
} from './warehouseProps';
import { WAREHOUSE_PROPS } from './warehousePropsTunables';

const layout = layoutWarehouseProps();
const floorProps = layout.props.filter((p) => p.zone !== 'ceiling');
const C = WAREHOUSE_PROPS.clear;

function top(p: PlacedProp): number {
  return p.y + WAREHOUSE_PROP_SIZE[p.kind].h;
}

describe('warehouse prop layout', () => {
  it('places a varied interior', () => {
    const kinds = new Set(layout.props.map((p) => p.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(24);
    expect(layout.props.filter((p) => p.kind === 'lamp').length).toBeGreaterThanOrEqual(8);
    expect(layout.wraps.length).toBeGreaterThan(20);
    for (const z of Object.keys(WAREHOUSE.propZones)) expect(floorProps.some((p) => p.zone === z), z).toBe(true);
  });

  it('is deterministic for a seed and changes with it', () => {
    expect(layoutWarehouseProps()).toEqual(layout);
    expect(layoutWarehouseProps(WAREHOUSE_PROPS.seed + 1)).not.toEqual(layout);
  });

  it('keeps every prop inside its zone', () => {
    for (const p of floorProps) {
      const zone = WAREHOUSE.propZones[p.zone as keyof typeof WAREHOUSE.propZones];
      expect(rectInside(propFootprint(p), zone), `${p.kind} at ${p.x.toFixed(2)},${p.z.toFixed(2)} in ${p.zone}`).toBe(true);
    }
    for (const p of layout.props.filter((q) => q.zone === 'ceiling')) {
      expect(rectInside(propFootprint(p), ceilingRect())).toBe(true);
      expect(p.y).toBeGreaterThan(WAREHOUSE.mezzanine.floorY + WAREHOUSE.office.height + 0.3);
      expect(p.y + WAREHOUSE_PROP_SIZE.lamp.h).toBeLessThanOrEqual(WAREHOUSE.eaveHeight);
    }
  });

  it('puts office props on the mezzanine floor and the rest on the ground', () => {
    for (const p of floorProps.filter((q) => !q.stacked)) {
      expect(p.y, p.kind).toBe(p.zone === 'office' ? WAREHOUSE.mezzanine.floorY : 0);
    }
  });

  it('never touches the corridor, the stairs or the supply spot', () => {
    for (const p of floorProps) {
      const r = propFootprint(p);
      for (const c of WAREHOUSE.corridor) expect(rectsOverlap(r, c, C.corridor), `${p.kind} on corridor`).toBe(false);
      expect(rectsOverlap(r, STAIR_RECT), `${p.kind} on stairs`).toBe(false);
      const s = WAREHOUSE.supplySpot;
      const dx = Math.max(0, r.minX - s.x, s.x - r.maxX);
      const dz = Math.max(0, r.minZ - s.z, s.z - r.maxZ);
      expect(Math.hypot(dx, dz), `${p.kind} near supply`).toBeGreaterThanOrEqual(C.supply);
    }
  });

  it('keeps 1.5 m from every opening', () => {
    for (const p of floorProps) {
      for (const o of WAREHOUSE.openings) {
        expect(distanceToOpening(propFootprint(p), p.y, top(p), o), `${p.kind} at ${p.x.toFixed(2)},${p.z.toFixed(2)} vs ${o.id}`).toBeGreaterThanOrEqual(C.opening);
      }
    }
  });

  it('does not overlap floor items with each other or with the racks', () => {
    const items = floorProps.filter((p) => !p.stacked && !(p.zone === 'racks' && p.y > 0));
    const rackItems = new Set<PlacedProp>();
    for (const p of items) for (const r of layout.racks) if (rectsOverlap(propFootprint(p), { ...r, minX: r.minX - 0.06, maxX: r.maxX + 0.06 })) rackItems.add(p);
    // rack-floor loads stand inside a rack row; everything else must stay out of the rows
    for (const p of rackItems) expect(p.kind, 'only pallets stand inside racks').toBe('pallet');
    const free = items.filter((p) => !rackItems.has(p));
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const a = free[i]!;
        const b = free[j]!;
        if (a.zone !== b.zone || Math.abs(a.y - b.y) > 0.01) continue;
        expect(rectsOverlap(propFootprint(a), propFootprint(b), -0.01), `${a.kind}@${a.x.toFixed(2)},${a.z.toFixed(2)} vs ${b.kind}@${b.x.toFixed(2)},${b.z.toFixed(2)}`).toBe(false);
      }
    }
  });

  it('builds racks with forklift aisles and walkable zone edges', () => {
    const rows = rackRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.sides === 2)).toBe(true);
    for (const a of rackAisles(rows)) expect(a).toBeGreaterThanOrEqual(WAREHOUSE_PROPS.racks.minAisle);
    const zone = WAREHOUSE.propZones.racks;
    for (const r of rows) {
      expect(rectInside(r, zone)).toBe(true);
      expect(r.maxZ - r.minZ).toBeCloseTo(WAREHOUSE_PROPS.racks.bays * WAREHOUSE_PROPS.racks.bayLength);
    }
    // west edge (next to the open floor) and both ends stay walkable
    expect(Math.min(...rows.map((r) => r.minX)) - zone.minX).toBeGreaterThanOrEqual(1.2);
    expect(Math.min(...rows.map((r) => r.minZ)) - zone.minZ).toBeGreaterThanOrEqual(2.5);
    expect(zone.maxZ - Math.max(...rows.map((r) => r.maxZ))).toBeGreaterThanOrEqual(2.5);
  });

  it('keeps rack loads on the beams, below the next level', () => {
    const R = WAREHOUSE_PROPS.racks;
    const levels = [0, ...R.beamLevels];
    const inRow = (p: PlacedProp): boolean => layout.racks.some((r) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ);
    const pallets = layout.props.filter((p) => p.zone === 'racks' && p.kind === 'pallet' && inRow(p));
    expect(pallets.length).toBeGreaterThan(50);
    for (const p of pallets) expect(levels.some((l) => Math.abs(l - p.y) < 1e-6)).toBe(true);
    for (const w of layout.wraps) {
      const base = w.y - WAREHOUSE_PROP_SIZE.pallet.h;
      const li = levels.findIndex((l) => Math.abs(l - base) < 1e-6);
      if (li < 0) continue; // floor-stack wraps
      const ceiling = li + 1 < levels.length ? levels[li + 1]! - R.beamHeight : R.uprightHeight;
      expect(w.y + w.h).toBeLessThanOrEqual(ceiling);
    }
  });

  it('gives large props colliders inside the footprint and none to small items', () => {
    const f = WAREHOUSE.footprint;
    const inner = { minX: f.minX + WAREHOUSE.wallThickness, maxX: f.maxX - WAREHOUSE.wallThickness, minZ: f.minZ + WAREHOUSE.wallThickness, maxZ: f.maxZ - WAREHOUSE.wallThickness };
    expect(layout.colliders.length).toBeGreaterThan(15);
    for (const c of layout.colliders) {
      const r = { minX: c.center.x - c.half.x, maxX: c.center.x + c.half.x, minZ: c.center.z - c.half.z, maxZ: c.center.z + c.half.z };
      expect(rectInside(r, inner), c.id).toBe(true);
      for (const cr of WAREHOUSE.corridor) expect(rectsOverlap(r, cr), `${c.id} on corridor`).toBe(false);
      expect(c.center.y + c.half.y).toBeLessThanOrEqual(WAREHOUSE.eaveHeight);
    }
    // one collider per rack side
    const sides = layout.racks.reduce((n, r) => n + r.sides, 0);
    expect(layout.colliders.filter((c) => c.id.startsWith('rack-')).length).toBe(sides);
    for (const small of ['binder', 'jerrycan', 'extinguisher', 'stool', 'wet_floor_sign', 'cardboard_box']) {
      expect(layout.colliders.some((c) => c.id.startsWith(`${small}@`)), small).toBe(false);
    }
    for (const big of ['office_desk', 'computer_desk', 'workbench', 'tool_cart', 'cabinet-n']) expect(layout.colliders.some((c) => c.id === big), big).toBe(true);
  });
});
