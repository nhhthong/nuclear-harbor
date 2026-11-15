import { describe, expect, it } from 'vitest';
import { ADS, CAMERA, PLAYER } from '@/config/tunables';
import { aimFovDeg, aimScale, aimSensitivityScale, stepAim } from './ads';

describe('ads helpers', () => {
  it('reaches the target and never overshoots', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) {
      a = stepAim(a, 1, 1 / 60);
      expect(a).toBeLessThanOrEqual(1);
    }
    expect(a).toBe(1);
    for (let i = 0; i < 60; i++) a = stepAim(a, 0, 1 / 60);
    expect(a).toBe(0);
  });
  it('is mostly there after 0.2 s', () => {
    let a = 0;
    for (let i = 0; i < 12; i++) a = stepAim(a, 1, 1 / 60);
    expect(a).toBeGreaterThan(0.9);
  });
  it('blends FOV and sensitivity', () => {
    expect(aimFovDeg(0)).toBe(CAMERA.fovDeg);
    expect(aimFovDeg(1)).toBe(ADS.fovDeg);
    expect(aimSensitivityScale(0)).toBeCloseTo(1);
    expect(aimSensitivityScale(1)).toBeLessThan(1);
    expect(aimSensitivityScale(1)).toBeGreaterThan(0.5);
  });
  it('scales values linearly', () => {
    expect(aimScale(0.5, 0)).toBe(1);
    expect(aimScale(0.5, 1)).toBe(0.5);
    expect(aimScale(0.5, 0.5)).toBe(0.75);
  });
});

describe('player gravity', () => {
  it('keeps the intended jump heights', () => {
    const g = -PLAYER.gravity;
    expect((PLAYER.jumpSpeed ** 2) / (2 * g)).toBeGreaterThan(3.8);
    expect((PLAYER.jumpSpeed ** 2) / (2 * g)).toBeLessThan(4.0);
    expect((PLAYER.airJumpSpeed ** 2) / (2 * g)).toBeGreaterThan(3.2);
    expect((PLAYER.airJumpSpeed ** 2) / (2 * g)).toBeLessThan(3.4);
    // two-high stack (5.2 m) reachable with a chained air jump, three-high (7.8 m) not
    expect((PLAYER.jumpSpeed ** 2 + PLAYER.airJumpSpeed ** 2) / (2 * g)).toBeGreaterThan(5.2);
    expect((PLAYER.jumpSpeed ** 2 + PLAYER.airJumpSpeed ** 2) / (2 * g)).toBeLessThan(7.8);
  });
});
