import { describe, expect, it } from 'vitest';
import { CONTROL_CENTER_FOOTPRINT, KEEP_CLEAR, PLAYER_SPAWN, TOWERS, WAREHOUSE_FOOTPRINT } from '@/config/level';
import { buildControlCenter, buildWarehouse, type BuildingBox } from './buildings';
import { WORLD_LOCAL } from './tunables';

const wh = buildWarehouse();

function hits(b: BuildingBox, minX: number, maxX: number, minZ: number, maxZ: number, minY = 0, maxY = 2): boolean {
  const eps = 1e-6;
  return (
    b.center.x - b.halfExtents.x < maxX - eps &&
    b.center.x + b.halfExtents.x > minX + eps &&
    b.center.z - b.halfExtents.z < maxZ - eps &&
    b.center.z + b.halfExtents.z > minZ + eps &&
    b.center.y - b.halfExtents.y < maxY - eps &&
    b.center.y + b.halfExtents.y > minY + eps
  );
}

describe('warehouse', () => {
  it('has doors at least 5 m wide on the south and north walls', () => {
    expect(wh.doors.map((d) => d.side).sort()).toEqual(['north', 'south']);
    for (const d of wh.doors) expect(d.width).toBeGreaterThanOrEqual(5);
  });

  it('can be crossed on foot from the spawn through both doors', () => {
    const r = WORLD_LOCAL.playerRadius;
    const x = WORLD_LOCAL.warehouse.doorX;
    const blockers = wh.boxes.filter((b) => hits(b, x - r, x + r, WAREHOUSE_FOOTPRINT.minZ - 3, PLAYER_SPAWN.position.z));
    expect(blockers).toEqual([]);
  });

  it('walls block movement across the footprint away from the doors', () => {
    const f = WAREHOUSE_FOOTPRINT;
    expect(wh.boxes.some((b) => hits(b, f.minX + 0.2, f.minX + 0.6, 42, 44))).toBe(true);
    expect(wh.boxes.some((b) => hits(b, f.maxX - 0.6, f.maxX - 0.2, 42, 44))).toBe(true);
    expect(wh.boxes.some((b) => hits(b, -20, -19, f.maxZ - 0.6, f.maxZ - 0.2))).toBe(true);
    expect(wh.boxes.some((b) => hits(b, -20, -19, f.minZ + 0.2, f.minZ + 0.6))).toBe(true);
  });

  it('has a roof at the footprint height', () => {
    const roof = wh.boxes.find((b) => b.kind === 'roof');
    expect(roof).toBeDefined();
    expect((roof?.center.y ?? 0) - (roof?.halfExtents.y ?? 0)).toBeCloseTo(WAREHOUSE_FOOTPRINT.height);
  });

  it('has a corridor at least 30 m long and 6 m wide that is free of shelves', () => {
    expect(wh.corridor.length).toBeGreaterThanOrEqual(30);
    expect(wh.corridor.width).toBeGreaterThanOrEqual(6);
    const c = wh.corridor;
    expect(wh.boxes.some((b) => b.kind !== 'roof' && hits(b, c.minX, c.maxX, c.minZ, c.maxZ, 0, 9))).toBe(false);
  });

  it('keeps every keep-clear disc inside the warehouse empty below 9 m', () => {
    const f = WAREHOUSE_FOOTPRINT;
    for (const d of KEEP_CLEAR) {
      if (d.x < f.minX || d.x > f.maxX || d.z < f.minZ || d.z > f.maxZ) continue;
      for (const b of wh.boxes) {
        if (b.kind === 'roof') continue;
        expect(hits(b, d.x - d.radius, d.x + d.radius, d.z - d.radius, d.z + d.radius, 0, 9) && b.kind === 'shelf').toBe(false);
      }
    }
    const t1 = TOWERS[0]!.position;
    expect(wh.boxes.some((b) => b.kind === 'shelf' && hits(b, t1.x - 7, t1.x + 7, t1.z - 7, t1.z + 7, 0, 9))).toBe(false);
  });

  it('stays inside the footprint', () => {
    const f = WAREHOUSE_FOOTPRINT;
    for (const b of wh.boxes) {
      expect(b.center.x - b.halfExtents.x).toBeGreaterThanOrEqual(f.minX - 1e-6);
      expect(b.center.x + b.halfExtents.x).toBeLessThanOrEqual(f.maxX + 1e-6);
      expect(b.center.z - b.halfExtents.z).toBeGreaterThanOrEqual(f.minZ - 1e-6);
      expect(b.center.z + b.halfExtents.z).toBeLessThanOrEqual(f.maxZ + 1e-6);
    }
  });
});

describe('control center', () => {
  it('is a two-box building on its footprint', () => {
    const boxes = buildControlCenter();
    expect(boxes).toHaveLength(2);
    const base = boxes[0]!;
    expect(base.center.x).toBeCloseTo((CONTROL_CENTER_FOOTPRINT.minX + CONTROL_CENTER_FOOTPRINT.maxX) / 2);
    expect(base.halfExtents.y * 2).toBeCloseTo(CONTROL_CENTER_FOOTPRINT.height);
  });
});
