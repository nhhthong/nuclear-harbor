import { GLB_VIEW } from './glbTunables';

/** Clip names for each weapon state; `fire` holds every shoot variant. */
export interface ClipMap {
  idle: string | null;
  draw: string | null;
  reload: string | null;
  fire: string[];
}

/** Map converted clip names (`idle`, `draw`, `reload`, `shoot1..n`) to weapon states. */
export function mapClips(names: readonly string[]): ClipMap {
  const lower = names.map((n) => ({ raw: n, key: n.toLowerCase() }));
  const find = (key: string): string | null => lower.find((n) => n.key === key)?.raw ?? null;
  return {
    idle: find('idle'),
    draw: find('draw') ?? find('deploy'),
    reload: find('reload'),
    fire: lower
      .filter((n) => n.key.startsWith('shoot') || n.key.startsWith('fire'))
      .map((n) => n.raw)
      .sort(),
  };
}

/** Round-robin over the shoot variants; null when there are none. */
export function pickFireClip(map: ClipMap, shotCounter: number): string | null {
  if (map.fire.length === 0) return null;
  return map.fire[shotCounter % map.fire.length] ?? null;
}

/** Time scale that makes a reload clip last `targetSeconds`, clamped to sane limits. */
export function reloadTimeScale(clipSeconds: number, targetSeconds: number): number {
  if (!(clipSeconds > 0) || !(targetSeconds > 0)) return 1;
  return Math.min(GLB_VIEW.reloadScaleMax, Math.max(GLB_VIEW.reloadScaleMin, clipSeconds / targetSeconds));
}

/** True when the converted model carries every clip the weapon states need. */
export function hasStateClips(map: ClipMap): boolean {
  return map.idle !== null && map.reload !== null && map.fire.length > 0;
}
