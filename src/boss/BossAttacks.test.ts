import { describe, expect, it } from 'vitest';
import { BOSS } from '@/config/tunables';
import {
  AttackScheduler,
  abilityParams,
  angleDelta,
  clampToArena,
  inSlamDanger,
  inSplash,
  missileTargets,
  predictTarget,
  rangeIntent,
} from './BossAttacks';
import type { SchedulerInput } from './BossAttacks';
import { BOSS_LOCAL } from './tunables';

const none = [false, false, false, false];
const input = (over: Partial<SchedulerInput> = {}): SchedulerInput => ({
  phase: 'weakpoint-hunt',
  destroyed: none,
  playerDistance: 25,
  ...over,
});

/** Advance in 1/60 s steps and collect steps. */
function run(s: AttackScheduler, seconds: number, inp: SchedulerInput) {
  const out: Array<{ t: number; kind: string; attack: string }> = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const step = s.update(dt, inp);
    if (step) out.push({ t, kind: step.kind, attack: step.attack });
  }
  return out;
}

describe('abilityParams (GDD 9.2)', () => {
  it('base values with no weak point destroyed', () => {
    const p = abilityParams(none, 'weakpoint-hunt');
    expect(p.cannonCooldown).toBe(BOSS.heavyCannon.cooldown);
    expect(p.slamRadius).toBe(BOSS.groundSlam.radius);
    expect(p.missileCount).toBe(BOSS.missileBarrage.count);
    expect(p.cooldownFactor).toBe(1);
  });
  it('front: cannon cooldown x1.5', () => {
    expect(abilityParams([true, false, false, false], 'weakpoint-hunt').cannonCooldown).toBeCloseTo(
      BOSS.heavyCannon.cooldown * 1.5,
    );
  });
  it('left/right: missile count -2 each', () => {
    expect(abilityParams([false, false, true, false], 'weakpoint-hunt').missileCount).toBe(BOSS.missileBarrage.count - 2);
    expect(abilityParams([false, false, true, true], 'weakpoint-hunt').missileCount).toBe(BOSS.missileBarrage.count - 4);
  });
  it('rear: slam radius -30%', () => {
    expect(abilityParams([false, true, false, false], 'weakpoint-hunt').slamRadius).toBeCloseTo(BOSS.groundSlam.radius * 0.7);
  });
  it('core-exposed speeds attacks up', () => {
    expect(abilityParams([true, true, true, true], 'core-exposed').cooldownFactor).toBeLessThan(1);
  });
});

