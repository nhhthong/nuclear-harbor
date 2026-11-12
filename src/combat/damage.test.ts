import { describe, expect, it } from 'vitest';
import { BOSS, CHARGER_ROBOT, ECONOMY, ENEMY_COUNTS, SPHERE_ROBOT, SPIDER_ROBOT, WEAPON } from '@/config/tunables';
import { isFrontalHit, resolveDamage, shotsToKill } from './damage';

describe('resolveDamage', () => {
  it('applies the critical multiplier (GDD 5.3)', () => {
    const r = resolveDamage(100, { amount: WEAPON.damage, zone: 'critical' });
    expect(r.dealt).toBe(50);
    expect(r.hpAfter).toBe(50);
    expect(r.killed).toBe(false);
  });

  it('clamps to remaining HP and reports the kill', () => {
    const r = resolveDamage(10, { amount: 25, zone: 'body' });
    expect(r.dealt).toBe(10);
    expect(r.killed).toBe(true);
  });

  it('reduces frontal Charger hits by 90% (GDD 6.3)', () => {
    const r = resolveDamage(200, { amount: 25, zone: 'armor' }, { armor: CHARGER_ROBOT.frontDamageMultiplier });
    expect(r.dealt).toBeCloseTo(2.5);
  });

  it('absorbs hits on immune armour', () => {
    const r = resolveDamage(4000, { amount: 25, zone: 'armor' }, { armor: BOSS.armorDamageMultiplier });
    expect(r.absorbed).toBe(true);
    expect(r.hpAfter).toBe(4000);
  });
});

describe('isFrontalHit', () => {
  const facing = { x: 0, z: -1 }; // looking north
  it('detects shots coming from the front', () => {
    expect(isFrontalHit(facing, { x: 0, z: 1 }, 60)).toBe(true);
  });
  it('treats rear and flank shots as non-frontal', () => {
    expect(isFrontalHit(facing, { x: 0, z: -1 }, 60)).toBe(false);
    expect(isFrontalHit(facing, { x: 1, z: 0 }, 60)).toBe(false);
  });
});

describe('ammo budget (GDD 5.4)', () => {
  it('needs about 404 hits and the supply covers 50% accuracy', () => {
    const hits =
      ENEMY_COUNTS.sphere * shotsToKill(SPHERE_ROBOT.hp) +
      ENEMY_COUNTS.spider * shotsToKill(SPIDER_ROBOT.hp) +
      ENEMY_COUNTS.charger * shotsToKill(CHARGER_ROBOT.hp) +
      BOSS.weakPointCount * shotsToKill(BOSS.weakPointHp) +
      shotsToKill(BOSS.coreHp);
    expect(hits).toBe(404);
    const supply =
      WEAPON.magazineSize +
      WEAPON.reserveAmmo +
      (ECONOMY.ammoCratesInZones + ECONOMY.ammoCratesInBossArena) * ECONOMY.ammoCrateAmount;
    expect(supply).toBe(870);
    expect(supply).toBeGreaterThanOrEqual(hits / ECONOMY.assumedAccuracy);
  });
});
