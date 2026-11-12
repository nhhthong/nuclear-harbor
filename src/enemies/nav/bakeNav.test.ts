import { describe, expect, it } from 'vitest';
import { LAND } from '@/config/level';
import { addGround, makeTestWorld } from '../testUtils';
import { bakeNav } from './bakeNav';

describe('bakeNav', () => {
  it('blocks containers and sea, keeps open ground walkable (sandbox)', async () => {
    const { ctx, physics } = await makeTestWorld({ sandbox: true });
    addGround(physics, 30); // nav slab is 80 m: the outer ring has no ground
    physics.addStaticBox({ center: { x: 10, y: 1.2, z: 0 }, halfExtents: { x: 6, y: 1.2, z: 1.2 } });
    physics.addStaticBox({ center: { x: -10, y: 0.15, z: 0 }, halfExtents: { x: 2, y: 0.15, z: 2 } }); // 0.3 m step: blocked
    physics.addStaticBox({ center: { x: 0, y: 6, z: 12 }, halfExtents: { x: 3, y: 0.2, z: 3 } }); // overhead beam: walkable under
    const { nav } = bakeNav(ctx);
    expect(nav.isWalkable(0, 0)).toBe(true);
    expect(nav.isWalkable(10, 0)).toBe(false);
    expect(nav.isWalkable(-10, 0)).toBe(false);
    expect(nav.isWalkable(0, 12)).toBe(true);
    expect(nav.isWalkable(35, 0)).toBe(false);
    // a path around the container exists and avoids blocked cells
    const path = nav.findPath(0, 0, 20, 0);
    expect(path).not.toBeNull();
    for (const p of path ?? []) expect(nav.isWalkable(p.x, p.z)).toBe(true);
  });

  it('bakes the full harbor-sized grid quickly', async () => {
    const { ctx, physics } = await makeTestWorld({ sandbox: false });
    physics.addStaticBox({
      center: { x: 0, y: -0.5, z: (LAND.minZ + LAND.maxZ) / 2 },
      halfExtents: { x: 120, y: 0.5, z: (LAND.maxZ - LAND.minZ) / 2 },
    });
    for (let i = 0; i < 60; i++) {
      physics.addStaticBox({
        center: { x: -100 + (i % 10) * 20, y: 1.3, z: -50 + Math.floor(i / 10) * 15 },
        halfExtents: { x: 6, y: 1.3, z: 1.2 },
      });
    }
    const { nav, ms } = bakeNav(ctx);
    console.info(`harbor-sized bake: ${nav.cols}x${nav.rows} in ${ms.toFixed(1)} ms`);
    expect(nav.walkableCount).toBeGreaterThan(nav.cols * nav.rows * 0.8);
    expect(ms).toBeLessThan(1000);
  });
});
