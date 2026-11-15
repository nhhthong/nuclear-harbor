import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, pickGuardTowers, seedFromParams } from './guards';

describe('guards', () => {
  it('is deterministic for a seed', () => {
    expect(pickGuardTowers(hashSeed('7'), 4, 2)).toEqual(pickGuardTowers(hashSeed('7'), 4, 2));
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a()]).toEqual([b(), b()]);
  });

  it('picks distinct indices in range', () => {
    for (let s = 0; s < 200; s++) {
      const p = pickGuardTowers(s, 4, 2);
      expect(p).toHaveLength(2);
      expect(new Set(p).size).toBe(2);
      for (const i of p) expect(i >= 0 && i < 4).toBe(true);
    }
  });

  it('varies with the seed and covers every tower', () => {
    const seen = new Set<number>();
    const pairs = new Set<string>();
    for (let s = 0; s < 200; s++) {
      const p = pickGuardTowers(s, 4, 2);
      pairs.add([...p].sort().join(','));
      for (const i of p) seen.add(i);
    }
    expect(seen.size).toBe(4);
    expect(pairs.size).toBeGreaterThan(3);
  });

  it('clamps count to the total', () => {
    expect(pickGuardTowers(1, 2, 5)).toHaveLength(2);
  });

  it('reads ?seed= (numbers and strings) and falls back to the clock value', () => {
    expect(seedFromParams(new URLSearchParams('seed=42'), 1)).toBe(42);
    expect(seedFromParams(new URLSearchParams('seed=abc'), 1)).toBe(hashSeed('abc'));
    expect(seedFromParams(new URLSearchParams(''), 99)).toBe(99);
  });
});
