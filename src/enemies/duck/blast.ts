/** Blast damage: fixed inside the radius (boundary inclusive), nothing outside. */
export function blastDamage(distance: number, radius: number, damage: number): number {
  return distance <= radius ? damage : 0;
}

/** Displayed count (3, 2, 1) for the elapsed arming time; 0 once the fuse is spent. */
export function countdownValue(elapsed: number, count: number, countSeconds: number): number {
  const left = count - Math.floor(elapsed / countSeconds);
  return left < 0 ? 0 : left;
}

export function fuseSpent(elapsed: number, count: number, countSeconds: number): boolean {
  return elapsed >= count * countSeconds;
}
