import { describe, expect, it } from 'vitest';
import { bossAttackRecipes, hitRecipe, landingScale, reflect } from './mapping';

describe('mapping', () => {
  it('maps hit zones to recipes', () => {
    expect(hitRecipe('body', false)).toBe('spark');
    expect(hitRecipe('critical', false)).toBe('spark');
    expect(hitRecipe('armor', false)).toBe('armor-spark');
    expect(hitRecipe('body', true)).toBe('armor-spark');
    expect(hitRecipe('weakpoint', false)).toBe('weakpoint-burst');
    expect(hitRecipe('core', true)).toBe('weakpoint-burst');
  });

  it('reflects about the normal', () => {
    const out = { x: 0, y: 0, z: 0 };
    reflect(0, -1, -1, 0, 1, 0, out);
    expect(out).toEqual({ x: 0, y: 1, z: -1 });
  });

  it('only hard landings show dust', () => {
    expect(landingScale(3)).toBe(0);
    expect(landingScale(10)).toBeGreaterThan(0);
    expect(landingScale(30)).toBeGreaterThan(landingScale(10));
  });

  it('boss attacks all map to something', () => {
    for (const a of ['heavy-cannon', 'ground-slam', 'missile-barrage', 'shockwave', 'target-lock', 'emp-pulse'] as const) {
      expect(bossAttackRecipes(a).length).toBeGreaterThan(0);
    }
  });
});
