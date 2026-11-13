import { describe, expect, it } from 'vitest';
import { angleDiff, stepMotion, type Motion } from './motion';

const lim = { accel: 2, decel: 4, turnRate: 1 };

describe('stepMotion', () => {
  it('accelerates gradually, never snapping to the target speed', () => {
    const m: Motion = { speed: 0, yaw: 0 };
    stepMotion(m, 3, 0, 1 / 60, lim);
    expect(m.speed).toBeCloseTo(2 / 60, 6);
    for (let i = 0; i < 60; i++) stepMotion(m, 3, 0, 1 / 60, lim);
    expect(m.speed).toBeGreaterThan(1.9);
    expect(m.speed).toBeLessThan(2.2);
  });

  it('decelerates faster than it accelerates and stops', () => {
    const m: Motion = { speed: 3, yaw: 0 };
    for (let i = 0; i < 30; i++) stepMotion(m, 0, 0, 1 / 60, lim);
    expect(m.speed).toBeCloseTo(3 - 4 * 0.5, 5);
    for (let i = 0; i < 60; i++) stepMotion(m, 0, 0, 1 / 60, lim);
    expect(m.speed).toBe(0);
  });

  it('limits the turn rate (180 degrees needs at least PI / turnRate seconds)', () => {
    const m: Motion = { speed: 0, yaw: 0 };
    let t = 0;
    let prev = m.yaw;
    while (Math.abs(angleDiff(m.yaw, Math.PI)) > 1e-6 && t < 10) {
      stepMotion(m, 0, Math.PI, 1 / 60, lim);
      expect(Math.abs(angleDiff(prev, m.yaw))).toBeLessThanOrEqual(lim.turnRate / 60 + 1e-9);
      prev = m.yaw;
      t += 1 / 60;
    }
    expect(t).toBeGreaterThanOrEqual(Math.PI / lim.turnRate - 0.05);
  });

  it('turns before it walks when facing the wrong way', () => {
    const m: Motion = { speed: 0, yaw: 0 };
    for (let i = 0; i < 30; i++) stepMotion(m, 3, Math.PI, 1 / 60, lim);
    expect(m.speed).toBe(0);
  });

  it('does not gate the speed by heading when strafing or backing off', () => {
    const m: Motion = { speed: 0, yaw: 0 };
    for (let i = 0; i < 30; i++) stepMotion(m, 3, Math.PI, 1 / 60, lim, false);
    expect(m.speed).toBeGreaterThan(0.9);
  });

  it('takes the shortest way round', () => {
    expect(angleDiff(3, -3)).toBeCloseTo(2 * Math.PI - 6, 6);
  });
});
