import { describe, expect, it } from 'vitest';
import { SPHERE_ROBOT } from '@/config/tunables';
import { decideSphere, type SphereBrainInput } from './sphereBrain';

function input(over: Partial<SphereBrainInput> = {}): SphereBrainInput {
  return {
    state: 'patrol',
    timeInState: 0,
    distance: 50,
    hasLos: false,
    timeSinceSeen: Infinity,
    hpFraction: 1,
    hasRetreated: false,
    commanded: false,
    commandArrived: false,
    playerAlive: true,
    ...over,
  };
}

describe('decideSphere', () => {
  it('stays on patrol with nothing in range', () => {
    expect(decideSphere(input())).toBe('patrol');
  });

  it('detects at 25 m with line of sight, not beyond and not without LOS', () => {
    const d = SPHERE_ROBOT.detectionRange;
    expect(decideSphere(input({ distance: d - 1, hasLos: true }))).toBe('chase');
    expect(decideSphere(input({ distance: d + 1, hasLos: true }))).toBe('patrol');
    expect(decideSphere(input({ distance: d - 1, hasLos: false }))).toBe('patrol');
  });

  it('chases into attack within 20 m with LOS, and back to chase when LOS is lost', () => {
    const a = SPHERE_ROBOT.attackRange;
    expect(decideSphere(input({ state: 'chase', distance: a - 1, hasLos: true, timeSinceSeen: 0 }))).toBe('attack');
    expect(decideSphere(input({ state: 'chase', distance: a + 2, hasLos: true, timeSinceSeen: 0 }))).toBe('chase');
    expect(decideSphere(input({ state: 'attack', distance: a - 1, hasLos: false, timeSinceSeen: 1 }))).toBe('chase');
  });

  it('loses the target after loseTargetTime without LOS and returns to patrol', () => {
    expect(
      decideSphere(input({ state: 'chase', hasLos: false, timeSinceSeen: SPHERE_ROBOT.loseTargetTime - 0.5 })),
    ).toBe('chase');
    expect(
      decideSphere(input({ state: 'chase', hasLos: false, timeSinceSeen: SPHERE_ROBOT.loseTargetTime + 0.1 })),
    ).toBe('patrol');
  });

  it('retreats once below 25% HP, then returns to the fight', () => {
    const hurt = input({ state: 'attack', distance: 10, hasLos: true, timeSinceSeen: 0, hpFraction: 0.2 });
    expect(decideSphere(hurt)).toBe('retreat');
    expect(decideSphere({ ...hurt, state: 'retreat', timeInState: 1 })).toBe('retreat');
    expect(decideSphere({ ...hurt, state: 'retreat', timeInState: 10 })).toBe('chase');
    expect(decideSphere({ ...hurt, hasRetreated: true })).toBe('attack');
  });

  it('destroyed is terminal', () => {
    expect(decideSphere(input({ state: 'destroyed', hasLos: true, distance: 3 }))).toBe('destroyed');
  });

  it('commanded robots move out of patrol and hold when arrived', () => {
    expect(decideSphere(input({ commanded: true }))).toBe('chase');
    expect(decideSphere(input({ state: 'chase', commanded: true, commandArrived: true }))).toBe('patrol');
    expect(decideSphere(input({ state: 'chase', commanded: true, commandArrived: false }))).toBe('chase');
  });

  it('ignores a dead player', () => {
    expect(decideSphere(input({ distance: 5, hasLos: true, playerAlive: false }))).toBe('patrol');
  });
});
