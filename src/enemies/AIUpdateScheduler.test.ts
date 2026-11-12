import { describe, expect, it } from 'vitest';
import { AI_SCHEDULING } from '@/config/tunables';
import { AIUpdateScheduler, simLevelForDistance, thinkHzForDistance, thinkInterval, type Schedulable } from './AIUpdateScheduler';

function enemy(x: number, forceHighRate = false): Schedulable {
  return { position: { x, y: 0, z: 0 }, alive: true, simLevel: 'active', forceHighRate, thinkDt: 0 };
}

describe('AI scheduling bands', () => {
  it('maps distance to sim level', () => {
    expect(simLevelForDistance(AI_SCHEDULING.nearDistance - 1)).toBe('active');
    expect(simLevelForDistance(AI_SCHEDULING.midDistance)).toBe('simplified');
    expect(simLevelForDistance(AI_SCHEDULING.dormantDistance + 1)).toBe('dormant');
  });

  it('uses 20-30 Hz near, 5-10 Hz mid, 1-2 Hz far (GDD 13.7)', () => {
    const near = thinkHzForDistance(5);
    const mid = thinkHzForDistance(AI_SCHEDULING.nearDistance + 5);
    const far = thinkHzForDistance(AI_SCHEDULING.midDistance + 5);
    expect(near).toBeGreaterThanOrEqual(20);
    expect(near).toBeLessThanOrEqual(30);
    expect(mid).toBeGreaterThanOrEqual(5);
    expect(mid).toBeLessThanOrEqual(10);
    expect(far).toBeGreaterThanOrEqual(1);
    expect(far).toBeLessThanOrEqual(2);
    expect(thinkHzForDistance(AI_SCHEDULING.dormantDistance + 1)).toBe(0);
  });

  it('forceHighRate uses the near interval at any distance', () => {
    expect(thinkInterval(100, true)).toBeCloseTo(1 / AI_SCHEDULING.nearHz);
    expect(thinkInterval(100, false)).toBeGreaterThan(thinkInterval(100, true));
  });
});

describe('AIUpdateScheduler', () => {
  it('thinks near enemies far more often than far ones', () => {
    const scheduler = new AIUpdateScheduler();
    const near = enemy(10);
    const far = enemy(AI_SCHEDULING.midDistance + 10);
    const out: Schedulable[] = [];
    let nearThinks = 0;
    let farThinks = 0;
    for (let i = 0; i < 60; i++) {
      scheduler.update([near, far], 0, 0, 1 / 60, out);
      if (out.includes(near)) nearThinks++;
      if (out.includes(far)) farThinks++;
    }
    expect(nearThinks).toBeGreaterThanOrEqual(25);
    expect(nearThinks).toBeLessThanOrEqual(31);
    expect(farThinks).toBeGreaterThanOrEqual(1);
    expect(farThinks).toBeLessThanOrEqual(3);
  });

  it('sets sim level, passes accumulated dt and honours forceHighRate', () => {
    const scheduler = new AIUpdateScheduler();
    const forced = enemy(100, true);
    const normal = enemy(100);
    const out: Schedulable[] = [];
    let forcedThinks = 0;
    for (let i = 0; i < 60; i++) {
      scheduler.update([forced, normal], 0, 0, 1 / 60, out);
      if (out.includes(forced)) {
        forcedThinks++;
        expect(forced.thinkDt).toBeCloseTo(1 / AI_SCHEDULING.nearHz, 1);
      }
    }
    expect(forced.simLevel).toBe('simplified');
    expect(forcedThinks).toBeGreaterThan(20);
  });

  it('skips dead enemies and marks far ones dormant', () => {
    const scheduler = new AIUpdateScheduler();
    const dead = { ...enemy(5), alive: false };
    const dormant = enemy(AI_SCHEDULING.dormantDistance + 50);
    const out: Schedulable[] = [];
    for (let i = 0; i < 70; i++) scheduler.update([dead, dormant], 0, 0, 1 / 60, out);
    expect(dormant.simLevel).toBe('dormant');
    expect(dead.thinkDt).toBe(0);
  });
});
