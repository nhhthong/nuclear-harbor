import { describe, expect, it } from 'vitest';
import { BOSS_ARENA, LAND, PLAYER_SPAWN, SPAWN_SAFE_RADIUS, TOWERS, isInClosedBlock, isInPlayArea } from '@/config/level';
import { PLAYER } from '@/config/tunables';
import { PERIMETER_WALL, WAREHOUSE } from '@/config/warehouse';
import { authoredHarbor, FALLBACK_LANES } from '@/enemies/population';
import { makeTestWorld } from '@/enemies/testUtils';
import { bakeNav } from '@/enemies/nav/bakeNav';
import type { NavGrid } from '@/enemies/nav/NavGrid';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { BOSS_PLACEMENTS, ZONE_PLACEMENTS } from '@/pickups/placements';
import { DRESSING, FLOOD_LIGHTS, PROPS, VEHICLES, structureSolids } from '@/structures/layout';
import { warehouseColliders } from '@/structures/warehouseLayout';
import { buildBarriers } from './barriers';
import { generateContainerLayout } from './containerLayout';
import { PERIMETER_SEGMENTS, perimeterBoxes } from './perimeter';
import { SHELTERS, shelterBoxes, shelterFootprint } from './shelters';

/** Every static collider of the harbor that stands on the ground (no robots, boss or scorpion). */
function buildLevel(physics: PhysicsWorld): void {
  physics.addStaticBox({ center: { x: 0, y: -1, z: (LAND.minZ + LAND.maxZ) / 2 }, halfExtents: { x: (LAND.maxX - LAND.minX) / 2, y: 1, z: (LAND.maxZ - LAND.minZ) / 2 } });
  for (const b of generateContainerLayout().boxes) physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, yaw: b.yaw ?? 0 });
  for (const s of SHELTERS) for (const b of shelterBoxes(s)) physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, yaw: b.yaw });
  for (const b of buildBarriers()) physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents });
  for (const b of perimeterBoxes()) physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents });
  for (const b of structureSolids()) physics.addStaticBox({ center: b.center, halfExtents: b.half });
  for (const b of warehouseColliders()) physics.addStaticBox({ center: b.center, halfExtents: b.half, rotation: b.rotation });
}

/** 4-connected flood fill over walkable cells from a world point; returns the reached cell set. */
function flood(nav: NavGrid, x: number, z: number): Set<number> {
  const seen = new Set<number>();
  const c0 = nav.colOf(x);
  const r0 = nav.rowOf(z);
  if (!nav.isWalkableCell(c0, r0)) return seen;
  const stack = [r0 * nav.cols + c0];
  seen.add(stack[0] as number);
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const c = i % nav.cols;
    const r = Math.floor(i / nav.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      const j = nr * nav.cols + nc;
      if (!nav.inGrid(nc, nr) || seen.has(j) || !nav.isWalkableCell(nc, nr)) continue;
      seen.add(j);
      stack.push(j);
    }
  }
  return seen;
}

const reached = (nav: NavGrid, set: Set<number>, x: number, z: number): boolean => set.has(nav.rowOf(z) * nav.cols + nav.colOf(x));

