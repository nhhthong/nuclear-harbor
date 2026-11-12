import { describe, expect, it } from 'vitest';
import { GrappleState, type GrappleConfig, type RayResult, type StepInput } from './GrappleState';

const CFG: GrappleConfig = {
  maxRange: 40,
  cooldown: 1,
  failureCooldown: 0.3,
  releaseDistance: 1.5,
  maxPullDuration: 4,
  stuckDistance: 0.25,
  stuckWindow: 0.4,
  hookTravelSpeed: 90,
  maxAttachDelay: 0.4,
  aimLift: 0.5,
  wallInset: 0.6,
  cooldownEventInterval: 0.1,
};
const DT = 1 / 60;

const ray = (over: Partial<RayResult> = {}): RayResult => ({
  hit: true,
  grappleable: true,
  distance: 20,
  point: { x: 0, y: 10, z: -20 },
  ...over,
});

function input(over: Partial<StepInput> = {}): StepInput {
  return { dt: DT, firePressed: false, ray: null, eye: { x: 0, y: 1.6, z: 0 }, moved: 0.3, ...over };
}

/** Runs one step and returns a copy of the event types/reasons. */
function run(state: GrappleState, over: Partial<StepInput> = {}) {
  const out = state.step(input(over));
  return { out, events: out.events.map((e) => ({ ...e })) };
}

function fireValid(state: GrappleState, r: Partial<RayResult> = {}) {
  return run(state, { firePressed: true, ray: ray(r) });
}

describe('GrappleState firing', () => {
  it('starts ready', () => {
    const s = new GrappleState(CFG);
    expect(s.phase).toBe('ready');
    expect(s.cooldownRemaining).toBe(0);
  });

  it('valid shot emits fired + attached and enters pulling', () => {
    const s = new GrappleState(CFG);
    const { events } = fireValid(s);
    expect(events.map((e) => e.type)).toEqual(['fired', 'attached']);
    expect(s.phase).toBe('pulling');
    const attached = events[1];
    expect(attached).toMatchObject({ type: 'attached', distance: 20 });
  });

  it('no hit fails with no-target and starts the short cooldown', () => {
    const s = new GrappleState(CFG);
    const { events } = run(s, { firePressed: true, ray: ray({ hit: false }) });
    expect(events[0]).toEqual({ type: 'failed', reason: 'no-target' });
    expect(s.phase).toBe('cooldown');
    expect(s.cooldownTotal).toBe(0.3);
  });

  it('null ray fails with no-target', () => {
    const s = new GrappleState(CFG);
    const { events } = run(s, { firePressed: true, ray: null });
    expect(events[0]).toEqual({ type: 'failed', reason: 'no-target' });
  });

  it('hit beyond range fails with no-target', () => {
    const s = new GrappleState(CFG);
    const { events } = run(s, { firePressed: true, ray: ray({ distance: 40.5 }) });
    expect(events[0]).toEqual({ type: 'failed', reason: 'no-target' });
  });

  it('non-grappleable hit fails with not-grappleable', () => {
    const s = new GrappleState(CFG);
    const { events } = run(s, { firePressed: true, ray: ray({ grappleable: false }) });
    expect(events[0]).toEqual({ type: 'failed', reason: 'not-grappleable' });
    expect(s.phase).toBe('cooldown');
  });

  it('firing during cooldown fails with cooldown and does not restart it', () => {
    const s = new GrappleState(CFG);
    run(s, { firePressed: true, ray: ray({ hit: false }) });
    for (let i = 0; i < 5; i++) run(s);
    const before = s.cooldownRemaining;
    const { events } = run(s, { firePressed: true, ray: ray() });
    expect(events.find((e) => e.type === 'failed')).toEqual({ type: 'failed', reason: 'cooldown' });
    expect(s.cooldownRemaining).toBeLessThanOrEqual(before);
    expect(s.cooldownTotal).toBe(0.3);
  });

  it('is ready again after the failure cooldown elapses', () => {
    const s = new GrappleState(CFG);
    run(s, { firePressed: true, ray: ray({ hit: false }) });
    for (let i = 0; i < 25; i++) run(s);
    expect(s.phase).toBe('ready');
  });
});

