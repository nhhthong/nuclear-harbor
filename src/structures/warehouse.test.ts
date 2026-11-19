import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { WAREHOUSE } from '@/config/warehouse';
import { buildWarehouseGeometry } from './warehouse';
import { WALLS, boxBounds, openingsOf, stairFlight, stairRamp, wallPieces, warehouseColliders, type Box } from './warehouseLayout';

const colliders = warehouseColliders();
const bounds = colliders.map((b) => ({ b, r: boxBounds(b) }));
const EPS = 1e-3;

function pointInBox(b: Box, x: number, y: number, z: number): boolean {
  // inverse-rotate the offset into the box frame
  const q = b.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const v = [x - b.center.x, y - b.center.y, z - b.center.z] as const;
  const qx = -q.x;
  const qy = -q.y;
  const qz = -q.z;
  const cx = qy * v[2] - qz * v[1];
  const cy = qz * v[0] - qx * v[2];
  const cz = qx * v[1] - qy * v[0];
  const lx = v[0] + 2 * (q.w * cx + (qy * cz - qz * cy));
  const ly = v[1] + 2 * (q.w * cy + (qz * cx - qx * cz));
  const lz = v[2] + 2 * (q.w * cz + (qx * cy - qy * cx));
  return Math.abs(lx) <= b.half.x && Math.abs(ly) <= b.half.y && Math.abs(lz) <= b.half.z;
}

const overlapsXZY = (r: ReturnType<typeof boxBounds>, minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number): boolean =>
  r.minX < maxX - EPS && r.maxX > minX + EPS && r.minZ < maxZ - EPS && r.maxZ > minZ + EPS && r.minY < maxY - EPS && r.maxY > minY + EPS;

describe('warehouse shell layout', () => {
  it('cuts every opening of the contract into exactly one wall', () => {
    const found = WALLS.flatMap((w) => openingsOf(w).map((o) => o.id));
    expect(found.sort()).toEqual(WAREHOUSE.openings.map((o) => o.id).sort());
  });

  it('leaves every opening as a real gap in the colliders (doors walkable, windows open for drones)', () => {
    for (const o of WAREHOUSE.openings) {
      const along = (t: number) => (o.nz !== 0 ? { x: o.x + t, z: o.z + o.nz * -WAREHOUSE.wallThickness / 2 } : { x: o.x + o.nx * -WAREHOUSE.wallThickness / 2, z: o.z + t });
      for (let t = -o.width / 2 + 0.1; t <= o.width / 2 - 0.1; t += 0.2) {
        for (let y = o.y - o.height / 2 + 0.1; y <= o.y + o.height / 2 - 0.1; y += 0.2) {
          const p = along(t);
          const hit = colliders.find((b) => pointInBox(b, p.x, y, p.z));
          expect(hit?.id, `${o.id} at t ${t.toFixed(1)} y ${y.toFixed(1)}`).toBeUndefined();
        }
      }
    }
  });

  it('closes the walls everywhere else up to the eave', () => {
    for (const w of WALLS) {
      const pieces = wallPieces(w);
      const covered = (a: number, y: number) => pieces.some((p) => a >= p.a - EPS && a <= p.b + EPS && y >= p.y0 - EPS && y <= p.y1 + EPS);
      const inOpening = (a: number, y: number) =>
        openingsOf(w).some((o) => {
          const c = w.axis === 'x' ? o.x : o.z;
          return Math.abs(a - c) < o.width / 2 - EPS && Math.abs(y - o.y) < o.height / 2 - EPS;
        });
      for (let a = w.from; a <= w.to; a += 0.25) {
        for (let y = 0.1; y < WAREHOUSE.eaveHeight; y += 0.25) expect(covered(a, y) || inOpening(a, y), `${w.id} ${a} ${y}`).toBe(true);
      }
    }
  });

  it('keeps the walking corridor free of colliders at body height', () => {
    for (const c of WAREHOUSE.corridor) {
      for (const { b, r } of bounds) expect(overlapsXZY(r, c.minX, c.maxX, c.minZ, c.maxZ, 0.1, 1.9), b.id).toBe(false);
    }
  });

  it('keeps the stair footprint free of colliders except the stair itself', () => {
    const s = WAREHOUSE.stairs;
    for (const { b, r } of bounds) {
      if (b.id === 'stair-ramp') continue;
      expect(overlapsXZY(r, s.minX, s.maxX, s.topZ, s.bottomZ, 0, WAREHOUSE.mezzanine.floorY + 2), b.id).toBe(false);
    }
  });

  it('builds a stair the character controller can climb', () => {
    const f = stairFlight();
    expect(WAREHOUSE.stairs.riser).toBeLessThanOrEqual(PLAYER.maxStepHeight);
    expect(f.slopeDeg).toBeLessThan(PLAYER.maxSlopeDeg);
    expect(f.risers * WAREHOUSE.stairs.riser).toBeCloseTo(WAREHOUSE.mezzanine.floorY, 6);
    expect(f.treads * WAREHOUSE.stairs.tread).toBeLessThanOrEqual(f.run + EPS);
    // the ramp's top face meets the deck edge and the floor at the stair foot
    const ramp = stairRamp();
    const r = boxBounds(ramp);
    expect(r.maxY).toBeCloseTo(WAREHOUSE.mezzanine.floorY, 1);
    expect(r.minY).toBeLessThan(0);
    expect(r.minX).toBeCloseTo(WAREHOUSE.stairs.minX, 6);
    expect(r.maxX).toBeCloseTo(WAREHOUSE.stairs.maxX, 6);
  });

  it('keeps the reserved supply spot free (1.2 m)', () => {
    const s = WAREHOUSE.supplySpot;
    for (const { b, r } of bounds) expect(overlapsXZY(r, s.x - 1.2, s.x + 1.2, s.z - 1.2, s.z + 1.2, 0, 2.5), b.id).toBe(false);
  });

  it('builds finite geometry within a sane triangle budget', () => {
    const g = buildWarehouseGeometry();
    let tris = 0;
    for (const geo of [g.cladding, g.liner, g.concrete, g.floor, g.steel, g.yellow, g.glass, g.skylight, g.signs]) {
      const pos = geo.getAttribute('position');
      tris += pos.count / 3;
      for (let i = 0; i < pos.array.length; i++) expect(Number.isFinite(pos.array[i] as number)).toBe(true);
    }
    expect(tris).toBeGreaterThan(1000);
    expect(tris).toBeLessThan(120_000);
    expect(g.lamps.length).toBeGreaterThan(8);
    for (const geo of Object.values(g)) if (geo && typeof geo === 'object' && 'dispose' in geo) (geo as { dispose(): void }).dispose();
  });
});
