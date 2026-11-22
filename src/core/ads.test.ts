import { describe, expect, it } from 'vitest';
import { ADS, CAMERA, PLAYER, WORLD } from '@/config/tunables';
import { BIPED } from '@/enemies/biped/tunables';
import { CRAB } from '@/boss/tunables';
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
  it('reaches a one-high container top with the double jump (apex = v^2 / 2g)', () => {
    const g = -PLAYER.gravity;
    const single = PLAYER.jumpSpeed ** 2 / (2 * g);
    const air = PLAYER.airJumpSpeed ** 2 / (2 * g);
    expect(single).toBeGreaterThanOrEqual(0.9);
    expect(single).toBeLessThanOrEqual(1.0);
    // chained at the apex of the ground jump
    expect(single + air).toBeGreaterThanOrEqual(WORLD.container.height + 0.4);
    // a two-high stack stays out of reach
    expect(single + air).toBeLessThan(WORLD.container.height * 2);
  });

  it('keeps the enemy dodge thresholds reachable with the double jump', () => {
    const g = -PLAYER.gravity;
    const reach = (PLAYER.jumpSpeed ** 2 + PLAYER.airJumpSpeed ** 2) / (2 * g);
    for (const t of [BIPED.leap.clearance, BIPED.claw.clearance, CRAB.spin.safeHeight, CRAB.laser.top]) {
      expect(t).toBeLessThan(reach - 0.2);
    }
  });
});
