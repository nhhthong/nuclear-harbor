import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { blastDamage, countdownValue, fuseSpent } from './blast';
import { DUCK } from './tunables';

describe('duck blast', () => {
  it('deals the fixed 15 inside the radius and 0 outside', () => {
    expect(blastDamage(0, DUCK.blastRadius, DUCK.blastDamage)).toBe(15);
    expect(blastDamage(DUCK.blastRadius, DUCK.blastRadius, DUCK.blastDamage)).toBe(15);
    expect(blastDamage(DUCK.blastRadius + 0.01, DUCK.blastRadius, DUCK.blastDamage)).toBe(0);
  });

  it('counts 3, 2, 1 with one second each and spends the fuse at 3 s', () => {
    const c = (t: number) => countdownValue(t, DUCK.countdownCount, DUCK.countSeconds);
    expect([c(0), c(0.99), c(1), c(1.5), c(2), c(2.99), c(3)]).toEqual([3, 3, 2, 2, 1, 1, 0]);
    expect(fuseSpent(2.99, DUCK.countdownCount, DUCK.countSeconds)).toBe(false);
    expect(fuseSpent(3, DUCK.countdownCount, DUCK.countSeconds)).toBe(true);
  });

  it('a player walking away from the arming point leaves the radius before the fuse ends (SC-002)', () => {
    const timeToLeave = (DUCK.blastRadius - DUCK.armDistance) / PLAYER.walkSpeed;
    expect(timeToLeave).toBeLessThan(DUCK.countdownCount * DUCK.countSeconds);
  });
});
