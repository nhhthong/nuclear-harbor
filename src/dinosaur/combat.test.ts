import { describe, expect, it } from 'vitest';
import { angleInSweep, leapPosition, ramContact, stompDamage, tailRingHit } from './combat';
import { DINO } from './tunables';

describe('stompDamage', () => {
  const s = DINO.skills.leapStomp;
  it('full damage at the centre, falloff to the edge fraction, zero outside', () => {
    expect(stompDamage(0)).toBe(s.damage);
    expect(stompDamage(s.radius)).toBeCloseTo(s.damage * s.edgeFraction);
    expect(stompDamage(s.radius / 2)).toBeLessThan(s.damage);
    expect(stompDamage(s.radius / 2)).toBeGreaterThan(s.damage * s.edgeFraction);
    expect(stompDamage(s.radius + 0.1)).toBe(0);
  });
});

describe('tailRingHit', () => {
  const r = DINO.skills.tailSpin.radius;
  it('hits inside the ring at ground level only', () => {
    expect(tailRingHit(r - 0.5, 0)).toBe(true);
    expect(tailRingHit(r + 0.5, 0)).toBe(false);
    expect(tailRingHit(3, DINO.skills.tailSpin.clearance + 0.1)).toBe(false);
  });
});

describe('angleInSweep', () => {
  it('detects a bearing crossed during the tick, with wrap-around', () => {
    expect(angleInSweep(0.0, 0.4, 0.3, 0.1)).toBe(true);
    expect(angleInSweep(0.0, 0.4, 2.0, 0.1)).toBe(false);
    expect(angleInSweep(6.0, 6.5, 0.1, 0.05)).toBe(true);
  });
});

describe('ramContact', () => {
  it('uses the hit radius horizontally and the height window', () => {
    expect(ramContact(DINO.skills.ram.hitRadius - 0.1, 0)).toBe(true);
    expect(ramContact(DINO.skills.ram.hitRadius + 0.1, 0)).toBe(false);
    expect(ramContact(1, DINO.ramHeight + 1)).toBe(false);
  });
});

describe('leapPosition', () => {
  it('interpolates linearly in xz with a parabolic arc that peaks at the apex', () => {
    const a = leapPosition(0, 0, 0, 10, 0, 0.5);
    expect(a.x).toBeCloseTo(5);
    expect(a.y).toBeCloseTo(DINO.skills.leapStomp.apex);
    const end = leapPosition(0, 0, 0, 10, 0, 1);
    expect(end.x).toBeCloseTo(10);
    expect(end.y).toBeCloseTo(0);
    expect(leapPosition(0, 0, 0, 10, 0, 0).y).toBeCloseTo(0);
  });
});
