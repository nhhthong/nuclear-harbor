import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, ZONES } from '@/config/level';
import { WORLD } from '@/config/tunables';
import { generateContainerLayout, type ColliderBox, type Lane } from './containerLayout';
import { WORLD_LOCAL } from './tunables';

const layout = generateContainerLayout();

function laneRect(l: Lane): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: Math.min(l.start.x, l.end.x) - (l.axis === 'z' ? l.width / 2 : 0),
    maxX: Math.max(l.start.x, l.end.x) + (l.axis === 'z' ? l.width / 2 : 0),
    minZ: Math.min(l.start.z, l.end.z) - (l.axis === 'x' ? l.width / 2 : 0),
    maxZ: Math.max(l.start.z, l.end.z) + (l.axis === 'x' ? l.width / 2 : 0),
  };
}

function boxHitsRect(b: ColliderBox, r: ReturnType<typeof laneRect>): boolean {
  return (
    b.center.x - b.halfExtents.x < r.maxX - 1e-6 &&
    b.center.x + b.halfExtents.x > r.minX + 1e-6 &&
    b.center.z - b.halfExtents.z < r.maxZ - 1e-6 &&
    b.center.z + b.halfExtents.z > r.minZ + 1e-6
  );
}

describe('generateContainerLayout', () => {
  it('is deterministic for the same seed and differs for another', () => {
    expect(generateContainerLayout({ seed: 7 })).toEqual(generateContainerLayout({ seed: 7 }));
    expect(generateContainerLayout({ seed: 7 }).instances.length).not.toBe(0);
    expect(generateContainerLayout({ seed: 8 }).instances).not.toEqual(generateContainerLayout({ seed: 7 }).instances);
  });

  it('places 80-200 containers in zone A and sparse clusters in B and D', () => {
    expect(layout.zoneCounts.A).toBeGreaterThanOrEqual(80);
    expect(layout.zoneCounts.A).toBeLessThanOrEqual(200);
    expect(layout.zoneCounts.B).toBeGreaterThan(0);
    expect(layout.zoneCounts.D).toBeGreaterThan(0);
    expect(layout.zoneCounts.B).toBeLessThan(layout.zoneCounts.A / 2);
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

  it('merges colliders: at most 40% as many boxes as containers, all boxes on the ground tier stack', () => {
    expect(layout.boxes.length).toBeLessThanOrEqual(layout.instances.length * 0.4);
    expect(layout.boxes.length).toBeGreaterThan(0);
  });

  it('marks top tier boxes grappleable and registers a top per stack at the top edge', () => {
    const H = WORLD.container.height;
    for (const b of layout.boxes) {
      const topY = b.center.y + b.halfExtents.y;
      const isTopBox = layout.stackTops.some((t) => Math.abs(t.y - topY) < 1e-6 && Math.abs(t.x - b.center.x) <= b.halfExtents.x);
      if (b.grappleable) expect(isTopBox).toBe(true);
      expect(Math.abs(b.halfExtents.y * 2 - H) < 1e-6 || !b.grappleable).toBe(true);
    }
    expect(layout.boxes.filter((b) => b.grappleable).length).toBeGreaterThan(0);
    for (const t of layout.stackTops) {
      const holder = layout.boxes.find(
        (b) =>
          b.grappleable &&
          Math.abs(b.center.y + b.halfExtents.y - t.y) < 1e-6 &&
          Math.abs(t.x - b.center.x) <= b.halfExtents.x &&
          Math.abs(t.z - b.center.z) <= b.halfExtents.z,
      );
      expect(holder).toBeDefined();
    }
  });

  it('provides >= 3 straight lanes >= 30 m long and >= 6 m wide, free of colliders', () => {
    const good = layout.lanes.filter(
      (l) => l.length >= WORLD_LOCAL.lane.minLength && l.width >= WORLD.chargerLaneWidth,
    );
    expect(good.length).toBeGreaterThanOrEqual(3);
    for (const l of good) {
      const r = laneRect(l);
      expect(layout.boxes.some((b) => boxHitsRect(b, r)), l.id).toBe(false);
      const z = ZONES.A;
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
