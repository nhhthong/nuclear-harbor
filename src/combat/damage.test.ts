import { describe, expect, it } from 'vitest';
import { BOSS, ECONOMY, ENEMY_COUNTS, ARMY_ROBOT, WEAPON } from '@/config/tunables';
import { DUCK } from '@/enemies/duck/tunables';
import { SPOT } from '@/enemies/spot/tunables';
import { resolveDamage, shotsToKill } from './damage';

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

  it('absorbs hits on immune armour', () => {
    const r = resolveDamage(4000, { amount: 25, zone: 'armor' }, { armor: BOSS.armorDamageMultiplier });
    expect(r.absorbed).toBe(true);
    expect(r.hpAfter).toBe(4000);
  });
});

describe('ammo budget (GDD 5.4)', () => {
  it('needs about 273 hits (3 army, 3 Spot, 2 Duck, boss) and the supply covers 50% accuracy', () => {
    const hits =
      ENEMY_COUNTS.army * shotsToKill(ARMY_ROBOT.hp) +
      ENEMY_COUNTS.spot * shotsToKill(SPOT.hp) +
      ENEMY_COUNTS.duck * shotsToKill(DUCK.hp) +
      BOSS.weakPointCount * shotsToKill(BOSS.weakPointHp) +
      shotsToKill(BOSS.coreHp);
    expect(hits).toBe(273);
    const supply =
      WEAPON.magazineSize +
      WEAPON.reserveAmmo +
      (ECONOMY.ammoCratesInZones + ECONOMY.ammoCratesInBossArena) * ECONOMY.ammoCrateAmount;
    expect(supply).toBe(570);
    expect(supply).toBeGreaterThanOrEqual(hits / ECONOMY.assumedAccuracy);
  });
});
