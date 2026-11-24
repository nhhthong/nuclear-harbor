import { ECONOMY } from '@/config/tunables';
import type { PickupKind } from '@/core/types';
import { PICKUP } from './tunables';

export interface PlayerLike {
  readonly hp: number;
  readonly maxHp: number;
  readonly alive: boolean;
}

export interface CollectResult {
  readonly accepted: boolean;
  /** Rounds for ammo, HP that would be restored for a medkit. */
  readonly amount: number;
}

const REFUSED: CollectResult = { accepted: false, amount: 0 };
const AMMO_ACCEPTED: CollectResult = { accepted: true, amount: ECONOMY.ammoCrateAmount };

/** Pre-check of the collection rules: ammo is always accepted, a medkit only if it would heal. */
export function collect(kind: PickupKind, player: PlayerLike): CollectResult {
  if (!player.alive) return REFUSED;
  if (kind === 'ammo') return AMMO_ACCEPTED;
  const heal = Math.min(player.maxHp - player.hp, ECONOMY.medkitHeal);
  return heal > 0 ? { accepted: true, amount: heal } : REFUSED;
}

/** Drop roll: honours the per-zone cap (drops spawned so far) and `enemyAmmoDropChance`. */
export function shouldDrop(rng: () => number, zoneDropsSoFar: number): boolean {
  if (zoneDropsSoFar >= ECONOMY.maxEnemyDropsPerZone) return false;
  return rng() < ECONOMY.enemyAmmoDropChance;
}

/**
 * What a shot-down dragonfly drops (spec 34): a medkit with a chance that grows as the player's HP falls
 * (never above `droneDropFullHp` of the HP, where a medkit would be wasted), otherwise ammo.
 */
export function droneDropKind(hpFraction: number, rand: number): PickupKind {
  if (hpFraction >= ECONOMY.droneDropFullHp) return 'ammo';
  const chance = Math.min(ECONOMY.droneDropMaxMedkitChance, Math.max(0, 1 - hpFraction));
  return rand < chance ? 'medkit' : 'ammo';
}

/** Does a shot-down drone drop anything? Roster drones always do, the boss's with `bossDroneDropChance`. */
export function droneDrops(source: 'roster' | 'boss', rand: number): boolean {
  return source === 'roster' || rand < ECONOMY.bossDroneDropChance;
}

/** Blink visibility for a dropped pickup with `remaining` seconds left. */
export function dropBlinkVisible(remaining: number): boolean {
  if (remaining > PICKUP.blinkWindow) return true;
  return Math.floor(remaining * PICKUP.blinkHz) % 2 === 1;
}

export type RayDown = (x: number, z: number, fromY: number) => number | null;

export interface RestingSpot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Finds the surface a pickup rests on. `rayDown` returns the hit height or null (sea / void).
 * Elevated candidates take the first surface. Others should be near the ground: when the first hit
 * is higher than `groundMaxY` (e.g. a container roof) nearby ring offsets are tried, falling back to
 * the first hit. Returns null when nothing is hit at all.
 */
export function findRestingSpot(
  x: number,
  z: number,
  elevated: boolean,
  rayDown: RayDown,
  fromY: number = PICKUP.rayStartY,
): RestingSpot | null {
  const first = rayDown(x, z, fromY);
  if (first === null) return null;
  if (elevated || first <= PICKUP.groundMaxY) return { x, y: first, z };
  for (const r of PICKUP.searchRadii) {
    for (let i = 0; i < PICKUP.searchDirections; i++) {
      const a = (i / PICKUP.searchDirections) * Math.PI * 2;
      const nx = x + Math.cos(a) * r;
      const nz = z + Math.sin(a) * r;
      const y = rayDown(nx, nz, fromY);
      if (y !== null && y <= PICKUP.groundMaxY) return { x: nx, y, z: nz };
    }
  }
  return { x, y: first, z };
}

/** Rounds available from the start supply plus placed crates (no drops). */
export function supplyBudget(startRounds: number, crates: number): number {
  return startRounds + crates * ECONOMY.ammoCrateAmount;
}