describe('L-shaped map (spec 29)', () => {
  it('leads from the gate to the relay court only through the warehouse', async () => {
    const { ctx, physics } = await makeTestWorld({ sandbox: false });
    buildLevel(physics);
    const { nav } = bakeNav(ctx);
    const sp = PLAYER_SPAWN.position;
    const tower = TOWERS[0]!.position;
    const all = flood(nav, sp.x, sp.z);
    // walk: gate -> yard -> roller door -> corridor -> back door -> court -> quay
    for (const [x, z, what] of [
      [-15, 0, 'yard lane'],
      [6.5, -4, 'roller door apron'],
      [10, -4, 'inside the roller door'],
      [14, -12, 'corridor'],
      [14, -22, 'under the mezzanine, at the back door'],
      [14, -26, 'court, in front of the back door'],
      [tower.x + 6, tower.z, 'relay tower'],
      [BOSS_ARENA.center.x, BOSS_ARENA.center.z, 'boss arena'],
    ] as const) {
      expect(reached(nav, all, x, z), what).toBe(true);
    }
    // close the roller door: the court can no longer be reached from the gate
    const roller = WAREHOUSE.openings.find((o) => o.id === 'west-roller')!;
    nav.blockRect(roller.x - 1.5, roller.z - roller.width / 2 - 1, roller.x + 1.5, roller.z + roller.width / 2 + 1);
    const closed = flood(nav, sp.x, sp.z);
    expect(reached(nav, closed, -15, 0)).toBe(true);
    expect(reached(nav, closed, tower.x + 6, tower.z)).toBe(false);
    expect(reached(nav, closed, BOSS_ARENA.center.x, BOSS_ARENA.center.z)).toBe(false);
    // nothing is walkable in the closed loading dock
    for (let x = LAND.minX; x < LAND.maxX; x += 1.5) {
      for (let z = LAND.minZ; z < LAND.maxZ; z += 1.5) {
        if (isInClosedBlock(x, z) && !isInPlayArea(x, z)) expect(nav.isWalkable(x, z), `${x},${z}`).toBe(false);
      }
    }
    physics.dispose();
  });

  it('lets the player walk up the stair onto the mezzanine, and the railing holds them there', async () => {
    const { physics } = await makeTestWorld({ sandbox: false });
    buildLevel(physics);
    const s = WAREHOUSE.stairs;
    const character = physics.createCharacter({
      position: { x: (s.minX + s.maxX) / 2, y: 0.05, z: s.bottomZ + 2 },
      radius: PLAYER.capsuleRadius,
      halfHeight: PLAYER.capsuleHalfHeight,
      snapToGround: PLAYER.snapToGround,
      maxStepHeight: PLAYER.maxStepHeight,
      maxSlopeDeg: PLAYER.maxSlopeDeg,
    });
    physics.syncQueries();
    const dt = 1 / 60;
    const walk = (dx: number, dz: number, seconds: number): void => {
      for (let i = 0; i < seconds * 60; i++) {
        // -1 m/s: the player controller's grounded stick speed
        character.move({ x: dx * PLAYER.walkSpeed * dt, y: -1 * dt, z: dz * PLAYER.walkSpeed * dt });
        physics.step(dt);
      }
    };
    walk(0, -1, 3);
    let p = character.getPosition();
    expect(p.y, 'feet on the deck').toBeGreaterThan(WAREHOUSE.mezzanine.floorY - 0.1);
    expect(p.z).toBeLessThan(WAREHOUSE.mezzanine.maxZ);
    // along the deck to the east, then south against the railing
    walk(1, 0, 1.2);
    walk(0, 1, 1.5);
    p = character.getPosition();
    expect(p.y).toBeGreaterThan(WAREHOUSE.mezzanine.floorY - 0.1);
    expect(p.z).toBeLessThan(WAREHOUSE.mezzanine.maxZ);
    physics.dispose();
  });

  it('keeps supplies, shelters, robots, props and vehicles out of the closed loading dock', () => {
    const points: Array<[string, number, number]> = [
      ...[...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS].map((p) => [`supply ${p.x},${p.z}`, p.x, p.z] as [string, number, number]),
      ...SHELTERS.flatMap((sh) => {
        const f = shelterFootprint(sh);
        return [[sh.id, f.minX, f.minZ], [sh.id, f.maxX, f.maxZ]] as Array<[string, number, number]>;
      }),
      ...authoredHarbor({ lanes: FALLBACK_LANES }).flatMap((a) => [[`${a.type} post`, a.at[0], a.at[1]], ...a.patrol.map((q) => [`${a.type} patrol`, q[0], q[1]])] as Array<[string, number, number]>),
      ...PROPS.map((p) => [`${p.kind}`, p.x, p.z] as [string, number, number]),
      ...VEHICLES.map((v) => [`${v.kind}`, v.x, v.z] as [string, number, number]),
      ...DRESSING.map((d) => [`${d.kind}`, d.x, d.z] as [string, number, number]),
      ...FLOOD_LIGHTS.map((f) => [`mast ${f.id}`, f.x, f.z] as [string, number, number]),
    ];
    for (const [what, x, z] of points) expect(isInClosedBlock(x, z), `${what} at ${x}, ${z}`).toBe(false);
    // props, vehicles and clutter also stay out of the warehouse (its interior props are their own module)
    for (const b of structureSolids()) {
      const f = WAREHOUSE.footprint;
      const hit = b.center.x + b.half.x > f.minX && b.center.x - b.half.x < f.maxX && b.center.z + b.half.z > f.minZ && b.center.z - b.half.z < f.maxZ;
      expect(hit, b.id).toBe(false);
    }
  });

  it('keeps every robot post and patrol point outside the spawn safe radius', () => {
    const sp = PLAYER_SPAWN.position;
    for (const a of authoredHarbor({ lanes: FALLBACK_LANES })) {
      for (const q of [a.at, ...a.patrol]) expect(Math.hypot(q[0] - sp.x, q[1] - sp.z), `${a.type} ${q[0]},${q[1]}`).toBeGreaterThan(SPAWN_SAFE_RADIUS);
    }
  });

  it('closes the L with a 7 m wall on its land sides, not on the quay edge', () => {
    expect(PERIMETER_WALL.height).toBe(7);
    for (const s of PERIMETER_SEGMENTS) {
      // no segment runs along the quay edge
      expect(s.axis === 'x' && Math.abs(s.fixed - LAND.minZ) < 1).toBe(false);
    }
    const solidAt = (x: number, z: number, y: number) =>
      perimeterBoxes().some((b) => Math.abs(x - b.center.x) <= b.halfExtents.x && Math.abs(z - b.center.z) <= b.halfExtents.z && Math.abs(y - b.center.y) <= b.halfExtents.y);
    for (const y of [0.5, 6.5, 12]) {
      for (let z = LAND.minZ + 1; z < LAND.maxZ; z += 2) expect(solidAt(LAND.minX + 0.3, z, y), `west ${z}`).toBe(true);
      for (let x = LAND.minX + 1; x < 6; x += 2) expect(solidAt(x, LAND.maxZ - 0.3, y), `south ${x}`).toBe(true);
      for (let z = WAREHOUSE.footprint.maxZ + 0.2; z < LAND.maxZ; z += 2) expect(solidAt(6.3, z, y), `dock ${z}`).toBe(true);
      for (let z = LAND.minZ + 1; z < WAREHOUSE.footprint.minZ; z += 2) expect(solidAt(LAND.maxX - 0.3, z, y), `east ${z}`).toBe(true);
    }
  });
});
