import { describe, expect, it } from 'vitest';
import { createGait, resetGait, updateGait } from './legs';
import { SPIDER_LOCAL } from './tunables';

const DT = 1 / 60;

function walk(seconds: number, speed: number) {
  const g = createGait(6);
  resetGait(g, 0, 0, 0);
  let z = 0;
  const log: { a: number; b: number }[] = [];
  const stepped = new Set<number>();
  for (let t = 0; t < seconds; t += DT) {
    z -= speed * DT;
    updateGait(g, 0, z, 0, speed, DT);
    let a = 0;
    let b = 0;
    for (let i = 0; i < g.count; i++) {
      if (g.stepping[i]) {
        if (g.group[i] === 0) a++;
        else b++;
        stepped.add(i);
      }
    }
    log.push({ a, b });
  }
  return { g, log, stepped };
}

describe('gait', () => {
  it('has six legs in two tripods of three', () => {
    const g = createGait(6);
    expect(g.count).toBe(6);
    expect(g.group.filter((x) => x === 0).length).toBe(3);
    expect(g.group.filter((x) => x === 1).length).toBe(3);
  });

  it('never steps both tripods at once and uses every leg while walking', () => {
    const { log, stepped } = walk(4, 5);
    expect(log.some((l) => l.a > 0)).toBe(true);
    expect(log.some((l) => l.b > 0)).toBe(true);
    expect(log.every((l) => l.a === 0 || l.b === 0)).toBe(true);
    expect(stepped.size).toBe(6);
  });

  it('keeps feet at rest when the body is idle', () => {
    const g = createGait(6);
    resetGait(g, 3, 4, 0.5);
    for (let t = 0; t < 2; t += DT) updateGait(g, 3, 4, 0.5, 0, DT);
    for (let i = 0; i < g.count; i++) {
      expect(g.stepping[i]).toBe(0);
      expect(g.footY[i]).toBe(0);
    }
  });

  it('lifts a stepping foot by up to the step height', () => {
    const g = createGait(6);
    resetGait(g, 0, 0, 0);
    let max = 0;
    let z = 0;
    for (let t = 0; t < 3; t += DT) {
      z -= 5 * DT;
      updateGait(g, 0, z, 0, 5, DT);
      for (let i = 0; i < g.count; i++) max = Math.max(max, g.footY[i] ?? 0);
    }
    expect(max).toBeGreaterThan(SPIDER_LOCAL.stepHeight * 0.5);
    expect(max).toBeLessThanOrEqual(SPIDER_LOCAL.stepHeight + 1e-6);
  });
});
