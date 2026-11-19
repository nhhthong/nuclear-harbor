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

  it('supply (start 210 + crates) covers the demand at 50% accuracy without drops', () => {
    const hits =
      ENEMY_COUNTS.army * shotsToKill(ARMY_ROBOT.hp) +
      ENEMY_COUNTS.spot * shotsToKill(SPOT.hp) +
      ENEMY_COUNTS.duck * shotsToKill(DUCK.hp) +
      ENEMY_COUNTS.biped * shotsToKill(BIPED.hp) +
      shotsToKill(BOSS.hp);
    const crates = count(ZONE_PLACEMENTS, 'ammo') + count(BOSS_PLACEMENTS, 'ammo');
    const supply = supplyBudget(WEAPON.magazineSize + WEAPON.reserveAmmo, crates);
    expect(supply).toBe(WEAPON.magazineSize + WEAPON.reserveAmmo + (ECONOMY.ammoCratesInZones + ECONOMY.ammoCratesInBossArena) * ECONOMY.ammoCrateAmount);
    expect(supply).toBeGreaterThanOrEqual(hits / ECONOMY.assumedAccuracy);
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

/** Height of the highest surface at (x, z); boxes are grown by `grow` metres (negative shrinks). */
function surfaceAt(x: number, z: number, grow = 0): number {
  let best = 0;
  for (const b of solids) {
    if (Math.abs(x - b.c.x) <= b.h.x + grow && Math.abs(z - b.c.z) <= b.h.z + grow) best = Math.max(best, b.c.y + b.h.y);
  }
  return best;
}

describe('placements against the real layout', () => {
  it('rests ground supplies on the ground with 0.6 m clearance from containers and props', () => {
    for (const p of [...ZONE_PLACEMENTS, ...BOSS_PLACEMENTS].filter((q) => !q.elevated)) {
      expect(surfaceAt(p.x, p.z, 0.6), `${p.kind} at ${p.x}, ${p.z}`).toBe(0);
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
