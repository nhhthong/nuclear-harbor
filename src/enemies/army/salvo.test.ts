import { describe, expect, it } from 'vitest';
import { abortTelegraph, beginSalvo, createSalvo, glowLevel, stepSalvo, type Salvo } from './salvo';

const cfg = { telegraphTime: 1, shotInterval: 0.5, cooldown: 3 };
const dt = 1 / 60;

function run(seconds: number, s: Salvo): number[] {
  const shots: number[] = [];
  let t = 0;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt;
    if (stepSalvo(s, dt, cfg) > 0) shots.push(t);
  }
  return shots;
}

describe('salvo', () => {
  it('telegraphs for 1 s, then fires N rockets spaced by the interval', () => {
    const s = createSalvo();
    expect(beginSalvo(s, 3)).toBe(true);
    const shots = run(4, s);
    expect(shots).toHaveLength(3);
    expect(shots[0]).toBeGreaterThanOrEqual(1);
    expect(shots[0]).toBeLessThan(1.1);
    expect((shots[1] ?? 0) - (shots[0] ?? 0)).toBeCloseTo(0.5, 1);
  });

  it('keeps a cooldown of 3 s after the last rocket before a new salvo can start', () => {
    const s = createSalvo();
    beginSalvo(s, 2);
    const shots = run(1.6, s);
    expect(shots).toHaveLength(2);
    expect(s.phase).toBe('cooldown');
    expect(beginSalvo(s, 2)).toBe(false);
    run(2.8, s);
    expect(s.phase).toBe('cooldown');
    run(0.4, s);
    expect(s.phase).toBe('idle');
  });

  it('only cancels an unfired telegraph', () => {
    const s = createSalvo();
    beginSalvo(s, 2);
    run(0.3, s);
    abortTelegraph(s);
    expect(s.phase).toBe('idle');
    beginSalvo(s, 2);
    run(1.1, s);
    abortTelegraph(s);
    expect(['firing', 'cooldown']).toContain(s.phase);
  });

  it('glows up during the telegraph', () => {
    const s = createSalvo();
    beginSalvo(s, 2);
    run(0.5, s);
    expect(glowLevel(s, cfg)).toBeGreaterThan(0.4);
    expect(glowLevel(s, cfg)).toBeLessThan(0.6);
    expect(glowLevel(createSalvo(), cfg)).toBe(0);
  });
});
