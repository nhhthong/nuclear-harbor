import { describe, expect, it } from 'vitest';
import { ECONOMY } from '@/config/tunables';
import { collect, dropBlinkVisible, droneDropKind, droneDrops, findRestingSpot, shouldDrop } from './logic';

describe('collect', () => {
  it('always accepts ammo while alive', () => {
    expect(collect('ammo', { hp: 100, maxHp: 100, alive: true })).toEqual({ accepted: true, amount: 30 });
  });
  it('refuses a medkit at full HP', () => {
    expect(collect('medkit', { hp: 100, maxHp: 100, alive: true }).accepted).toBe(false);
  });
  it('heals 40, capped at max', () => {
    expect(collect('medkit', { hp: 50, maxHp: 100, alive: true })).toEqual({ accepted: true, amount: 40 });
    expect(collect('medkit', { hp: 80, maxHp: 100, alive: true })).toEqual({ accepted: true, amount: 20 });
  });
  it('refuses everything when dead', () => {
    expect(collect('ammo', { hp: 0, maxHp: 100, alive: false }).accepted).toBe(false);
  });
});

describe('shouldDrop', () => {
  it('rolls against the drop chance', () => {
    expect(shouldDrop(() => ECONOMY.enemyAmmoDropChance - 0.001, 0)).toBe(true);
    expect(shouldDrop(() => ECONOMY.enemyAmmoDropChance, 0)).toBe(false);
  });
  it('never drops beyond the per-zone cap', () => {
    expect(shouldDrop(() => 0, ECONOMY.maxEnemyDropsPerZone)).toBe(false);
    expect(shouldDrop(() => 0, ECONOMY.maxEnemyDropsPerZone - 1)).toBe(true);
  });
  it('matches the configured drop chance over many rolls', () => {
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let n = 0;
    for (let i = 0; i < 20000; i++) if (shouldDrop(rng, 0)) n++;
    expect(n / 20000).toBeGreaterThan(ECONOMY.enemyAmmoDropChance - 0.02);
    expect(n / 20000).toBeLessThan(ECONOMY.enemyAmmoDropChance + 0.02);
  });
});

describe('dropBlinkVisible', () => {
  it('is steady until the last 5 s, then alternates', () => {
    expect(dropBlinkVisible(30)).toBe(true);
    expect(dropBlinkVisible(5.01)).toBe(true);
    const states = new Set([4.9, 4.7, 4.45, 4.2].map(dropBlinkVisible));
    expect(states.size).toBe(2);
  });
});

describe('findRestingSpot', () => {
  it('returns null over the sea', () => {
    expect(findRestingSpot(0, 0, false, () => null)).toBeNull();
  });
  it('takes the first surface for elevated candidates', () => {
    expect(findRestingSpot(1, 2, true, () => 6)).toEqual({ x: 1, y: 6, z: 2 });
  });
  it('moves a ground candidate off a container roof', () => {
    const spot = findRestingSpot(0, 0, false, (x, z) => (Math.hypot(x, z) < 1.5 ? 6 : 0));
    expect(spot?.y).toBe(0);
    expect(Math.hypot(spot?.x ?? 0, spot?.z ?? 0)).toBeGreaterThanOrEqual(1.5);
  });
  it('falls back to the first hit when everything nearby is high', () => {
    expect(findRestingSpot(0, 0, false, () => 6)).toEqual({ x: 0, y: 6, z: 0 });
  });
});

describe('dragonfly drops (spec 34)', () => {
  it('drop ammo when the player is healthy (a medkit would be wasted)', () => {
    for (const r of [0, 0.3, 0.99]) expect(droneDropKind(1, r)).toBe('ammo');
    expect(droneDropKind(ECONOMY.droneDropFullHp, 0)).toBe('ammo');
  });

  it('the lower the HP the likelier a medkit, capped below certainty', () => {
    expect(droneDropKind(0.5, 0.4)).toBe('medkit'); // 50% chance, roll 0.4
    expect(droneDropKind(0.5, 0.6)).toBe('ammo');
    expect(droneDropKind(0.1, 0.8)).toBe('medkit'); // chance 0.85 at most
    expect(droneDropKind(0.1, 0.9)).toBe('ammo'); // never a sure medkit
    expect(droneDropKind(0, 0.86)).toBe('ammo');
  });

  it('roster drones always drop, the boss drones with their chance', () => {
    expect(droneDrops('roster', 0.999)).toBe(true);
    expect(droneDrops('boss', ECONOMY.bossDroneDropChance - 0.01)).toBe(true);
    expect(droneDrops('boss', ECONOMY.bossDroneDropChance + 0.01)).toBe(false);
  });

  it('a drop is small: it gives less than a crate or a medkit', () => {
    expect(ECONOMY.droneDropAmmo).toBeLessThanOrEqual(ECONOMY.ammoCrateAmount);
    expect(ECONOMY.droneDropHeal).toBeLessThan(ECONOMY.medkitHeal);
  });
});
