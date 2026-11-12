import { describe, expect, it } from 'vitest';
import { VoiceAllocator, type VoiceLimits } from './voiceAllocator';

const LIMITS: Record<string, VoiceLimits> = {
  shot: { priority: 5, maxInstances: 6, cooldownMs: 50 },
  step: { priority: 1, maxInstances: 3, cooldownMs: 0 },
  boom: { priority: 9, maxInstances: 2, cooldownMs: 0 },
  once: { priority: 5, maxInstances: 1, cooldownMs: 0 },
};
const make = (cap: number) => new VoiceAllocator<string>(cap, (id) => LIMITS[id] ?? LIMITS.step!);

describe('VoiceAllocator', () => {
  it('rate-limits a sound with its cooldown', () => {
    const a = make(24);
    expect(a.acquire('shot', 0).granted).toBe(true);
    expect(a.acquire('shot', 10)).toEqual({ granted: false, reason: 'cooldown' });
    expect(a.acquire('shot', 60).granted).toBe(true);
    expect(a.playedCount('shot')).toBe(2);
  });

  it('steals the oldest instance when maxInstances is reached', () => {
    const a = make(24);
    const first = a.acquire('once', 0);
    const second = a.acquire('once', 1);
    expect(first.granted && second.granted && second.stolen === first.voiceId).toBe(true);
    expect(a.activeOf('once')).toBe(1);
  });

  it('never exceeds the cap and steals the lowest priority, oldest voice', () => {
    const a = make(3);
    const s1 = a.acquire('step', 0);
    a.acquire('shot', 100);
    a.acquire('boom', 200);
    expect(a.activeCount).toBe(3);
    const r = a.acquire('boom', 300); // cap full: the step (lowest priority) is stolen
    expect(r.granted && s1.granted && r.stolen === s1.voiceId).toBe(true);
    const r2 = a.acquire('once', 400); // next lowest: shot (5), oldest of equals
    expect(r2.granted && r2.stolen !== null).toBe(true);
    expect(a.activeCount).toBe(3);
  });

  it('refuses a low priority sound when only more important voices play', () => {
    const a = make(2);
    a.acquire('boom', 0);
    a.acquire('boom', 1);
    expect(a.acquire('step', 2)).toEqual({ granted: false, reason: 'priority' });
    expect(a.activeCount).toBe(2);
  });

  it('release is idempotent', () => {
    const a = make(4);
    const r = a.acquire('step', 0);
    if (!r.granted) throw new Error('expected grant');
    a.release(r.voiceId);
    a.release(r.voiceId);
    expect(a.activeCount).toBe(0);
  });

  it('rapid fire for 10 s keeps active voices bounded', () => {
    const a = make(24);
    for (let ms = 0; ms < 10_000; ms += 5) {
      a.acquire('shot', ms); // 200 attempts/s, cooldown 50 ms
      a.acquire('step', ms);
      expect(a.activeCount).toBeLessThanOrEqual(24);
    }
    expect(a.peak).toBeLessThanOrEqual(9); // 6 shots + 3 steps
  });
});
