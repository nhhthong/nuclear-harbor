import { describe, expect, it } from 'vitest';
import { SpawnScheduler } from './scheduler';
import { VFX } from './tunables';

describe('SpawnScheduler', () => {
  it('fires entries when due, once', () => {
    const s = new SpawnScheduler(4);
    s.schedule(0.5, 'explosion', 1, 2, 3, 2);
    s.schedule(0.1, 'smoke', 0, 0, 0, 1);
    const fired: string[] = [];
    s.advance(0.2, (id) => fired.push(id));
    expect(fired).toEqual(['smoke']);
    s.advance(0.4, (id, x, y, z, sc) => fired.push(`${id}:${x},${y},${z},${sc}`));
    expect(fired).toEqual(['smoke', 'explosion:1,2,3,2']);
    expect(s.count).toBe(0);
  });

  it('refuses beyond capacity', () => {
    const s = new SpawnScheduler(1);
    expect(s.schedule(1, 'spark', 0, 0, 0, 1)).toBe(true);
    expect(s.schedule(1, 'spark', 0, 0, 0, 1)).toBe(false);
    expect(s.dropped).toBe(1);
  });

  it('boss defeat sequence is multi-stage over about 2 s and fits the scheduler', () => {
    const stages = VFX.bossDefeatStages;
    expect(stages.length).toBeGreaterThanOrEqual(5);
    expect(stages[stages.length - 1]!.t).toBeGreaterThanOrEqual(1.8);
    expect(stages[stages.length - 1]!.kind).toBe('big-explosion');
    expect(stages.length).toBeLessThanOrEqual(VFX.maxScheduled);
  });
});
