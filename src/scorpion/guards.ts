/** Seeded RNG and the choice of the guarded towers (pure). */

/** Mulberry32: tiny deterministic generator, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to an unsigned 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** `?seed=` as integer when numeric, hashed otherwise; `fallback` (e.g. the clock) when absent. */
export function seedFromParams(params: URLSearchParams, fallback: number): number {
  const raw = params.get('seed');
  if (raw === null || raw === '') return fallback >>> 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n >>> 0 : hashSeed(raw);
}

/** `count` distinct indices out of `total` (partial Fisher-Yates), deterministic for the seed. */
export function pickGuardTowers(seed: number, total: number, count: number): number[] {
  const rng = mulberry32(seed);
  const pool = Array.from({ length: total }, (_, i) => i);
  const n = Math.min(count, total);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (total - i));
    const tmp = pool[i] as number;
    pool[i] = pool[j] as number;
    pool[j] = tmp;
  }
  return pool.slice(0, n);
}
