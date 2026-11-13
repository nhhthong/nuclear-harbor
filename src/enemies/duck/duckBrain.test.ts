import { describe, expect, it } from 'vitest';
import { decideDuck, type DuckBrainInput } from './duckBrain';

const base: DuckBrainInput = { state: 'patrol', distance: 20, hasLos: true, timeSinceSeen: 0, playerAlive: true };

describe('decideDuck', () => {
  it('patrols until it sees the player', () => {
    expect(decideDuck({ ...base, hasLos: false, timeSinceSeen: Infinity })).toBe('patrol');
    expect(decideDuck(base)).toBe('hop');
    expect(decideDuck({ ...base, distance: 60, timeSinceSeen: Infinity })).toBe('patrol');
  });
  it('arms at about 2.5 m with line of sight', () => {
    expect(decideDuck({ ...base, state: 'hop', distance: 2.4 })).toBe('arming');
    expect(decideDuck({ ...base, state: 'hop', distance: 3 })).toBe('hop');
    expect(decideDuck({ ...base, state: 'hop', distance: 2.4, hasLos: false })).toBe('hop');
  });
  it('arming is final and the dead player is ignored', () => {
    expect(decideDuck({ ...base, state: 'arming', distance: 30, playerAlive: false })).toBe('arming');
    expect(decideDuck({ ...base, state: 'hop', playerAlive: false })).toBe('patrol');
  });
  it('gives up after losing the player for a while', () => {
    expect(decideDuck({ ...base, state: 'hop', hasLos: false, timeSinceSeen: 10 })).toBe('patrol');
    expect(decideDuck({ ...base, state: 'hop', hasLos: false, timeSinceSeen: 1 })).toBe('hop');
  });
});
