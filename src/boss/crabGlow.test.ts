import { DoubleSide, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { prepareGlowMaterial } from './CrabBody';
import { CRAB } from './tunables';

describe('crab skill glow', () => {
  it('multiplies the glow by the paint (emissive map = base colour map) instead of a flat wash', () => {
    const map = new Texture();
    const m = new MeshStandardMaterial({ map });
    expect(m.emissiveMap).toBeNull();
    expect(prepareGlowMaterial(m)).toBe(true);
    expect(m.emissiveMap).toBe(map);
    expect(m.emissiveIntensity).toBe(0);
    expect(m.emissive.r).toBeCloseTo(CRAB.glow.colour[0], 6);
    expect(m.emissive.g).toBeCloseTo(CRAB.glow.colour[1], 6);
  });

  it('draws both sides, so raised arms seen from below are not hollow', () => {
    const m = new MeshStandardMaterial();
    prepareGlowMaterial(m);
    expect(m.side).toBe(DoubleSide);
  });

  it('keeps an existing emissive map and copes with an untextured material', () => {
    const own = new Texture();
    const a = new MeshStandardMaterial({ map: new Texture(), emissiveMap: own });
    prepareGlowMaterial(a);
    expect(a.emissiveMap).toBe(own);
    const b = new MeshStandardMaterial({ color: 0xff0000 });
    expect(prepareGlowMaterial(b)).toBe(true);
    expect(b.emissiveMap).toBeNull();
  });

  it('the peak stays modest so a charged body is lit, not white', () => {
    expect(CRAB.glow.max).toBeLessThanOrEqual(1.5);
    expect(CRAB.glow.colour[2]).toBeLessThan(CRAB.glow.colour[0]);
  });
});
