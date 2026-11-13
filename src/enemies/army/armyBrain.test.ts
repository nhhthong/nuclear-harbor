import { describe, expect, it } from 'vitest';
import { ARMY_ROBOT } from '@/config/tunables';
import { decideArmy, engageGoal, radialIntent, type ArmyBrainInput, type ArmyState } from './armyBrain';

const base: ArmyBrainInput = {
  state: 'patrol',
  distance: 100,
  hasLos: false,
  timeSinceSeen: Infinity,
  commanded: false,
  playerAlive: true,
};
const step = (state: ArmyState, over: Partial<ArmyBrainInput>): ArmyState => decideArmy({ ...base, state, ...over });

describe('decideArmy', () => {
  it('detects the player at 30 m with line of sight and advances', () => {
    expect(step('patrol', { distance: ARMY_ROBOT.detectionRange - 0.5, hasLos: true })).toBe('advance');
    expect(step('patrol', { distance: ARMY_ROBOT.detectionRange + 5, hasLos: true })).toBe('patrol');
    expect(step('patrol', { distance: 20, hasLos: false })).toBe('patrol');
  });

  it('engages once inside the firing band with line of sight', () => {
    expect(step('advance', { distance: 28, hasLos: true, timeSinceSeen: 0 })).toBe('advance');
    expect(step('advance', { distance: 24, hasLos: true, timeSinceSeen: 0 })).toBe('engage');
  });

  it('keeps engaging inside the band, falls back to advance when the player is far or hidden', () => {
    expect(step('engage', { distance: 22, hasLos: true, timeSinceSeen: 0 })).toBe('engage');
    expect(step('engage', { distance: 27, hasLos: true, timeSinceSeen: 0 })).toBe('engage'); // hysteresis
    expect(step('engage', { distance: 29, hasLos: true, timeSinceSeen: 0 })).toBe('advance');
    expect(step('engage', { distance: 22, hasLos: false, timeSinceSeen: 1 })).toBe('advance');
  });

  it('retreats when the player is closer than 8 m and leaves retreat with a margin', () => {
    expect(step('engage', { distance: 7, hasLos: true, timeSinceSeen: 0 })).toBe('retreat');
    expect(step('advance', { distance: 5, hasLos: true, timeSinceSeen: 0 })).toBe('retreat');
    expect(step('retreat', { distance: 9, hasLos: true, timeSinceSeen: 0 })).toBe('retreat');
    expect(step('retreat', { distance: 12, hasLos: true, timeSinceSeen: 0 })).toBe('engage');
    expect(step('retreat', { distance: 28, hasLos: true, timeSinceSeen: 0 })).toBe('advance');
  });

  it('forgets the player after the lose time and goes back to patrol', () => {
    expect(step('engage', { distance: 20, hasLos: false, timeSinceSeen: ARMY_ROBOT.loseTargetTime + 1 })).toBe('patrol');
    expect(step('advance', { distance: 20, hasLos: false, timeSinceSeen: ARMY_ROBOT.loseTargetTime + 1, commanded: true })).toBe('advance');
  });

  it('destroyed is terminal and a dead player ends the fight', () => {
    expect(step('destroyed', { distance: 5, hasLos: true })).toBe('destroyed');
    expect(step('engage', { distance: 20, hasLos: true, timeSinceSeen: 0, playerAlive: false })).toBe('patrol');
  });
});

describe('radialIntent / engageGoal', () => {
  it('holds the middle of the band, closes in when far, backs off when near', () => {
    expect(radialIntent(21.5)).toBe(0);
    expect(radialIntent(25)).toBeGreaterThan(0);
    expect(radialIntent(18)).toBeLessThan(0);
  });

  it('strafes around the player and moves radially', () => {
    const out = { x: 0, z: 0 };
    // mech 20 m south of the player (player at origin): sideways is along x
    engageGoal(out, { x: 0, z: 20 }, { x: 0, z: 0 }, 1, 0, 4);
    expect(Math.abs(out.x)).toBeCloseTo(4, 6);
    expect(out.z).toBeCloseTo(20, 6);
    engageGoal(out, { x: 0, z: 20 }, { x: 0, z: 0 }, 1, 1, 4);
    expect(out.z).toBeCloseTo(16, 6);
  });
});
