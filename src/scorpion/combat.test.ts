import { describe, expect, it } from 'vitest';
import { arcPosition, fanHit, inPool, ramContact, venomBurstDamage } from './combat';
import { SCORPION } from './tunables';

describe('venom', () => {
  const s = SCORPION.skills.venom;
  it('burst: full damage at the centre, falloff to the edge fraction, zero outside', () => {
    expect(venomBurstDamage(0)).toBe(s.damage);
    expect(venomBurstDamage(s.radius)).toBeCloseTo(s.damage * s.edgeFraction);
    expect(venomBurstDamage(s.radius / 2)).toBeLessThan(s.damage);
    expect(venomBurstDamage(s.radius + 0.1)).toBe(0);
  });
  it('pool: hurts inside the radius at ground level only', () => {
    expect(inPool(s.radius - 0.2, 0)).toBe(true);
    expect(inPool(s.radius + 0.2, 0)).toBe(false);
    expect(inPool(1, s.poolHeight + 0.3)).toBe(false);
  });
  it('glob flies an arc from the stinger to the target', () => {
    const mid = arcPosition(0, 4, 0, 10, 0, 0, 0.5);
    expect(mid.x).toBeCloseTo(5);
    expect(mid.y).toBeCloseTo(2 + s.apex);
    const end = arcPosition(0, 4, 0, 10, 0, 0, 1);
    expect(end.x).toBeCloseTo(10);
    expect(end.y).toBeCloseTo(0);
    expect(arcPosition(0, 4, 0, 10, 0, 0, 0).y).toBeCloseTo(4);
  });
});

describe('fanHit', () => {
  const t = SCORPION.skills.tailSlam;
  it('hits in front inside the radius, misses beside, behind, beyond and above', () => {
    expect(fanHit(t.radius - 0.5, 0, 0)).toBe(true);
    expect(fanHit(3, t.halfAngle - 0.05, 0)).toBe(true);
    expect(fanHit(3, -(t.halfAngle - 0.05), 0)).toBe(true);
    expect(fanHit(3, t.halfAngle + 0.1, 0)).toBe(false);
    expect(fanHit(3, Math.PI, 0)).toBe(false);
    expect(fanHit(t.radius + 0.5, 0, 0)).toBe(false);
    expect(fanHit(3, 0, t.clearance + 0.1)).toBe(false);
    // angles wrap
    expect(fanHit(3, Math.PI * 2 + 0.1, 0)).toBe(true);
  });
});

describe('ramContact', () => {
  it('uses the hit radius horizontally and the height window', () => {
    expect(ramContact(SCORPION.skills.ram.hitRadius - 0.1, 0)).toBe(true);
    expect(ramContact(SCORPION.skills.ram.hitRadius + 0.1, 0)).toBe(false);
    expect(ramContact(1, SCORPION.ramHeight + 1)).toBe(false);
  });
});
