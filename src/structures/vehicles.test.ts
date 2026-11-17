import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, LAND } from '@/config/level';
import { authoredHarbor } from '@/enemies/population';
import { BOSS_PLACEMENTS, ZONE_PLACEMENTS } from '@/pickups/placements';
import { generateContainerLayout } from '@/world/containerLayout';
import { SHELTERS, shelterFootprint, toWorld } from '@/world/shelters';
import { craneSolids, FLOOD_LIGHTS, PROPS, propSolid, VEHICLES, vehicleSolid, type SolidBox } from './layout';

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const rectOf = (b: SolidBox, m = 0): Rect => ({ minX: b.center.x - b.half.x - m, maxX: b.center.x + b.half.x + m, minZ: b.center.z - b.half.z - m, maxZ: b.center.z + b.half.z + m });
const overlap = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const distToRect = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

const layout = generateContainerLayout();
const vehicles = VEHICLES.map((v) => ({ v, r: rectOf(vehicleSolid(v)) }));

describe('parked vehicles', () => {
  it('stay on land and use axis-aligned yaws', () => {
    for (const { v, r } of vehicles) {
      expect(r.minX).toBeGreaterThan(LAND.minX + 0.5);
      expect(r.maxX).toBeLessThan(LAND.maxX - 0.5);
      expect(r.minZ).toBeGreaterThan(LAND.minZ + 0.5);
      expect(r.maxZ).toBeLessThan(LAND.maxZ - 0.5);
      expect(Math.abs(Math.sin(2 * v.yaw))).toBeLessThan(1e-9);
    }
  });

  it('do not overlap containers, props, masts, the crane or each other', () => {
    const others: Rect[] = [
      ...layout.boxes.map((b) => {
        const yaw = b.yaw ?? 0;
        const grid = Math.abs(Math.sin(2 * yaw)) < 1e-6;
        const quarter = Math.abs(Math.sin(yaw)) > 0.7;
        const r = Math.hypot(b.halfExtents.x, b.halfExtents.z); // loose boxes at an angle: bounding square
        const hx = grid ? (quarter ? b.halfExtents.z : b.halfExtents.x) : r;
        const hz = grid ? (quarter ? b.halfExtents.x : b.halfExtents.z) : r;
        return rectOf({ id: '', center: b.center, half: { x: hx, y: 0, z: hz } });
      }),
      ...PROPS.map(propSolid).filter((s): s is SolidBox => s !== null).map((s) => rectOf(s)),
      ...FLOOD_LIGHTS.map((f) => ({ minX: f.x - 0.3, maxX: f.x + 0.3, minZ: f.z - 0.3, maxZ: f.z + 0.3 })),
      ...craneSolids().map((s) => rectOf(s)),
    ];
    vehicles.forEach(({ v, r }, i) => {
      for (const o of others) expect(overlap(rectOf(vehicleSolid(v), 0.6), o), `${v.kind}@${v.x},${v.z}`).toBe(false);
      vehicles.forEach((w, j) => {
        if (j !== i) expect(overlap(r, w.r)).toBe(false);
      });
    });
  });

  it('keep the keep-clear discs free (the crane portal is used on purpose)', () => {
    for (const { v, r } of vehicles) {
      for (const d of KEEP_CLEAR) {
        if (d.reason.startsWith('crane')) continue;
        expect(distToRect(r, d.x, d.z), `${v.kind}@${v.x},${v.z} vs ${d.reason}`).toBeGreaterThan(d.radius);
      }
    }
  });

  it('leave safe containers, their doors, supplies, lanes and robot routes alone', () => {
    for (const { v, r } of vehicles) {
      const tag = `${v.kind}@${v.x},${v.z}`;
      for (const sh of SHELTERS) {
        const f = shelterFootprint(sh);
        const door = toWorld(sh, 3 + 4, 0);
        const zone = { minX: Math.min(f.minX, door.x) - 1, maxX: Math.max(f.maxX, door.x) + 1, minZ: Math.min(f.minZ, door.z) - 1, maxZ: Math.max(f.maxZ, door.z) + 1 };
        expect(overlap(r, zone), `${tag} vs ${sh.id}`).toBe(false);
      }
      for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS]) expect(distToRect(r, p.x, p.z), `${tag} vs supply`).toBeGreaterThan(1.5);
      for (const l of layout.lanes) {
        const half = l.width / 2;
        const lr = { minX: Math.min(l.start.x, l.end.x) - half, maxX: Math.max(l.start.x, l.end.x) + half, minZ: Math.min(l.start.z, l.end.z) - half, maxZ: Math.max(l.start.z, l.end.z) + half };
        expect(overlap(r, lr), `${tag} vs lane ${l.id}`).toBe(false);
      }
      for (const a of authoredHarbor({ lanes: layout.lanes })) {
        for (const [x, z] of [a.at, ...a.patrol]) expect(distToRect(r, x, z), `${tag} vs ${a.type} route`).toBeGreaterThan(2);
      }
    }
  });
});
