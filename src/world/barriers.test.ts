import { describe, expect, it } from 'vitest';
import { LAND, PLAYER_SPAWN, TOWERS, WAREHOUSE_FOOTPRINT, ZONES } from '@/config/level';
import { PLAYER, SIM } from '@/config/tunables';
import { buildBarriers } from './barriers';
import { WORLD_LOCAL } from './tunables';

const boxes = buildBarriers();
const solidAt = (x: number, z: number, y: number): boolean =>
  boxes.some(
    (b) => Math.abs(x - b.center.x) <= b.halfExtents.x && Math.abs(z - b.center.z) <= b.halfExtents.z && Math.abs(y - b.center.y) <= b.halfExtents.y,
  );

describe('barriers', () => {
  it('closes the whole land perimeter up to the blocker height', () => {
    for (const y of [0.5, 5, 20, WORLD_LOCAL.barriers.blockerHeight - 0.5]) {
      for (let x = LAND.minX + 1; x < LAND.maxX; x += 3) {
        expect(solidAt(x, LAND.minZ + 0.3, y), `north ${x} y${y}`).toBe(true);
        expect(solidAt(x, LAND.maxZ - 0.3, y), `south ${x} y${y}`).toBe(true);
      }
      for (let z = LAND.minZ + 1; z < LAND.maxZ; z += 3) {
        expect(solidAt(LAND.minX + 0.3, z, y), `west ${z} y${y}`).toBe(true);
        expect(solidAt(LAND.maxX - 0.3, z, y), `east ${z} y${y}`).toBe(true);
      }
    }
  });

  it('seals both passages beside the warehouse, leaving the south door as the only way out of the forecourt', () => {
    const w = WAREHOUSE_FOOTPRINT;
    const z = w.maxZ - 0.3;
    for (let x = LAND.minX + 1; x < w.minX; x += 2) expect(solidAt(x, z, 1), `west ${x}`).toBe(true);
    for (let x = w.maxX + 0.5; x < LAND.maxX - 1; x += 2) expect(solidAt(x, z, 1), `east ${x}`).toBe(true);
    expect(PLAYER_SPAWN.position.z).toBeGreaterThan(w.maxZ);
  });

  it('is taller than a double jump and leaves two dock gates', () => {
    const jump = (PLAYER.jumpSpeed ** 2 + PLAYER.airJumpSpeed ** 2) / (2 * -SIM.gravity);
    expect(WORLD_LOCAL.barriers.blastHeight).toBeGreaterThan(jump + 0.5);
    const z = ZONES.D.maxZ;
    const open: number[] = [];
    for (let x = LAND.minX + 2; x < LAND.maxX - 2; x += 1) if (!solidAt(x, z, 1)) open.push(x);
    expect(open.length).toBeGreaterThan(40);
    expect(open.length).toBeLessThan(90);
    // two separate gaps
    const gaps = open.filter((x, i) => i === 0 || x - (open[i - 1] as number) > 1.5).length;
    expect(gaps).toBe(2);
  });

  it('keeps towers and the spawn clear', () => {
    for (const t of TOWERS) expect(solidAt(t.position.x, t.position.z, 1)).toBe(false);
    expect(solidAt(PLAYER_SPAWN.position.x, PLAYER_SPAWN.position.z, 1)).toBe(false);
  });
});
