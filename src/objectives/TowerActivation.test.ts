import { describe, expect, it } from 'vitest';
import { TowerActivation } from './TowerActivation';

const hold = { inRange: true, holding: true, playerAlive: true };

describe('TowerActivation', () => {
  it('starts once, progresses and activates after the hold time', () => {
    const t = new TowerActivation(5, true);
    let started = 0;
    let activated = 0;
    for (let i = 0; i < 60 * 5 + 2; i++) {
      const r = t.step(1 / 60, hold);
      if (r.started) started++;
      if (r.activated) activated++;
    }
    expect(started).toBe(1);
    expect(activated).toBe(1);
    expect(t.isActivated).toBe(true);
  });

  it('cancels with the correct reason and resets progress', () => {
    const cases = [
      [{ inRange: true, holding: false, playerAlive: true }, 'released'],
      [{ inRange: false, holding: true, playerAlive: true }, 'left-range'],
      [{ inRange: true, holding: true, playerAlive: false }, 'died'],
    ] as const;
    for (const [input, reason] of cases) {
      const t = new TowerActivation(5, true);
      t.step(3, hold);
      expect(t.progress).toBeCloseTo(0.6);
      const r = t.step(1 / 60, input);
      expect(r.cancelled).toBe(reason);
      expect(t.progress).toBe(0);
      expect(t.step(1 / 60, input).cancelled).toBeNull();
    }
  });

  it('ignores input once activated', () => {
    const t = new TowerActivation(1, true);
    t.step(2, hold);
    const r = t.step(1, { inRange: false, holding: false, playerAlive: false });
    expect(r.cancelled).toBeNull();
    expect(r.activated).toBe(false);
    expect(t.progress).toBe(1);
    expect(t.step(1, hold).started).toBe(false);
  });

  it('decays when reset is not instant', () => {
    const t = new TowerActivation(10, false, 0.1);
    t.step(5, hold);
    t.step(1, { ...hold, holding: false });
    expect(t.progress).toBeCloseTo(0.4);
  });

  it('forceActivate completes the tower', () => {
    const t = new TowerActivation(5, true);
    t.forceActivate();
    expect(t.isActivated).toBe(true);
  });
});
