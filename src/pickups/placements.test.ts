import { describe, expect, it } from 'vitest';
import { shotsToKill } from '@/combat/damage';
import { BOSS_ARENA, PLAYER_SPAWN, isOnLand, zoneAt } from '@/config/level';
import {
  BOSS,
  CHARGER_ROBOT,
  ECONOMY,
  ENEMY_COUNTS,
  SPHERE_ROBOT,
  SPIDER_ROBOT,
  WEAPON,
} from '@/config/tunables';
import { supplyBudget } from './logic';
import { BOSS_PLACEMENTS, ZONE_PLACEMENTS } from './placements';

const count = (list: typeof ZONE_PLACEMENTS, kind: string) => list.filter((p) => p.kind === kind).length;

describe('placement budget (GDD 5.4)', () => {
  it('places 14 crates and 10 medkits in the zones', () => {
    expect(count(ZONE_PLACEMENTS, 'ammo')).toBe(ECONOMY.ammoCratesInZones);
    expect(count(ZONE_PLACEMENTS, 'medkit')).toBe(ECONOMY.medkitsInZones);
  });
  it('places 8 crates and 3 medkits around the boss arena', () => {
    expect(count(BOSS_PLACEMENTS, 'ammo')).toBe(ECONOMY.ammoCratesInBossArena);
    expect(count(BOSS_PLACEMENTS, 'medkit')).toBe(ECONOMY.medkitsInBossArena);
  });
  it('splits crates 5/4/2/3 and medkits 3/3/2/2 over A/B/C/D', () => {
    const per = (zone: string, kind: string) =>
      ZONE_PLACEMENTS.filter((p) => p.zone === zone && p.kind === kind).length;
    expect(['A', 'B', 'C', 'D'].map((z) => per(z, 'ammo'))).toEqual([5, 4, 2, 3]);
    expect(['A', 'B', 'C', 'D'].map((z) => per(z, 'medkit'))).toEqual([3, 3, 2, 2]);
  });
  it('supply (start 210 + crates) covers the demand at 50% accuracy without drops', () => {
    const hits =
      ENEMY_COUNTS.sphere * shotsToKill(SPHERE_ROBOT.hp) +
      ENEMY_COUNTS.spider * shotsToKill(SPIDER_ROBOT.hp) +
      ENEMY_COUNTS.charger * shotsToKill(CHARGER_ROBOT.hp) +
      BOSS.weakPointCount * shotsToKill(BOSS.weakPointHp) +
      shotsToKill(BOSS.coreHp);
    const crates = count(ZONE_PLACEMENTS, 'ammo') + count(BOSS_PLACEMENTS, 'ammo');
    const supply = supplyBudget(WEAPON.magazineSize + WEAPON.reserveAmmo, crates);
    expect(supply).toBe(870);
    expect(supply).toBeGreaterThanOrEqual(hits / ECONOMY.assumedAccuracy);
  });
});

describe('candidate positions', () => {
  it('lie on land inside their declared zone, away from the spawn', () => {
    for (const p of ZONE_PLACEMENTS) {
      expect(isOnLand(p.x, p.z)).toBe(true);
      expect(zoneAt(p.x, p.z)).toBe(p.zone);
      expect(Math.hypot(p.x - PLAYER_SPAWN.position.x, p.z - PLAYER_SPAWN.position.z)).toBeGreaterThan(6);
    }
  });
  it('flags a few elevated candidates', () => {
    expect(ZONE_PLACEMENTS.filter((p) => p.elevated).length).toBeGreaterThanOrEqual(3);
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
