/** Pure view-model helpers for the UI (no DOM, unit tested). */

export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ammoText(mag: number, reserve: number): string {
  return `${mag} / ${reserve}`;
}

export function hpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.min(1, Math.max(0, hp / maxHp));
}

/**
 * Bearing in degrees (-180..180) of a world-space offset (dx, dz) relative to the view yaw.
 * 0 = straight ahead, +90 = right, -90 = left, +-180 = behind. yaw = 0 looks along -Z and
 * positive yaw turns left (see PlayerState).
 */
export function relativeBearingDeg(dx: number, dz: number, yaw: number): number {
  const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
  const right = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  return (Math.atan2(right, forward) * 180) / Math.PI;
}

export function bearingDeg(px: number, pz: number, tx: number, tz: number, yaw: number): number {
  return relativeBearingDeg(tx - px, tz - pz, yaw);
}

/** Clamped on-screen x (-1..1) of a bearing on a compass strip spanning `fovDeg`. */
export function compassX(bearing: number, fovDeg = 120): number {
  return Math.min(1, Math.max(-1, bearing / (fovDeg / 2)));
}

export interface TowerPoint {
  readonly id: number;
  readonly x: number;
  readonly z: number;
}

/** Id of the nearest tower (horizontal distance) that is not active, or null. */
export function nearestInactive(
  towers: readonly TowerPoint[],
  active: ReadonlySet<number>,
  px: number,
  pz: number,
): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const t of towers) {
    if (active.has(t.id)) continue;
    const d = (t.x - px) ** 2 + (t.z - pz) ** 2;
    if (d < bestD) {
      bestD = d;
      best = t.id;
    }
  }
  return best;
}

/** Human label for a `KeyboardEvent.code` / `MouseN` binding code. */
export function codeLabel(code: string): string {
  if (code.startsWith('Mouse')) {
    const names = ['LMB', 'MMB', 'RMB'];
    const n = Number(code.slice(5));
    return names[n] ?? `Mouse ${n + 1}`;
  }
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.endsWith('Left') && code.startsWith('Shift')) return 'L-Shift';
  if (code.endsWith('Right') && code.startsWith('Shift')) return 'R-Shift';
  if (code === 'Backquote') return '`';
  return code;
}
