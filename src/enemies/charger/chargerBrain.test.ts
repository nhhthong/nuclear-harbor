import { describe, expect, it } from 'vitest';
import { CHARGER_ROBOT } from '@/config/tunables';
import { decideCharger, timedNext, type ChargerBrainInput } from './chargerBrain';

function input(over: Partial<ChargerBrainInput> = {}): ChargerBrainInput {
  return {
    state: 'patrol',
    timeInState: 0,
    distance: 50,
    hasLos: false,
    timeSinceSeen: Infinity,
    cooldownLeft: 0,
    playerAlive: true,
    ...over,
  };
}

describe('decideCharger', () => {
  it('patrols until the player is seen within 25 m', () => {
    expect(decideCharger(input())).toBe('patrol');
    expect(decideCharger(input({ distance: 20, hasLos: true }))).toBe('detect');
    expect(decideCharger(input({ distance: 26, hasLos: true }))).toBe('patrol');
    expect(decideCharger(input({ distance: 20, hasLos: false }))).toBe('patrol');
  });

  it('starts the wind-up only in the window, with LOS and no cooldown', () => {
    const base = { state: 'detect' as const, hasLos: true, timeSinceSeen: 0 };
    expect(decideCharger(input({ ...base, distance: 15 }))).toBe('windup');
    expect(decideCharger(input({ ...base, distance: 5 }))).toBe('detect');
    expect(decideCharger(input({ ...base, distance: 15, cooldownLeft: 3 }))).toBe('detect');
  });

  it('returns to patrol after losing the target', () => {
    expect(decideCharger(input({ state: 'detect', distance: 15, timeSinceSeen: 10 }))).toBe('patrol');
    expect(decideCharger(input({ state: 'detect', distance: 15, timeSinceSeen: 1 }))).toBe('detect');
  });

  it('winds up for the telegraph duration, then charges', () => {
    const w = { state: 'windup' as const, hasLos: true, distance: 15 };
    expect(decideCharger(input({ ...w, timeInState: CHARGER_ROBOT.telegraphDuration - 0.05 }))).toBe('windup');
    expect(decideCharger(input({ ...w, timeInState: CHARGER_ROBOT.telegraphDuration }))).toBe('charge');
  });

  it('keeps charging until the motion ends it', () => {
    expect(decideCharger(input({ state: 'charge', timeInState: 99 }))).toBe('charge');
  });

  it('stays stunned for 2.5 s, recovers for the recover duration, then detects', () => {
    expect(timedNext('stunned', CHARGER_ROBOT.wallStunDuration - 0.01)).toBe('stunned');
    expect(timedNext('stunned', CHARGER_ROBOT.wallStunDuration)).toBe('detect');
    expect(timedNext('recover', CHARGER_ROBOT.recoverDuration - 0.01)).toBe('recover');
    expect(timedNext('recover', CHARGER_ROBOT.recoverDuration)).toBe('detect');
  });

  it('never leaves destroyed', () => {
    expect(decideCharger(input({ state: 'destroyed', distance: 15, hasLos: true }))).toBe('destroyed');
  });
});
