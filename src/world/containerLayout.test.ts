import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, LAND, YARD_RECT, ZONES, isInPlayArea, isInWarehouse } from '@/config/level';
import { WAREHOUSE } from '@/config/warehouse';
import { WORLD } from '@/config/tunables';
import { generateContainerLayout, type ColliderBox, type Lane } from './containerLayout';
import { WORLD_LOCAL } from './tunables';

const layout = generateContainerLayout();
const L = WORLD.container.length;

function laneRect(l: Lane): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: Math.min(l.start.x, l.end.x) - (l.axis === 'z' ? l.width / 2 : 0),
    maxX: Math.max(l.start.x, l.end.x) + (l.axis === 'z' ? l.width / 2 : 0),
    minZ: Math.min(l.start.z, l.end.z) - (l.axis === 'x' ? l.width / 2 : 0),
    maxZ: Math.max(l.start.z, l.end.z) + (l.axis === 'x' ? l.width / 2 : 0),
  };
}

/** Half extents of the axis-aligned bounds of a (possibly rotated) collider box. */
function aabbHalf(b: ColliderBox): { x: number; z: number } {
  const c = Math.abs(Math.cos(b.yaw ?? 0));
  const s = Math.abs(Math.sin(b.yaw ?? 0));
  return { x: b.halfExtents.x * c + b.halfExtents.z * s, z: b.halfExtents.x * s + b.halfExtents.z * c };
}

function boxHitsRect(b: ColliderBox, r: ReturnType<typeof laneRect>): boolean {
  const h = aabbHalf(b);
  return b.center.x - h.x < r.maxX - 1e-6 && b.center.x + h.x > r.minX + 1e-6 && b.center.z - h.z < r.maxZ - 1e-6 && b.center.z + h.z > r.minZ + 1e-6;
}

