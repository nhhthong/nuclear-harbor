/** Rocket splash damage: full at the blast centre, linear falloff, zero at and beyond `radius`. */
export function splashDamage(distance: number, radius: number, damage: number): number {
  if (distance >= radius || radius <= 0) return 0;
  return damage * (1 - Math.max(0, distance) / radius);
}
