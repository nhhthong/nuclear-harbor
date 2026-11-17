import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, LAND } from '@/config/level';
import { authoredHarbor } from '@/enemies/population';
import { BOSS_PLACEMENTS, ZONE_PLACEMENTS } from '@/pickups/placements';
import { generateContainerLayout } from '@/world/containerLayout';
import { SHELTERS, shelterFootprint, toWorld } from '@/world/shelters';
import { craneSolids, DRESSING, dressingSolid, FLOOD_LIGHTS, PROPS, propSolid, VEHICLES, vehicleSolid, type SolidBox } from './layout';

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
const items = DRESSING.map((d) => ({ d, s: dressingSolid(d), tag: `${d.kind}@${d.x},${d.z}` }));

describe('industrial clutter', () => {
  it('fits the level without blocking anything that matters', () => {
    const bad: string[] = [];
    const containers = layout.boxes.map((b) => {
      const yaw = b.yaw ?? 0;
      const grid = Math.abs(Math.sin(2 * yaw)) < 1e-6;
      const quarter = Math.abs(Math.sin(yaw)) > 0.7;
      const r = Math.hypot(b.halfExtents.x, b.halfExtents.z);
      return rectOf({ id: '', center: b.center, half: { x: grid ? (quarter ? b.halfExtents.z : b.halfExtents.x) : r, y: 0, z: grid ? (quarter ? b.halfExtents.x : b.halfExtents.z) : r } });
    });
    const solids: Array<[string, Rect]> = [
      ...containers.map((r): [string, Rect] => ['container', r]),
      ...PROPS.map(propSolid).filter((s): s is SolidBox => s !== null).map((s): [string, Rect] => [s.id, rectOf(s)]),
      ...FLOOD_LIGHTS.map((f): [string, Rect] => [`mast ${f.id}`, { minX: f.x - 0.3, maxX: f.x + 0.3, minZ: f.z - 0.3, maxZ: f.z + 0.3 }]),
      ...craneSolids().map((s): [string, Rect] => [s.id, rectOf(s)]),
      ...VEHICLES.map(vehicleSolid).map((s): [string, Rect] => [s.id, rectOf(s)]),
    ];
    items.forEach(({ d, s, tag }, i) => {
      const r = rectOf(s);
      if (r.minX < LAND.minX + 0.5 || r.maxX > LAND.maxX - 0.5 || r.minZ < LAND.minZ + 0.5 || r.maxZ > LAND.maxZ - 0.5) bad.push(`${tag} off land`);
      if (Math.abs(Math.sin(2 * d.yaw)) > 1e-9) bad.push(`${tag} yaw`);
      for (const [id, o] of solids) if (overlap(rectOf(s, 0.15), o)) bad.push(`${tag} hits ${id}`);
      items.forEach((o, j) => {
        if (j > i && overlap(r, rectOf(o.s))) bad.push(`${tag} hits ${o.tag}`);
      });
      for (const k of KEEP_CLEAR) if (!k.reason.startsWith('crane') && distToRect(r, k.x, k.z) <= k.radius) bad.push(`${tag} in ${k.reason}`);
      for (const sh of SHELTERS) {
        const f = shelterFootprint(sh);
        const door = toWorld(sh, 7, 0);
        const zone = { minX: Math.min(f.minX, door.x) - 1, maxX: Math.max(f.maxX, door.x) + 1, minZ: Math.min(f.minZ, door.z) - 1, maxZ: Math.max(f.maxZ, door.z) + 1 };
        if (overlap(r, zone)) bad.push(`${tag} at ${sh.id}`);
      }
      for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS]) if (distToRect(r, p.x, p.z) <= 1.5) bad.push(`${tag} near supply ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      for (const l of layout.lanes) {
        const h = l.width / 2;
        const lr = { minX: Math.min(l.start.x, l.end.x) - h, maxX: Math.max(l.start.x, l.end.x) + h, minZ: Math.min(l.start.z, l.end.z) - h, maxZ: Math.max(l.start.z, l.end.z) + h };
        if (overlap(r, lr)) bad.push(`${tag} on lane ${l.id}`);
      }
      for (const a of authoredHarbor({ lanes: layout.lanes })) for (const [x, z] of [a.at, ...a.patrol]) if (distToRect(r, x, z) <= 2) bad.push(`${tag} near ${a.type} route`);
    });
    expect(bad).toEqual([]);
  });
});
