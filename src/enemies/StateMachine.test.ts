import { describe, expect, it } from 'vitest';
import { StateMachine } from './StateMachine';

describe('StateMachine', () => {
  it('runs exit/enter hooks and resets time in state', () => {
    const log: string[] = [];
    const sm = new StateMachine<'a' | 'b'>('a', {
      onEnter: (s, p) => log.push(`enter ${s} from ${p}`),
      onExit: (s, n) => log.push(`exit ${s} to ${n}`),
    });
    sm.update(0.5);
    expect(sm.timeInState).toBeCloseTo(0.5);
    expect(sm.set('a')).toBe(false);
    expect(sm.set('b')).toBe(true);
    expect(sm.timeInState).toBe(0);
    expect(log).toEqual(['exit a to b', 'enter b from a']);
  });
});
