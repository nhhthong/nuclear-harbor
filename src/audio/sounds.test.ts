import { describe, expect, it } from 'vitest';
import { SOUND_DEFS, SOUND_IDS } from './catalogue';
import { SOUNDS } from './sounds';
import type { NoiseSpec, OscSpec, Synth } from './synth';

class Recorder implements Synth {
  readonly t = 0;
  readonly oscs: OscSpec[] = [];
  readonly noises: NoiseSpec[] = [];
  stopTime = 0;
  constructor(
    readonly duration = 0,
    readonly variant = 0,
    readonly intensity = 1,
    readonly pitch = 1,
  ) {}
  osc(spec: OscSpec): void {
    this.oscs.push(spec);
    this.stopTime = Math.max(this.stopTime, (spec.at ?? 0) + spec.dur);
  }
  noise(spec: NoiseSpec): void {
    this.noises.push(spec);
    this.stopTime = Math.max(this.stopTime, (spec.at ?? 0) + spec.dur);
  }
}

describe('sound recipes', () => {
  it('has a recipe for every catalogue id and no extras', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual([...SOUND_IDS].sort());
  });

  it.each(SOUND_IDS)('%s produces sources with finite, positive timings', (id) => {
    const r = new Recorder(1.5, 2, 1);
    const stop = SOUNDS[id](r);
    expect(r.oscs.length + r.noises.length).toBeGreaterThan(0);
    expect(stop).toBeGreaterThan(0);
    for (const s of [...r.oscs, ...r.noises]) {
      expect(s.dur).toBeGreaterThan(0);
      expect(s.gain).toBeGreaterThan(0);
      expect(Number.isFinite(s.gain)).toBe(true);
    }
  });

  it('catalogue entries are sane', () => {
    for (const id of SOUND_IDS) {
      const d = SOUND_DEFS[id];
      expect(d.maxInstances).toBeGreaterThan(0);
      expect(d.cooldownMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('duck wind-up lasts the telegraph duration and rises (AC7)', () => {
    for (const duration of [0.8, 1.2, 2]) {
      const r = new Recorder(duration);
      expect(SOUNDS.duckWindup(r)).toBeCloseTo(duration, 5);
      const growl = r.oscs.filter((o) => o.type === 'sawtooth');
      expect(growl.length).toBeGreaterThan(0);
      for (const o of growl) expect(o.f1!).toBeGreaterThan(o.f0);
    }
  });

  it('duck wind-up is lower and longer than the other enemy sounds', () => {
    const windup = new Recorder(1.2);
    SOUNDS.duckWindup(windup);
    const windupTop = Math.max(...windup.oscs.map((o) => Math.max(o.f0, o.f1 ?? 0)));
    for (const id of ['enemyAlert', 'enemyShot'] as const) {
      for (const variant of [0, 1, 2]) {
        const other = new Recorder(0, variant);
        const stop = SOUNDS[id](other);
        expect(stop).toBeLessThan(1.2);
        const otherLow = Math.min(...other.oscs.map((o) => o.f0), Infinity);
        if (Number.isFinite(otherLow) && variant !== 2) expect(otherLow).toBeGreaterThan(windupTop);
      }
    }
  });

  it('reload plays two clicks and ends near the reload duration', () => {
    const r = new Recorder(2);
    const stop = SOUNDS.reload(r);
    expect(r.noises.length).toBe(2);
    expect(stop).toBeLessThanOrEqual(2);
    expect(stop).toBeGreaterThan(1.7);
  });

  it('boss telegraph differs per attack variant', () => {
    const f = new Set<number>();
    for (let v = 0; v < 6; v++) {
      const r = new Recorder(1.5, v);
      SOUNDS.bossTelegraph(r);
      f.add(r.oscs[0]!.f0);
    }
    expect(f.size).toBe(6);
  });
});
