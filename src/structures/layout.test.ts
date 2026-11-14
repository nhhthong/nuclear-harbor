import { describe, expect, it } from 'vitest';
import { CRANE_SITES, KEEP_CLEAR, TOWERS, isKeepClear } from '@/config/level';
import { GRAPPLE } from '@/config/tunables';
import { bottomY } from './boxes';
import { checkCoverage, groundFootprints, sampleWalkable } from './coverage';
import { craneLocalParts, craneLowParts, placeCrane } from './craneLayout';
import { buildLayout } from './layout';

const layout = buildLayout();

describe('cranes', () => {
  it('places six cranes with 12 members each and a 6-box low level', () => {
    expect(layout.cranes).toHaveLength(6);
    expect(layout.cranes.map((c) => c.site.id)).toEqual(CRANE_SITES.map((s) => s.id));
    for (const c of layout.cranes) expect(c.boxes).toHaveLength(craneLocalParts().length);
    expect(craneLowParts()).toHaveLength(6);
  });

  it('legs are not grappleable, beams and booms are', () => {
    for (const c of layout.cranes) {
      for (const b of c.boxes) {
        if (b.id.includes('/leg-')) expect(b.grappleable).toBe(false);
        if (/portal|mid|boom/.test(b.id)) expect(b.grappleable).toBe(true);
      }
      expect(c.anchors.length).toBeGreaterThanOrEqual(5);
      expect(c.anchors.map((a) => a.kind)).toContain('crane');
      expect(c.anchors.map((a) => a.kind)).toContain('beam');
    }
  });

  it('keeps ground footprints inside the keep-clear disc of the site', () => {
    for (const c of layout.cranes) {
      const disc = KEEP_CLEAR.find((d) => d.reason === c.site.id);
      expect(disc).toBeDefined();
      for (const b of c.boxes.filter((m) => bottomY(m) < 9)) {
        const cos = Math.cos(b.yaw);
        const sin = Math.sin(b.yaw);
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const x = b.center.x + sx * b.half.x * cos + sz * b.half.z * sin;
            const z = b.center.z - sx * b.half.x * sin + sz * b.half.z * cos;
            expect(Math.hypot(x - c.site.position.x, z - c.site.position.z)).toBeLessThan(disc?.radius ?? 0);
          }
        }
      }
    }
  });

  it('applies scale and yaw to anchors', () => {
    const site = { ...CRANE_SITES[1]!, position: { x: 0, y: 0, z: 0 }, yaw: Math.PI / 2, scale: 2 };
    const placed = placeCrane(site);
    const tip = placed.anchors.find((a) => a.id.endsWith('boom/anchor'));
    expect(tip).toBeDefined();
    // local +Z (boom direction) maps to world +X after a quarter turn
    expect(tip!.position.x).toBeGreaterThan(50);
    expect(Math.abs(tip!.position.z)).toBeLessThan(1e-6);
  });
});

describe('perches and platform', () => {
  it('has no boss perch towers (the grappling hook was removed)', () => {
    expect(layout.perches).toHaveLength(0);
  });

  it('builds the 8 x 8 m tower-3 platform with top at the tower-3 height and two masts, no stairs', () => {
    const tower = TOWERS[2]!;
    const slab = layout.platform.boxes.find((b) => b.id.endsWith('/slab'))!;
    expect(slab.half.x * 2).toBe(8);
    expect(slab.half.z * 2).toBe(8);
    expect(slab.center.y + slab.half.y).toBe(tower.position.y);
    expect(slab.center.x).toBe(tower.position.x);
    expect(layout.platform.anchors).toHaveLength(2);
    expect(layout.platform.anchors[0]!.position.x).toBeGreaterThan(tower.position.x);
    expect(layout.platform.anchors[1]!.position.x).toBeLessThan(tower.position.x);
    // only the four legs touch the ground, inside the tower disc (r 7)
    const grounded = layout.platform.boxes.filter((b) => bottomY(b) < 1);
    expect(grounded).toHaveLength(4);
    for (const b of grounded) {
      expect(Math.hypot(b.center.x - tower.position.x, b.center.z - tower.position.z) + b.half.x * 1.5).toBeLessThan(7);
    }
  });
});

describe('lamp posts and coverage', () => {
  it('keeps lamp posts out of keep-clear discs and the control center', () => {
    expect(layout.lamps.length).toBeGreaterThanOrEqual(6);
    for (const l of layout.lamps) {
      expect(isKeepClear(l.x, l.z)).toBe(false);
      expect(l.height).toBeGreaterThanOrEqual(8);
      expect(l.height).toBeLessThanOrEqual(10);
    }
  });

  it('covers every walkable 5 m sample of zones B and D within grapple range (100%)', () => {
    const samples = sampleWalkable(groundFootprints(layout.allBoxes));
    expect(samples.length).toBeGreaterThan(200);
    const result = checkCoverage(samples, layout.anchors, GRAPPLE.maxRange);
    expect(result.map((r) => r.zone).sort()).toEqual(['B', 'D']);
    for (const r of result) {
      expect(r.uncovered).toEqual([]);
      expect(r.covered).toBe(r.total);
    }
  });

  it('reports uncovered samples when anchors are missing', () => {
    const samples = sampleWalkable([]);
    const result = checkCoverage(samples, [], GRAPPLE.maxRange);
    expect(result.every((r) => r.covered === 0 && r.uncovered.length === r.total)).toBe(true);
  });

  it('has unique ids and anchors that reference a box', () => {
    const ids = new Set(layout.allBoxes.map((b) => b.id));
    expect(ids.size).toBe(layout.allBoxes.length);
    const anchorIds = new Set(layout.anchors.map((a) => a.id));
    expect(anchorIds.size).toBe(layout.anchors.length);
    for (const a of layout.anchors) expect(ids.has(a.boxId)).toBe(true);
    expect(new Set(layout.anchors.map((a) => a.kind))).toEqual(new Set(['crane', 'beam', 'lamp-post', 'perch']));
  });
});
