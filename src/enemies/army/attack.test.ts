import { describe, expect, it } from 'vitest';
import { abortAttack, burstDuration, createAttack, podGlow, rocketGap, stepAttack, type Attack } from './attack';
import { STRIKER } from './tunables';

const dt = 1 / 60;

interface Shot {
  t: number;
  kind: 'bullet' | 'rocket';
}

function run(a: Attack, seconds: number, canFire = true, rand: () => number = () => 0.5): Shot[] {
  const shots: Shot[] = [];
  let t = 0;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt;
    const s = stepAttack(a, dt, canFire, rand);
    if (s.bullets > 0) shots.push({ t, kind: 'bullet' });
    if (s.rockets > 0) shots.push({ t, kind: 'rocket' });
  }
  return shots;
}

describe('striker attack cycle', () => {
  it('fires bursts of three rounds, a burst about every 1.6 s', () => {
    const a = createAttack(undefined, () => 0.5);
    a.rocketCooldown = 999;
    const bullets = run(a, 8).filter((s) => s.kind === 'bullet');
    expect(bullets.length % 3).toBe(0);
    expect(bullets.length).toBeGreaterThanOrEqual(12);
    // rounds within a burst are `interval` apart, bursts `period` apart (start to start)
    expect(bullets[1]!.t - bullets[0]!.t).toBeCloseTo(STRIKER.burst.interval, 1);
    expect(bullets[3]!.t - bullets[0]!.t).toBeCloseTo(STRIKER.burst.period, 1);
    expect(bullets[6]!.t - bullets[3]!.t).toBeCloseTo(STRIKER.burst.period, 1);
  });

  it('stays silent without a target and never starts a telegraph or burst', () => {
    const a = createAttack(undefined, () => 0.5);
    a.rocketCooldown = 0;
    expect(run(a, 5, false)).toEqual([]);
    expect(a.phase).toBe('idle');
  });

  it('launches a rocket after the telegraph, then the next one follows 6 to 9 s later', () => {
    const a = createAttack(undefined, () => 0);
    a.rocketCooldown = 0;
    const shots = run(a, 40, true, () => 0.5);
    const rockets = shots.filter((s) => s.kind === 'rocket');
    expect(rockets.length).toBeGreaterThanOrEqual(4);
    expect(rockets[0]!.t).toBeCloseTo(STRIKER.rocket.telegraph, 1);
    for (let i = 1; i < rockets.length; i++) {
      const gap = rockets[i]!.t - rockets[i - 1]!.t;
      // launch to launch is the drawn gap (rand 0.5 -> 7.5 s)
      expect(gap).toBeGreaterThanOrEqual(STRIKER.rocket.minGap - 0.05);
      expect(gap).toBeLessThanOrEqual(STRIKER.rocket.maxGap + 0.05);
      expect(gap).toBeCloseTo(7.5, 0);
    }
  });

  it('draws rocket gaps from the 6 to 9 s window', () => {
    expect(rocketGap(0)).toBe(6);
    expect(rocketGap(1)).toBe(9);
    expect(rocketGap(0.5)).toBe(7.5);
  });

  it('ramps the pod glow during the telegraph and drops it after the launch', () => {
    const a = createAttack(undefined, () => 0);
    a.rocketCooldown = 0;
    stepAttack(a, dt, true);
    expect(a.phase).toBe('telegraph');
    expect(podGlow(a)).toBeLessThan(0.1);
    for (let i = 0; i < Math.round(STRIKER.rocket.telegraph / dt / 2); i++) stepAttack(a, dt, true);
    expect(podGlow(a)).toBeGreaterThan(0.4);
    expect(podGlow(a)).toBeLessThan(0.7);
    while (a.phase === 'telegraph') stepAttack(a, dt, true);
    expect(a.phase).toBe('recover');
    expect(podGlow(a)).toBeGreaterThan(0.9);
    for (let i = 0; i < 40; i++) stepAttack(a, dt, true);
    expect(podGlow(a)).toBe(0);
  });

  it('cancels a telegraph when the target is lost, but finishes a started burst', () => {
    const a = createAttack(undefined, () => 0);
    a.rocketCooldown = 0;
    stepAttack(a, dt, true);
    stepAttack(a, dt, false);
    expect(a.phase).toBe('idle');

    const b = createAttack(undefined, () => 0);
    b.rocketCooldown = 999;
    stepAttack(b, dt, true);
    expect(b.phase).toBe('burst');
    abortAttack(b);
    expect(b.phase).toBe('burst');
    const rest = run(b, 0.5, false).filter((s) => s.kind === 'bullet');
    expect(rest).toHaveLength(STRIKER.burst.size);
  });

  it('keeps its numbers inside the brief', () => {
    expect(STRIKER.burst.size).toBe(3);
    expect(STRIKER.burst.damage).toBe(5);
    expect(burstDuration()).toBeLessThan(STRIKER.burst.period);
    expect(STRIKER.rocket.damage).toBe(14);
    expect(STRIKER.rocket.splashRadius).toBe(4);
    expect(STRIKER.burst.minRange).toBe(8);
    expect(STRIKER.burst.maxRange).toBe(35);
  });
});
