import { WEAPON } from '@/config/tunables';
import type { DamageInfo, DamageResult, HitZone } from '@/core/types';

/** Damage multiplier per hit zone for one kind of target. Missing zones default to 1. */
export type ZoneMultipliers = Partial<Record<HitZone, number>>;

/** Default profile for ordinary robots: crit spots take the weapon's critical multiplier. */
export const DEFAULT_ZONE_MULTIPLIERS: ZoneMultipliers = {
  body: 1,
  critical: WEAPON.criticalMultiplier,
  armor: 1,
  weakpoint: 1,
  core: 1,
};

export function zoneMultiplier(zone: HitZone, profile: ZoneMultipliers = DEFAULT_ZONE_MULTIPLIERS): number {
  return profile[zone] ?? 1;
}

/**
 * Pure HP arithmetic shared by every Damageable: applies the zone multiplier, clamps to the
 * remaining HP and reports the outcome. The caller stores `hpAfter`.
 */
export function resolveDamage(
  hp: number,
  info: Pick<DamageInfo, 'amount' | 'zone'>,
  profile: ZoneMultipliers = DEFAULT_ZONE_MULTIPLIERS,
  zoneOverride?: HitZone,
): DamageResult & { hpAfter: number } {
  const zone = zoneOverride ?? info.zone;
  if (hp <= 0) return { dealt: 0, zone, killed: false, absorbed: true, hpAfter: 0 };
  const raw = Math.max(0, info.amount) * zoneMultiplier(zone, profile);
  const dealt = Math.min(hp, raw);
  const hpAfter = hp - dealt;
  return { dealt, zone, killed: hpAfter <= 0 && dealt > 0, absorbed: dealt <= 0, hpAfter };
}

/**
 * True when an attack travelling along `attackDir` strikes the front of a target facing
 * `facing` (both XZ, need not be normalised). Used by the Charger's front shield (GDD 6.3).
 */
export function isFrontalHit(
  facing: { x: number; z: number },
  attackDir: { x: number; z: number },
  frontArcHalfAngleDeg: number,
): boolean {
  const fl = Math.hypot(facing.x, facing.z);
  const al = Math.hypot(attackDir.x, attackDir.z);
  if (fl === 0 || al === 0) return false;
  // the attack comes from the front when it travels against the facing direction
  const cos = -(facing.x * attackDir.x + facing.z * attackDir.z) / (fl * al);
  return cos >= Math.cos((frontArcHalfAngleDeg * Math.PI) / 180);
}

/** Shots needed to deal `totalHp` with base damage per shot (GDD 5.4 budget table). */
export function shotsToKill(totalHp: number, damagePerShot: number = WEAPON.damage): number {
  return Math.ceil(totalHp / damagePerShot);
}
