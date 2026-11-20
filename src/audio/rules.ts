import { PERIMETER_WALL, WAREHOUSE } from '@/config/warehouse';
import { AUDIO } from './tunables';

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export type StepSurface = 'concrete' | 'metal';
export type ImpactMaterial = 'concrete' | 'metal';

const inStairs = (x: number, z: number): boolean => {
  const s = WAREHOUSE.stairs;
  return x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;
};

/**
 * Surface under the player's feet. Ground level (asphalt yard, concrete quay, the warehouse slab) is
 * concrete; the steel stair, the mezzanine and anything raised (container tops) is metal.
 */
export function footstepSurface(feet: Vec3Like): StepSurface {
  if (inStairs(feet.x, feet.z)) return 'metal';
  return feet.y > AUDIO.surfaces.metalAboveY ? 'metal' : 'concrete';
}

/**
 * Material hit by a bullet that struck no damageable: floors at ground level and the perimeter wall
 * are concrete; containers, the warehouse steel, the mezzanine, props and vehicles are metal.
 */
export function impactMaterial(point: Vec3Like, normal: Vec3Like): ImpactMaterial {
  if (normal.y > AUDIO.surfaces.floorNormalY && point.y < AUDIO.surfaces.groundY) return 'concrete';
  const wall = AUDIO.surfaces.perimeter;
  const nearWall = point.x <= wall.minX || point.x >= wall.maxX || point.z >= wall.maxZ;
  if (nearWall && point.y <= PERIMETER_WALL.height + 0.1) return 'concrete';
  return 'metal';
}

/** Low-health layer level 0..1: silent above `start` of max HP, full at `full`, smooth in between. */
export function lowHealthLevel(hp: number, maxHp: number): number {
  if (!(maxHp > 0) || hp <= 0) return 0;
  const { start, full } = AUDIO.lowHealth;
  const f = hp / maxHp;
  if (f >= start) return 0;
  if (f <= full) return 1;
  const t = (start - f) / (start - full);
  return t * t * (3 - 2 * t);
}

/** Heartbeat playback rate for a low-health level (faster when closer to death). */
export function heartbeatRate(level: number): number {
  const { rateMin, rateMax } = AUDIO.lowHealth;
  return rateMin + (rateMax - rateMin) * Math.min(1, Math.max(0, level));
}
