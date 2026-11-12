import { describe, expect, it } from 'vitest';
import { NuclearCountdown } from './NuclearCountdown';

describe('NuclearCountdown', () => {
  it('emits one tick per whole second', () => {
    const c = new NuclearCountdown(10, 5);
    let ticks = 0;
    for (let i = 0; i < 60 * 3; i++) ticks += c.step(1 / 60).ticks.length;
    expect(ticks).toBe(3);
    expect(c.remaining).toBeCloseTo(7, 5);
  });

  it('flags critical below the threshold', () => {
    const c = new NuclearCountdown(6, 5);
    const all = c.step(2).ticks;
    expect(all.map((t) => t.remaining)).toEqual([5, 4]);
    expect(all.map((t) => t.critical)).toEqual([false, true]);
    expect(c.critical).toBe(true);
  });

  it('expires exactly once and never goes negative', () => {
    const c = new NuclearCountdown(1, 5);
    const a = c.step(5);
    const b = c.step(5);
    expect(a.expired).toBe(true);
    expect(b.expired).toBe(false);
    expect(c.remaining).toBe(0);
    expect(c.isExpired).toBe(true);
  });

  it('stop() halts ticking and expiry', () => {
    const c = new NuclearCountdown(3, 1);
    c.stop();
    const s = c.step(10);
    expect(s.ticks).toHaveLength(0);
    expect(s.expired).toBe(false);
    expect(c.remaining).toBe(3);
  });

  it('does not advance when dt is zero (paused)', () => {
    const c = new NuclearCountdown(3, 1);
    c.step(0);
    expect(c.remaining).toBe(3);
  });

  it('setRemaining works', () => {
    const c = new NuclearCountdown(100, 10);
    c.setRemaining(2);
    expect(c.step(1.5).ticks.map((t) => t.remaining)).toEqual([1]);
  });
});
