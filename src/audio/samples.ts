import type { SoundId } from './catalogue';

/**
 * Spec 32: recorded samples layered over the procedural recipes. Each entry maps a catalogue id to
 * one or more OGG variants in `public/assets/audio/` (built by `tools/asset-pipeline/audio.sh`).
 * A request plays one random variant with slight pitch and gain variation; when the file is missing,
 * still loading or failed to decode, the procedural recipe in `sounds.ts` plays instead.
 */
export interface SampleDef {
  /** File names under `SAMPLE_BASE_URL`; one is picked per play. */
  readonly files: readonly string[];
  /** Linear gain applied to the sample (on top of the request intensity). */
  readonly gain: number;
  /** Random playback-rate variation, +- fraction. */
  readonly pitchJitter: number;
  /** Random gain variation, +- fraction. */
  readonly gainJitter: number;
  /** Seconds skipped at the start of the file. */
  readonly offset?: number;
}

/** Looping beds (not catalogue one-shots): low-health heartbeat and breathing, ambience layers. */
export interface LoopDef {
  readonly file: string;
  readonly gain: number;
}

/** Same-origin relative URL, like the GLBs (works under the GitHub Pages sub-path and offline). */
export const SAMPLE_BASE_URL = 'assets/audio/';

/** Total bytes of `public/assets/audio` allowed for wave 1 (checked by a test). */
export const AUDIO_BYTES_BUDGET = 3 * 1024 * 1024;

const v = (prefix: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${prefix}_${i + 1}.ogg`);

const s = (files: string | readonly string[], gain = 1, pitchJitter = 0.04, gainJitter = 0.1, offset?: number): SampleDef => ({
  files: typeof files === 'string' ? [files] : files,
  gain,
  pitchJitter,
  gainJitter,
  ...(offset === undefined ? {} : { offset }),
});

export const SAMPLE_MANIFEST: Partial<Record<SoundId, SampleDef>> = {
  // weapon
  rifleShot: s(v('rifle_shot', 4), 0.85, 0.035, 0.08),
  dryClick: s('dry_click.ogg', 0.7, 0.03),
  reloadMagOut: s('reload_mag_out.ogg', 0.8, 0.03),
  reloadMagIn: s('reload_mag_in.ogg', 0.85, 0.03),
  reloadBolt: s('reload_bolt.ogg', 0.85, 0.03),
  shellCasing: s(v('shell_casing', 3), 0.35, 0.08, 0.2),
  // impacts
  impactMetal: s(v('impact_metal', 4), 0.55, 0.08, 0.15),
  impactConcrete: s(v('impact_concrete', 3), 0.7, 0.08, 0.15),
  hitArmor: s(v('hit_armor', 3), 0.6, 0.06, 0.12),
  // player
  footstepWalk: s(v('step_concrete', 6), 0.45, 0.06, 0.15),
  footstepSprint: s(v('step_concrete', 6), 0.6, 0.06, 0.15),
  footstepMetal: s(v('step_metal', 6), 0.5, 0.06, 0.15),
  pickupAmmo: s('pickup_ammo.ogg', 0.8, 0.03),
  pickupMedkit: s('pickup_medkit.ogg', 0.7, 0.02),
  hitMarker: s('hit_marker.ogg', 0.6, 0.05),
  // enemies and boss
  enemyShot: s(v('enemy_laser', 3), 0.55, 0.06, 0.1),
  enemyDestroyed: s(v('explosion_robot', 3), 0.9, 0.06, 0.1),
  duckHit: s(v('explosion_bang', 3), 1, 0.05, 0.1),
  bossMissile: s(v('explosion_bang', 3), 0.9, 0.08, 0.1),
  bossCannon: s(v('boss_cannon', 2), 1, 0.04, 0.08),
  bossSlam: s('boss_stomp.ogg', 1, 0.05, 0.1),
  bossEmp: s('boss_laser.ogg', 0.8, 0.05, 0.1),
  bossDefeat: s('boss_defeat.ogg', 1, 0.02, 0.05),
};

export const LOOPS = {
  heartbeat: { file: 'heartbeat_loop.ogg', gain: 0.9 },
  breath: { file: 'breath_loop.ogg', gain: 0.55 },
  wind: { file: 'amb_wind_loop.ogg', gain: 0.55 },
  sea: { file: 'amb_sea_loop.ogg', gain: 0.6 },
} as const satisfies Record<string, LoopDef>;

export type LoopId = keyof typeof LOOPS;

/** Every file the manifest and the loops reference (unique, stable order). */
export function sampleFiles(): string[] {
  const set = new Set<string>();
  for (const def of Object.values(SAMPLE_MANIFEST)) for (const f of def?.files ?? []) set.add(f);
  for (const l of Object.values(LOOPS)) set.add(l.file);
  return [...set];
}

export interface SamplePick {
  file: string;
  /** Playback rate (pitch). */
  rate: number;
  /** Linear gain. */
  gain: number;
}

/**
 * Pick one variant and its rate/gain. `rng` returns [0, 1). With more than one variant the previous
 * pick (`last`) is avoided so the same file never plays twice in a row. `ready` filters out files
 * that are not decoded yet; returns null when none is usable (the caller falls back to the recipe).
 */
export function pickSample(
  def: SampleDef,
  rng: () => number,
  intensity = 1,
  last?: string,
  ready: (file: string) => boolean = () => true,
): SamplePick | null {
  let pool = def.files.filter(ready);
  if (pool.length === 0) return null;
  if (pool.length > 1 && last !== undefined) {
    const others = pool.filter((f) => f !== last);
    if (others.length > 0) pool = others;
  }
  const file = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;
  const rate = 1 + (rng() * 2 - 1) * def.pitchJitter;
  const gain = Math.max(0, def.gain * intensity * (1 + (rng() * 2 - 1) * def.gainJitter));
  return { file, rate, gain };
}

/** Mulberry32: small seeded rng for tests and reproducible picks. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