describe('AttackScheduler', () => {
  it('does nothing before the hunt and waits the global interval first', () => {
    const s = new AttackScheduler();
    expect(run(s, 10, input({ phase: 'awakening' }))).toEqual([]);
    const steps = run(s, BOSS.attackInterval - 0.2, input());
    expect(steps).toEqual([]);
  });

  it('telegraph precedes impact by exactly the configured duration', () => {
    const s = new AttackScheduler();
    const steps = run(s, BOSS.attackInterval + 4, input({ playerDistance: 25 }));
    const tele = steps.find((x) => x.kind === 'telegraph');
    const hit = steps.find((x) => x.kind === 'impact');
    expect(tele).toBeDefined();
    expect(hit).toBeDefined();
    expect(hit?.attack).toBe(tele?.attack);
    const dur = tele?.attack === 'missile-barrage' ? BOSS.missileBarrage.telegraph : BOSS.heavyCannon.telegraph;
    expect((hit?.t ?? 0) - (tele?.t ?? 0)).toBeGreaterThanOrEqual(dur - 1 / 60);
    expect((hit?.t ?? 0) - (tele?.t ?? 0)).toBeLessThan(dur + 2 / 60);
  });

  it('selects by range: slam only when the player is inside the slam radius', () => {
    const near = new AttackScheduler();
    const nearSteps = run(near, BOSS.attackInterval + 0.1, input({ playerDistance: 5 }));
    expect(nearSteps[0]?.attack).toBe('ground-slam');
    const far = new AttackScheduler();
    const farSteps = run(far, BOSS.attackInterval + 0.1, input({ playerDistance: 40 }));
    expect(farSteps[0]?.attack).not.toBe('ground-slam');
  });

  it('forced slam telegraphs with the (scaled, weakened) radius and sets cooldown', () => {
    const s = new AttackScheduler(0.4);
    const step = s.force('ground-slam', input({ destroyed: [false, true, false, false] }));
    expect(step?.kind).toBe('telegraph');
    expect(step?.duration).toBe(BOSS.groundSlam.telegraph);
    expect(step?.radius).toBeCloseTo(BOSS.groundSlam.radius * 0.7 * 0.4);
    expect(s.cooldownOf('ground-slam')).toBe(BOSS.groundSlam.cooldown);
    expect(s.force('heavy-cannon', input())).toBeNull(); // busy
  });

  it('respects per-attack cooldowns (no immediate repeat)', () => {
    const s = new AttackScheduler();
    const steps = run(s, 40, input({ playerDistance: 5 })).filter((x) => x.kind === 'telegraph');
    const cooldown: Record<string, number> = {
      'ground-slam': BOSS.groundSlam.cooldown,
      'heavy-cannon': BOSS.heavyCannon.cooldown,
      'missile-barrage': BOSS.missileBarrage.cooldown,
    };
    const lastStart: Record<string, number> = {};
    for (const st of steps) {
      const prev = lastStart[st.attack];
      if (prev !== undefined) expect(st.t - prev).toBeGreaterThanOrEqual((cooldown[st.attack] ?? 0) - 0.05);
      lastStart[st.attack] = st.t;
    }
    expect(steps.length).toBeGreaterThan(2);
  });

  it('core-exposed attacks are more frequent than in the hunt', () => {
    const count = (phase: 'weakpoint-hunt' | 'core-exposed') =>
      run(new AttackScheduler(), 90, input({ phase, playerDistance: 25 })).filter((x) => x.kind === 'telegraph').length;
    expect(count('core-exposed')).toBeGreaterThan(count('weakpoint-hunt'));
  });

  it('reset clears timers and in-flight attacks; leaving the hunt cancels', () => {
    const s = new AttackScheduler();
    s.force('heavy-cannon', input());
    expect(s.busy).toBe(true);
    s.reset();
    expect(s.busy).toBe(false);
    expect(s.cooldownOf('heavy-cannon')).toBe(0);
    s.force('heavy-cannon', input());
    s.update(0.1, input({ phase: 'destroyed' }));
    expect(s.busy).toBe(false);
  });

  it('missile telegraph carries the weakened count', () => {
    const s = new AttackScheduler();
    const step = s.force('missile-barrage', input({ destroyed: [false, false, true, true] }));
    expect(step?.count).toBe(BOSS.missileBarrage.count - 4);
    expect(step?.radius).toBe(BOSS.missileBarrage.splashRadius);
  });
});

describe('geometry helpers', () => {
  it('clampToArena keeps points inside radius minus margin', () => {
    const c = { x: -28, z: -90 };
    const p = clampToArena({ x: 100, z: -90 }, c, 28, 6);
    expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeCloseTo(22);
    expect(clampToArena({ x: -30, z: -90 }, c, 28, 6)).toEqual({ x: -30, z: -90 });
  });
  it('rangeIntent holds the 20-35 m band', () => {
    expect(rangeIntent(40, 20, 35)).toBe(1);
    expect(rangeIntent(10, 20, 35)).toBe(-1);
    expect(rangeIntent(25, 20, 35)).toBe(0);
    expect(BOSS_LOCAL.rangeMin).toBe(20);
  });
  it('angleDelta wraps', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleDelta(0, 1)).toBe(1);
  });
  it('predictTarget leads the player', () => {
    expect(predictTarget({ x: 1, z: 2 }, { x: 2, z: -1 }, 1.5)).toEqual({ x: 4, z: 0.5 });
  });
  it('slam danger: inside radius and below the perch height only', () => {
    const c = { x: 0, z: 0 };
    expect(inSlamDanger({ x: 5, y: 0, z: 0 }, c, 14, 3)).toBe(true);
    expect(inSlamDanger({ x: 5, y: 8, z: 0 }, c, 14, 3)).toBe(false);
    expect(inSlamDanger({ x: 15, y: 0, z: 0 }, c, 14, 3)).toBe(false);
  });
  it('splash danger is a sphere', () => {
    expect(inSplash({ x: 0, y: 0, z: 0 }, { x: 3, y: 1, z: 0 }, 4)).toBe(true);
    expect(inSplash({ x: 0, y: 0, z: 0 }, { x: 5, y: 1, z: 0 }, 4)).toBe(false);
  });
  it('missileTargets stays within spread and returns the requested count', () => {
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const t = missileTargets(6, { x: 10, z: 10 }, 8, rnd);
    expect(t).toHaveLength(6);
    for (const p of t) expect(Math.hypot(p.x - 10, p.z - 10)).toBeLessThanOrEqual(8.0001);
  });
});
