import { describe, expect, it } from 'vitest';
import {
  ammoText,
  bearingDeg,
  codeLabel,
  compassX,
  formatCountdown,
  hpRatio,
  nearestInactive,
  relativeBearingDeg,
} from './format';

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(1200)).toBe('20:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(59.2)).toBe('01:00');
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-3)).toBe('00:00');
  });
});

describe('ammoText / hpRatio', () => {
  it('formats ammo', () => expect(ammoText(12, 180)).toBe('12 / 180'));
  it('clamps hp ratio', () => {
    expect(hpRatio(50, 100)).toBe(0.5);
    expect(hpRatio(-5, 100)).toBe(0);
    expect(hpRatio(150, 100)).toBe(1);
    expect(hpRatio(10, 0)).toBe(0);
  });
});

describe('bearingDeg (yaw 0 looks along -Z, right = +X)', () => {
  it('ahead', () => expect(bearingDeg(0, 0, 0, -10, 0)).toBeCloseTo(0));
  it('right', () => expect(bearingDeg(0, 0, 10, 0, 0)).toBeCloseTo(90));
  it('left', () => expect(bearingDeg(0, 0, -10, 0, 0)).toBeCloseTo(-90));
  it('behind', () => expect(Math.abs(bearingDeg(0, 0, 0, 10, 0))).toBeCloseTo(180));
  it('accounts for yaw (positive yaw turns left)', () => {
    // facing -X after yaw = +90deg; a target at -X is ahead
    expect(bearingDeg(0, 0, -10, 0, Math.PI / 2)).toBeCloseTo(0);
    // target at -Z is then on the right
    expect(bearingDeg(0, 0, 0, -10, Math.PI / 2)).toBeCloseTo(90);
  });
  it('relativeBearingDeg matches', () => expect(relativeBearingDeg(5, 0, 0)).toBeCloseTo(90));
});

describe('compassX', () => {
  it('maps and clamps', () => {
    expect(compassX(0)).toBe(0);
    expect(compassX(30, 120)).toBeCloseTo(0.5);
    expect(compassX(-30, 120)).toBeCloseTo(-0.5);
    expect(compassX(170, 120)).toBe(1);
    expect(compassX(-180, 120)).toBe(-1);
  });
});

describe('nearestInactive', () => {
  const towers = [
    { id: 0, x: 0, z: -10 },
    { id: 1, x: 50, z: 0 },
    { id: 2, x: -5, z: 5 },
  ];
  it('picks the nearest inactive tower', () => {
    expect(nearestInactive(towers, new Set(), 0, 0)).toBe(2);
    expect(nearestInactive(towers, new Set([2]), 0, 0)).toBe(0);
    expect(nearestInactive(towers, new Set([0, 2]), 0, 0)).toBe(1);
  });
  it('returns null when all are active', () => {
    expect(nearestInactive(towers, new Set([0, 1, 2]), 0, 0)).toBeNull();
    expect(nearestInactive([], new Set(), 0, 0)).toBeNull();
  });
});

describe('codeLabel', () => {
  it('humanises codes', () => {
    expect(codeLabel('KeyW')).toBe('W');
    expect(codeLabel('Mouse0')).toBe('LMB');
    expect(codeLabel('Mouse2')).toBe('RMB');
    expect(codeLabel('Space')).toBe('Space');
    expect(codeLabel('ArrowUp')).toBe('Up');
    expect(codeLabel('ShiftLeft')).toBe('L-Shift');
    expect(codeLabel('Digit3')).toBe('3');
  });
});
