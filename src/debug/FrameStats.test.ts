import { describe, expect, it } from 'vitest';
import { FrameStats } from './FrameStats';

describe('FrameStats', () => {
  it('is zero when empty', () => {
    const s = new FrameStats(8);
    expect(s.fps).toBe(0);
    expect(s.avgMs).toBe(0);
    expect(s.onePercentLowFps).toBe(0);
  });

  it('computes average, fps and max', () => {
    const s = new FrameStats(8);
    for (const ms of [10, 20, 30]) s.push(ms);
    expect(s.avgMs).toBeCloseTo(20);
    expect(s.fps).toBeCloseTo(50);
    expect(s.maxMs).toBe(30);
  });

  it('overwrites the oldest samples when full', () => {
    const s = new FrameStats(4);
    for (const ms of [100, 100, 100, 100, 10, 10, 10, 10]) s.push(ms);
    expect(s.count).toBe(4);
    expect(s.avgMs).toBeCloseTo(10);
    expect(s.maxMs).toBe(10);
  });

  it('1% low reflects the worst frames', () => {
    const s = new FrameStats(200);
    for (let i = 0; i < 199; i++) s.push(10);
    s.push(100);
    // 1% of 200 = 2 frames: 100 and 10 -> avg 55 ms
    expect(s.onePercentLowFps).toBeCloseTo(1000 / 55);
  });

  it('reset clears', () => {
    const s = new FrameStats(4);
    s.push(5);
    s.reset();
    expect(s.count).toBe(0);
  });
});
