import { BIPED } from '@/enemies/biped/tunables';
import { describe, expect, it } from 'vitest';
import { shotsToKill } from '@/combat/damage';
import { BOSS_ARENA, PLAYER_SPAWN, TOWERS, isOnLand, zoneAt } from '@/config/level';
import {
  BOSS,
  ECONOMY,
  ENEMY_COUNTS,
  ARMY_ROBOT,
  WEAPON,
} from '@/config/tunables';
import { DUCK } from '@/enemies/duck/tunables';
import { SPOT } from '@/enemies/spot/tunables';
import { SAMURAI } from '@/enemies/samurai/tunables';
import { DRONE } from '@/enemies/drone/tunables';
import { WAREHOUSE } from '@/config/warehouse';
import { structureSolids } from '@/structures/layout';
import { generateContainerLayout } from '@/world/containerLayout';
import { supplyBudget } from './logic';
import { BOSS_PLACEMENTS, ZONE_PLACEMENTS } from './placements';

const count = (list: typeof ZONE_PLACEMENTS, kind: string) => list.filter((p) => p.kind === kind).length;

describe('placement budget', () => {
  it('places the configured crates and medkits in the zones and around the boss arena', () => {
    expect(count(ZONE_PLACEMENTS, 'ammo')).toBe(ECONOMY.ammoCratesInZones);
    expect(count(ZONE_PLACEMENTS, 'medkit')).toBe(ECONOMY.medkitsInZones);
    expect(count(BOSS_PLACEMENTS, 'ammo')).toBe(ECONOMY.ammoCratesInBossArena);
    expect(count(BOSS_PLACEMENTS, 'medkit')).toBe(ECONOMY.medkitsInBossArena);
  });

  it('supply (start 210 + crates = 690) covers the demand (356 hits) at the assumed accuracy without drops', () => {
    const hits =
      ENEMY_COUNTS.army * shotsToKill(ARMY_ROBOT.hp) +
      ENEMY_COUNTS.spot * shotsToKill(SPOT.hp) +
      ENEMY_COUNTS.duck * shotsToKill(DUCK.hp) +
      ENEMY_COUNTS.biped * shotsToKill(BIPED.hp) +
      ENEMY_COUNTS.samurai * shotsToKill(SAMURAI.hp) +
      ENEMY_COUNTS.drone * shotsToKill(DRONE.hp) +
      shotsToKill(BOSS.hp);
    expect(hits).toBe(356);
    const crates = count(ZONE_PLACEMENTS, 'ammo') + count(BOSS_PLACEMENTS, 'ammo');
    const supply = supplyBudget(WEAPON.magazineSize + WEAPON.reserveAmmo, crates);
    expect(supply).toBe(WEAPON.magazineSize + WEAPON.reserveAmmo + (ECONOMY.ammoCratesInZones + ECONOMY.ammoCratesInBossArena) * ECONOMY.ammoCrateAmount);
    expect(supply).toBe(690);
    expect(supply).toBeGreaterThanOrEqual(hits / ECONOMY.assumedAccuracy);
  });

  it('puts exactly one crate at the reserved warehouse supply spot (spec 29)', () => {
    const at = ZONE_PLACEMENTS.filter((p) => Math.hypot(p.x - WAREHOUSE.supplySpot.x, p.z - WAREHOUSE.supplySpot.z) < 1.2);
    expect(at).toHaveLength(1);
    expect(at[0]!.kind).toBe('ammo');
    expect(at[0]!.castFromY).toBeLessThan(WAREHOUSE.mezzanine.floorY);
  });

  it('lie on land inside their declared zone, away from the spawn', () => {
    for (const p of ZONE_PLACEMENTS) {
      expect(isOnLand(p.x, p.z)).toBe(true);
      expect(zoneAt(p.x, p.z)).toBe(p.zone);
      expect(Math.hypot(p.x - PLAYER_SPAWN.position.x, p.z - PLAYER_SPAWN.position.z)).toBeGreaterThan(6);
    }
  });

  it('puts boss supplies on land just outside the arena radius', () => {
    for (const p of BOSS_PLACEMENTS) {
      expect(isOnLand(p.x, p.z)).toBe(true);
      const d = Math.hypot(p.x - BOSS_ARENA.center.x, p.z - BOSS_ARENA.center.z);
      expect(d).toBeGreaterThan(BOSS_ARENA.radius);
      expect(d).toBeLessThan(BOSS_ARENA.radius + 5);
    }
  });
});

// ---- placement against the real quay geometry ------------------------------------------------------
const layout = generateContainerLayout();
const solids = [
  ...layout.boxes.map((b) => {
    const c = Math.abs(Math.cos(b.yaw ?? 0));
    const sn = Math.abs(Math.sin(b.yaw ?? 0));
    return { c: b.center, h: { x: b.halfExtents.x * c + b.halfExtents.z * sn, y: b.halfExtents.y, z: b.halfExtents.x * sn + b.halfExtents.z * c } };
  }),
  ...structureSolids().map((b) => ({ c: b.center, h: b.half })),
];

/**
 * Height of the highest surface at (x, z); boxes are grown by `grow` metres (negative shrinks). Boxes whose bottom
 * is at or above `below` (an indoor crate's ray start, e.g. under the mezzanine) are ignored.
 */
function surfaceAt(x: number, z: number, grow = 0, below = Infinity): number {
  let best = 0;
  for (const b of solids) {
    if (b.c.y - b.h.y >= below) continue;
    if (Math.abs(x - b.c.x) <= b.h.x + grow && Math.abs(z - b.c.z) <= b.h.z + grow) best = Math.max(best, b.c.y + b.h.y);
  }
  return best;
}

/** Spec 29: stream A clears the yard containers out of the warehouse block; before that merge the indoor check is skipped. */
const containersInWarehouse = layout.boxes.some(
  (b) => b.center.x > WAREHOUSE.footprint.minX && b.center.x < WAREHOUSE.footprint.maxX && b.center.z > WAREHOUSE.footprint.minZ && b.center.z < WAREHOUSE.footprint.maxZ,
);

describe('placements against the real layout', () => {
  it('rests ground supplies on the ground with 0.6 m clearance from containers and props', () => {
    for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS].filter((q) => !q.elevated && q.castFromY === undefined)) {
      expect(surfaceAt(p.x, p.z, 0.6), `${p.kind} at ${p.x}, ${p.z}`).toBe(0);
    }
  });

  it.skipIf(containersInWarehouse)('rests indoor supplies (warehouse) on the floor below their ray start', () => {
    for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS].filter((q) => q.castFromY !== undefined)) {
      expect(surfaceAt(p.x, p.z, 0.6, p.castFromY), `${p.kind} at ${p.x}, ${p.z}`).toBe(0);
    }
  });

  it('keeps every supply on the ground (the lowered jump cannot reach container tops)', () => {
    expect([...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS].filter((q) => q.elevated)).toHaveLength(0);
  });

  it('keeps every supply off the tower', () => {
    for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS]) {
      for (const t of TOWERS) expect(Math.hypot(p.x - t.position.x, p.z - t.position.z)).toBeGreaterThan(2);
    }
  });
});
