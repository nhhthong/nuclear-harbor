import { describe, expect, it } from 'vitest';
import { canSkip, cinematicFrame, newCinematicFrame } from './cinematic';
import { BOSS_LOCAL } from './tunables';

const c = BOSS_LOCAL.cinematic;
const at = (t: number) => cinematicFrame(t, newCinematicFrame());

describe('cinematic timeline', () => {
  it('lasts about 6 s', () => {
    expect(c.duration).toBeGreaterThanOrEqual(5.5);
    expect(c.duration).toBeLessThanOrEqual(7);
  });

  it('starts in the sky with no bars and ends released', () => {
    const f = at(0);
    expect(f.stage).toBe('sky');
    expect(f.height).toBe(1);
    expect(f.bars).toBe(0);
    expect(at(c.duration).stage).toBe('release');
    expect(at(c.duration).bars).toBe(0);
  });

  it('falls with increasing speed and lands exactly at the impact time', () => {
    const h = [0.3, 1.2, 2.2, 3.2].map((s) => at(c.descentStart + s).height);
    for (let i = 1; i < h.length; i++) expect(h[i]!).toBeLessThan(h[i - 1]!);
    expect(at(c.impactAt - 0.01).height).toBeGreaterThan(0);
    expect(at(c.impactAt).height).toBe(0);
    expect(at(c.impactAt).impacted).toBe(true);
    expect(at(c.impactAt - 0.2).speed).toBeGreaterThan(at(c.descentStart + 0.5).speed);
  });

  it('shakes hard at the impact and decays; title appears after it', () => {
    expect(at(c.impactAt).shake).toBeCloseTo(1, 5);
    expect(at(c.impactAt + 2).shake).toBeLessThan(0.1);
    expect(at(c.impactAt + 0.05).title).toBe(0);
    expect(at(c.impactAt + 1.2).title).toBe(1);
    expect(at(c.impactAt + 1.2).stage).toBe('title');
  });

  it('bars are full in the middle; skip only after the delay', () => {
    expect(at(c.duration / 2).bars).toBe(1);
    expect(canSkip(c.skipAfter - 0.01)).toBe(false);
    expect(canSkip(c.skipAfter)).toBe(true);
  });
});
