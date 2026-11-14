import { describe, expect, it } from 'vitest';
import { LAND, PLAYER_SPAWN, TOWERS } from '@/config/level';
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

  it('keeps towers and the spawn clear', () => {
    for (const t of TOWERS) expect(solidAt(t.position.x, t.position.z, 1)).toBe(false);
    expect(solidAt(PLAYER_SPAWN.position.x, PLAYER_SPAWN.position.z, 1)).toBe(false);
  });
});
