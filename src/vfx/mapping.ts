import type { BossAttackId, HitZone } from '@/core/types';
import type { RecipeId } from './recipes';
import { VFX } from './tunables';

/** Which recipe a bullet hit on a damageable shows (GDD 5.3, 9.2). */
export function hitRecipe(zone: HitZone, absorbed: boolean): RecipeId {
  if (zone === 'weakpoint' || zone === 'core') return 'weakpoint-burst';
  if (absorbed || zone === 'armor') return 'armor-spark';
  return 'spark';
}

/** Reflects direction `d` about unit normal `n` into `out` (ricochet). */
export function reflect(
  dx: number, dy: number, dz: number, nx: number, ny: number, nz: number,
  out: { x: number; y: number; z: number },
): void {
  const k = 2 * (dx * nx + dy * ny + dz * nz);
  out.x = dx - k * nx;
  out.y = dy - k * ny;
  out.z = dz - k * nz;
}

/** Dust scale for a landing, or 0 when it is not a hard landing. */
export function landingScale(impactSpeed: number): number {
  if (impactSpeed < VFX.hardLandingSpeed) return 0;
  const t = Math.min(1, impactSpeed / VFX.landingSpeedForMaxScale);
  return Math.max(0.6, t * VFX.landingScaleMax);
}

/** Effect for a boss attack: ground-based attacks raise dust and a ring, others explode. */
export function bossAttackRecipes(attack: BossAttackId): readonly RecipeId[] {
  switch (attack) {
    case 'ground-slam':
      return ['dust', 'telegraph-ring'];
    case 'shockwave':
      return ['dust', 'telegraph-ring'];
    case 'emp-pulse':
    case 'quad-laser':
    case 'drone-release':
      return ['armor-spark', 'telegraph-ring'];
    case 'body-spin':
      return ['dust', 'telegraph-ring'];
    case 'target-lock':
      return ['spark'];
    default:
      return ['explosion'];
  }
}