describe('GrappleState pulling', () => {
  it('waits for the hook to land, then pulls along the aim direction', () => {
    const s = new GrappleState(CFG);
    // distance 20 m / 90 m/s = 0.222 s of hook flight
    const first = fireValid(s);
    expect(first.out.pulling).toBe(false);
    let out = first.out;
    let steps = 0;
    while (!out.pulling && steps < 60) {
      out = run(s).out;
      steps++;
    }
    expect(out.pulling).toBe(true);
    expect(steps * DT).toBeGreaterThan(0.18);
    expect(steps * DT).toBeLessThan(0.3);
    // aim point is the hit raised by the lip clearance
    const len = Math.hypot(0, 10.5 - 1.6, -20);
    expect(out.dirY).toBeCloseTo((10.5 - 1.6) / len, 5);
    expect(out.dirZ).toBeCloseTo(-20 / len, 5);
    expect(Math.hypot(out.dirX, out.dirY, out.dirZ)).toBeCloseTo(1, 6);
  });

  it('caps the attach delay at maxAttachDelay', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { distance: 40, point: { x: 0, y: 10, z: -40 } });
    let steps = 0;
    let out = run(s).out;
    while (!out.pulling && steps < 100) {
      out = run(s).out;
      steps++;
    }
    expect(steps * DT).toBeLessThanOrEqual(0.4 + DT * 2);
  });

  it('releases on arrival within releaseDistance and starts the 1 s cooldown', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    for (let i = 0; i < 30; i++) run(s);
    const { events, out } = run(s, { eye: { x: 0, y: 10.5, z: -19 } });
    expect(events[0]).toEqual({ type: 'released', reason: 'arrived' });
    expect(out.pulling).toBe(false);
    expect(s.phase).toBe('cooldown');
    expect(s.cooldownTotal).toBe(1);
    expect(out.landing).toBeNull();
  });

  it('does not arrive while the hook is still flying', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { distance: 30, point: { x: 0, y: 1.6, z: -30 } });
    const { events } = run(s, { eye: { x: 0, y: 1.6, z: -29.5 } });
    expect(events.find((e) => e.type === 'released')).toBeUndefined();
  });

  it('releases manually on a second fire press', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    for (let i = 0; i < 30; i++) run(s);
    const { events, out } = run(s, { firePressed: true });
    expect(events[0]).toEqual({ type: 'released', reason: 'manual' });
    expect(out.pulling).toBe(false);
    expect(s.cooldownTotal).toBe(1);
  });

  it('cancels during hook flight with manual release', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    const { events } = run(s, { firePressed: true });
    expect(events[0]).toEqual({ type: 'released', reason: 'manual' });
  });

  it('releases as stuck when barely moving for stuckWindow', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    let released: unknown = null;
    for (let i = 0; i < 120 && !released; i++) {
      const { events } = run(s, { moved: 0.001 });
      released = events.find((e) => e.type === 'released') ?? null;
    }
    expect(released).toEqual({ type: 'released', reason: 'stuck' });
  });

  it('does not report stuck while moving at pull speed', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    for (let i = 0; i < 150; i++) {
      const { events } = run(s, { moved: 0.3, eye: { x: 0, y: 1.6, z: -i * 0.001 } });
      const rel = events.find((e) => e.type === 'released');
      if (rel) expect(rel).toEqual({ type: 'released', reason: 'timeout' });
    }
  });

  it('times out after maxPullDuration while still making progress', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { distance: 39, point: { x: 0, y: 1.6, z: -39 } });
    let released: unknown = null;
    for (let i = 0; i < 400 && !released; i++) {
      const { events } = run(s, { moved: 0.3 });
      released = events.find((e) => e.type === 'released') ?? null;
    }
    expect(released).toEqual({ type: 'released', reason: 'timeout' });
  });

  it('forceRelease(death) releases and always stops pulling', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    const out = s.forceRelease('death');
    expect(out.events[0]).toEqual({ type: 'released', reason: 'death' });
    expect(out.pulling).toBe(false);
    expect(s.phase).toBe('cooldown');
  });

  it('forceRelease when not pulling does nothing', () => {
    const s = new GrappleState(CFG);
    expect(s.forceRelease('death').events).toHaveLength(0);
    expect(s.phase).toBe('ready');
  });

  it('reset returns to ready silently', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    s.reset();
    expect(s.phase).toBe('ready');
    expect(s.cooldownRemaining).toBe(0);
  });
});

describe('GrappleState aim point', () => {
  it('lifts the aim point and moves it into the wall along the horizontal normal', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { point: { x: 0, y: 5, z: -10 }, nx: 0, nz: 1, distance: 10 });
    expect(s.target).toEqual({ x: 0, y: 5.5, z: -10.6 });
  });

  it('does not inset for a top face hit (no horizontal normal)', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { point: { x: 3, y: 5, z: -10 }, nx: 0, nz: 0, distance: 10 });
    expect(s.target).toEqual({ x: 3, y: 5.5, z: -10 });
  });
});

describe('GrappleState perch', () => {
  const landing = { x: 12, y: 8, z: -14 };
  it('uses the anchor point as is and reports landing on arrival', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { point: { x: 12, y: 10.2, z: -16.55 }, anchorId: 'p', landing, distance: 20 });
    for (let i = 0; i < 30; i++) run(s);
    const { out, events } = run(s, { eye: { x: 12, y: 10.2, z: -15.2 } });
    expect(events[0]).toEqual({ type: 'released', reason: 'arrived' });
    expect(out.landing).toEqual(landing);
  });

  it('does not raise the aim point for perches', () => {
    const s = new GrappleState(CFG);
    fireValid(s, { point: { x: 0, y: 10, z: -20 }, anchorId: 'p', landing, distance: 20 });
    let out = run(s).out;
    for (let i = 0; i < 40 && !out.pulling; i++) out = run(s).out;
    const len = Math.hypot(0, 10 - 1.6, -20);
    expect(out.dirY).toBeCloseTo((10 - 1.6) / len, 5);
  });
});

describe('GrappleState cooldown events', () => {
  it('reports cooldown at most every 0.1 s and ends with remaining 0', () => {
    const s = new GrappleState(CFG);
    fireValid(s);
    const first = run(s, { firePressed: true });
    const all = [...first.events];
    for (let i = 0; i < 90; i++) all.push(...run(s).events);
    const cd = all.filter((e) => e.type === 'cooldown') as { remaining: number; total: number }[];
    expect(cd.length).toBeGreaterThanOrEqual(9);
    expect(cd.length).toBeLessThanOrEqual(12);
    expect(cd[0]?.total).toBe(1);
    expect(cd[0]?.remaining).toBeCloseTo(1, 1);
    expect(cd[cd.length - 1]?.remaining).toBe(0);
    for (let i = 1; i < cd.length; i++) expect(cd[i]!.remaining).toBeLessThan(cd[i - 1]!.remaining + 1e-9);
  });
});
