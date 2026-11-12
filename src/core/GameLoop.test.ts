import { describe, expect, it } from 'vitest';
import { GameLoop } from './GameLoop';

function makeLoop() {
  const log = { fixed: 0, update: 0, render: 0, alphas: [] as number[] };
  const loop = new GameLoop(
    {
      fixedUpdate: () => log.fixed++,
      update: (_dt, alpha) => {
        log.update++;
        log.alphas.push(alpha);
      },
      render: () => log.render++,
    },
    { fixedHz: 60, maxSubSteps: 5, maxFrameDelta: 0.25 },
  );
  return { loop, log };
}

describe('GameLoop', () => {
  it('runs a fixed number of steps for the elapsed time', () => {
    const { loop, log } = makeLoop();
    loop.tick(0); // first frame has dt = 0
    expect(log.fixed).toBe(0);
    loop.tick(50); // 50 ms = 3 steps of 16.67 ms
    expect(log.fixed).toBe(3);
    expect(log.render).toBe(2);
    expect(log.alphas.at(-1)).toBeGreaterThanOrEqual(0);
    expect(log.alphas.at(-1)).toBeLessThan(1);
  });

  it('caps sub-steps and drops the backlog', () => {
    const { loop, log } = makeLoop();
    loop.tick(0);
    loop.tick(10_000);
    expect(log.fixed).toBe(5);
    loop.tick(10_016.7);
    expect(log.fixed).toBe(6);
  });

  it('keeps rendering but stops simulating while paused', () => {
    const { loop, log } = makeLoop();
    loop.simulationPaused = true;
    loop.tick(0);
    loop.tick(100);
    expect(log.fixed).toBe(0);
    expect(log.update).toBe(0);
    expect(log.render).toBe(2);
    expect(loop.simTime).toBe(0);
  });
});