describe('generateContainerLayout', () => {
  it('is deterministic for the same seed and differs for another', () => {
    expect(generateContainerLayout({ seed: 7 })).toEqual(generateContainerLayout({ seed: 7 }));
    expect(generateContainerLayout({ seed: 7 }).instances.length).not.toBe(0);
    expect(generateContainerLayout({ seed: 8 }).instances).not.toEqual(generateContainerLayout({ seed: 7 }).instances);
  });

  it('places 30-100 containers in the yard (the west leg of the L since spec 29)', () => {
    expect(layout.zoneCounts.A).toBeGreaterThanOrEqual(30);
    expect(layout.zoneCounts.A).toBeLessThanOrEqual(100);
  });

  it('fills only the west leg: nothing in the warehouse, the closed loading dock or outside the L', () => {
    for (const c of layout.instances) {
      expect(isInPlayArea(c.x, c.z), `${c.x},${c.z}`).toBe(true);
      expect(isInWarehouse(c.x, c.z), `${c.x},${c.z}`).toBe(false);
      if (c.zone === 'A') {
        expect(c.x + L / 2).toBeLessThanOrEqual(YARD_RECT.maxX + 1e-6);
        expect(c.z).toBeGreaterThan(YARD_RECT.minZ);
      }
    }
    for (const b of layout.boxes) {
      const h = aabbHalf(b);
      const r = { minX: b.center.x - h.x, maxX: b.center.x + h.x, minZ: b.center.z - h.z, maxZ: b.center.z + h.z };
      const f = WAREHOUSE.footprint;
      expect(r.minX < f.maxX && r.maxX > f.minX + 1e-6 && r.minZ < f.maxZ && r.maxZ > f.minZ + 1e-6).toBe(false);
    }
  });

  it('closes the yard to the north with a two-high container wall without any gap', () => {
    const H = WORLD.container.height;
    const z = YARD_RECT.minZ + WORLD.container.width / 2;
    const solidAt = (x: number, y: number): boolean =>
      layout.boxes.some((b) => !b.yaw && Math.abs(x - b.center.x) <= b.halfExtents.x && Math.abs(y - b.center.y) <= b.halfExtents.y && Math.abs(z - b.center.z) <= b.halfExtents.z);
    for (let x = LAND.minX + 0.05; x <= YARD_RECT.maxX - 0.05; x += 0.25) {
      for (const y of [0.3, 1.5, H + 0.5, 2 * H - 0.2, 2 * H + 2, 12]) expect(solidAt(x, y), `x ${x.toFixed(2)} y ${y}`).toBe(true);
    }
    const wall = layout.instances.filter((c) => Math.abs(c.z - z) < 1e-6);
    expect(Math.max(...wall.map((c) => c.tier))).toBe(WORLD_LOCAL.yard.northWallTiers);
    expect(WORLD_LOCAL.yard.northWallTiers * H).toBeGreaterThan(1.8 + 1);
  });

  it('keeps stacks within 1..maxContainerStack and flags exactly one top per stack', () => {
    for (const c of layout.instances) {
      expect(c.tier).toBeGreaterThanOrEqual(1);
      expect(c.tier).toBeLessThanOrEqual(WORLD.maxContainerStack);
    }
    expect(layout.instances.filter((c) => c.isTop).length).toBe(layout.stackTops.length);
  });

  it('keeps every container out of the keep-clear discs', () => {
    for (const c of layout.instances) {
      for (const d of KEEP_CLEAR) {
        // centre distance; container half diagonal is about 3.3 m
        expect(Math.hypot(c.x - d.x, c.z - d.z), `${d.reason} @ ${c.x},${c.z}`).toBeGreaterThan(d.radius);
      }
    }
    for (const b of layout.boxes) {
      for (const d of KEEP_CLEAR) {
        const px = Math.max(b.center.x - b.halfExtents.x, Math.min(d.x, b.center.x + b.halfExtents.x));
        const pz = Math.max(b.center.z - b.halfExtents.z, Math.min(d.z, b.center.z + b.halfExtents.z));
        expect(Math.hypot(px - d.x, pz - d.z), d.reason).toBeGreaterThanOrEqual(d.radius);
      }
    }
  });

  it('keeps zone A containers inside zone A and others inside their zone', () => {
    for (const c of layout.instances) {
      const z = ZONES[c.zone];
      expect(c.x).toBeGreaterThan(z.minX);
      expect(c.x).toBeLessThan(z.maxX);
      expect(c.z).toBeGreaterThan(z.minZ);
      expect(c.z).toBeLessThan(z.maxZ);
    }
  });

  it('merges colliders: equal-height neighbours share boxes (at most 80% as many boxes as containers)', () => {
    expect(layout.boxes.length).toBeLessThanOrEqual(layout.instances.length * 0.8);
    expect(layout.boxes.length).toBeGreaterThan(0);
  });

  it('marks top tier boxes grappleable and registers a top per stack at the top edge', () => {
    const H = WORLD.container.height;
    for (const b of layout.boxes) {
      const topY = b.center.y + b.halfExtents.y;
      const isTopBox = layout.stackTops.some((t) => Math.abs(t.y - topY) < 1e-6 && Math.abs(t.x - b.center.x) <= aabbHalf(b).x + 1e-6);
      if (b.grappleable) expect(isTopBox).toBe(true);
      expect(Math.abs(b.halfExtents.y * 2 - H) < 1e-6 || !b.grappleable).toBe(true);
    }
    expect(layout.boxes.filter((b) => b.grappleable).length).toBeGreaterThan(0);
    for (const t of layout.stackTops) {
      const holder = layout.boxes.find(
        (b) =>
          b.grappleable &&
          Math.abs(b.center.y + b.halfExtents.y - t.y) < 1e-6 &&
          Math.abs(t.x - b.center.x) <= aabbHalf(b).x + 1e-6 &&
          Math.abs(t.z - b.center.z) <= aabbHalf(b).z + 1e-6,
      );
      expect(holder).toBeDefined();
    }
  });

  it('provides >= 3 straight lanes >= 24 m long and >= 6 m wide, free of colliders', () => {
    const good = layout.lanes.filter(
      (l) => l.length >= WORLD_LOCAL.lane.minLength && l.width >= WORLD.chargerLaneWidth,
    );
    expect(good.length).toBeGreaterThanOrEqual(3);
    for (const l of good) {
      const r = laneRect(l);
      expect(layout.boxes.some((b) => boxHitsRect(b, r)), l.id).toBe(false);
      const z = YARD_RECT;
      expect(r.minX).toBeGreaterThanOrEqual(z.minX);
      expect(r.maxX).toBeLessThanOrEqual(z.maxX);
      expect(r.minZ).toBeGreaterThanOrEqual(z.minZ);
      expect(r.maxZ).toBeLessThanOrEqual(z.maxZ);
    }
  });

  it('keeps lanes out of keep-clear discs', () => {
    for (const l of layout.lanes) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = l.start.x + (l.end.x - l.start.x) * t;
        const z = l.start.z + (l.end.z - l.start.z) * t;
        for (const d of KEEP_CLEAR) expect(Math.hypot(x - d.x, z - d.z)).toBeGreaterThan(d.radius);
      }
    }
  });
});
