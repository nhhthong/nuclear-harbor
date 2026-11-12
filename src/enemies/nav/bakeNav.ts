import { LAND } from '@/config/level';
import { AI_SCHEDULING } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import { QueryGroups } from '@/physics/groups';
import { ENEMY_LOCAL } from '../tunables';
import { NavGrid, type NavBounds } from './NavGrid';

/** Obstacles between these heights above the ground block walking (GDD: containers, walls). */
const OBSTACLE_MIN_Y = 0.2;
const OBSTACLE_MAX_Y = 2.0;

const navByContext = new WeakMap<object, NavGrid>();

export function registerNav(ctx: object, nav: NavGrid): void {
  navByContext.set(ctx, nav);
}

export function navFor(ctx: object): NavGrid | undefined {
  return navByContext.get(ctx);
}

export function navBoundsFor(sandbox: boolean): NavBounds {
  if (sandbox) {
    const g = ENEMY_LOCAL.sandboxNavHalf;
    return { minX: -g, maxX: g, minZ: -g, maxZ: g };
  }
  return { minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: LAND.maxZ };
}

export interface BakeResult {
  nav: NavGrid;
  ms: number;
}

/**
 * Bakes the nav grid from static colliders: per cell, a box overlap query over the obstacle
 * height band (0.2 .. 2.0 m) plus one downward ray that must find ground. Sea (no ground) is blocked.
 */
export function bakeNav(ctx: GameContext, cellSize: number = AI_SCHEDULING.navCellSize): BakeResult {
  const t0 = performance.now();
  const { physics } = ctx;
  const bounds = navBoundsFor(ctx.flags.sandbox);
  const nav = new NavGrid(bounds, cellSize);
  physics.syncQueries();

  const rapier = physics.rapier;
  const half = cellSize * 0.5;
  const bandHalf = (OBSTACLE_MAX_Y - OBSTACLE_MIN_Y) / 2;
  const shape = new rapier.Cuboid(half, bandHalf, half);
  const rotation = { x: 0, y: 0, z: 0, w: 1 };
  const position = { x: 0, y: OBSTACLE_MIN_Y + bandHalf, z: 0 };
  const origin = { x: 0, y: OBSTACLE_MIN_Y + 0.05, z: 0 };
  const down = { x: 0, y: -1, z: 0 };

  for (let row = 0; row < nav.rows; row++) {
    const z = nav.centerZ(row);
    for (let col = 0; col < nav.cols; col++) {
      const x = nav.centerX(col);
      position.x = x;
      position.z = z;
      const blockedByObstacle =
        physics.world.intersectionWithShape(position, rotation, shape, undefined, QueryGroups.worldOnly) !== null;
      let blocked = blockedByObstacle;
      if (!blocked) {
        origin.x = x;
        origin.z = z;
        const ground = physics.raycast(origin, down, 1.5, { groups: QueryGroups.worldOnly });
        blocked = ground === null;
      }
      if (blocked) nav.setBlocked(col, row);
    }
  }
  if (nav.walkableCount === 0) {
    // No level geometry at all (the world module is not built yet): treat the land as open so
    // that the framework stays testable. Never happens with a built harbor or sandbox.
    nav.walkable.fill(1);
    console.info('[enemies] no ground found while baking the nav grid; assuming open land');
  }
  const ms = performance.now() - t0;
  return { nav, ms };
}
