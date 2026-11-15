import { describe, expect, it } from 'vitest';
import { KEEP_CLEAR, LAND, PLAYER_SPAWN, isOnLand, zoneAt } from '@/config/level';
import { structureSolids } from '@/structures/layout';
import { generateContainerLayout } from './containerLayout';
import { SHELTER, SHELTERS, insideShelter, shelterBoxes, shelterFootprint, toLocal, toWorld } from './shelters';

const layout = generateContainerLayout();

describe('safe containers', () => {
  it('has a handful, each inside its declared zone', () => {
    expect(SHELTERS.length).toBeGreaterThanOrEqual(4);
    for (const s of SHELTERS) {
      const f = shelterFootprint(s);
      for (const [x, z] of [[f.minX, f.minZ], [f.maxX, f.maxZ]] as const) {
        expect(isOnLand(x, z), s.id).toBe(true);
      }
      expect(zoneAt(s.x, s.z), s.id).toBe(s.zone);
    }
  });

  it('converts between container and world frames', () => {
    const s = { id: 't', zone: 'A' as const, x: 10, z: -5, yaw: Math.PI / 2 };
    const w = toWorld(s, 3, 1);
    const l = toLocal(s, w.x, w.z);
    expect(l.lx).toBeCloseTo(3);
    expect(l.lz).toBeCloseTo(1);
    // door (+x local) faces (cos yaw, -sin yaw) = north for yaw = PI / 2
    expect(toWorld(s, 1, 0).z - s.z).toBeCloseTo(-1);
  });

  it('is entered through the open end only, and is solid elsewhere', () => {
    const s = SHELTERS[0]!;
    const inside = toWorld(s, 0.5, 0);
    expect(insideShelter(s, inside.x, 0, inside.z)).toBe(true);
    const behind = toWorld(s, -4, 0);
    expect(insideShelter(s, behind.x, 0, behind.z)).toBe(false);
    const onRoof = toWorld(s, 0, 0);
    expect(insideShelter(s, onRoof.x, 3, onRoof.z)).toBe(false);
    const front = toWorld(s, 4.5, 0);
    expect(insideShelter(s, front.x, 0, front.z)).toBe(false);
    // the collider walls leave a doorway wide enough for the player capsule
    const boxes = shelterBoxes(s);
    expect(boxes).toHaveLength(6);
    const side = boxes[0]!;
    const other = boxes[1]!;
    const gap = Math.hypot(side.center.x - other.center.x, side.center.z - other.center.z) - side.halfExtents.z - other.halfExtents.z;
    expect(gap).toBeGreaterThan(1.8);
    expect(SHELTER.healPerSecond).toBeGreaterThan(0);
  });

  it('keeps clear of containers, props, the spawn and the keep-clear discs, with room at the door', () => {
    const solids = [
      ...layout.boxes.map((b) => ({ x: b.center.x, z: b.center.z, hx: b.halfExtents.x, hz: b.halfExtents.z })),
      ...structureSolids().map((b) => ({ x: b.center.x, z: b.center.z, hx: b.half.x, hz: b.half.z })),
    ];
    for (const s of SHELTERS) {
      // footprint (room + 3 m apron in front of the door), grown by half a metre
      const apron = shelterFootprint({ ...s });
      const a = toWorld(s, 3.03 + 3, 0);
      const minX = Math.min(apron.minX, a.x) - 0.5;
      const maxX = Math.max(apron.maxX, a.x) + 0.5;
      const minZ = Math.min(apron.minZ, a.z) - 0.5;
      const maxZ = Math.max(apron.maxZ, a.z) + 0.5;
      for (const b of solids) {
        const overlap = Math.abs((minX + maxX) / 2 - b.x) < (maxX - minX) / 2 + b.hx && Math.abs((minZ + maxZ) / 2 - b.z) < (maxZ - minZ) / 2 + b.hz;
        expect(overlap, `${s.id} vs solid at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`).toBe(false);
      }
      for (const d of KEEP_CLEAR) expect(Math.hypot(s.x - d.x, s.z - d.z), `${s.id} vs ${d.reason}`).toBeGreaterThan(d.radius + 3);
      expect(Math.hypot(s.x - PLAYER_SPAWN.position.x, s.z - PLAYER_SPAWN.position.z)).toBeGreaterThan(8);
      expect(s.x - 3.5).toBeGreaterThan(LAND.minX);
      expect(s.x + 3.5).toBeLessThan(LAND.maxX);
    }
  });
});
