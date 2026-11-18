import { describe, expect, it } from 'vitest';
import { clawReaches, decideBiped, leapAt, nextTimed, planLeap, tickCooldown, type BipedBrainInput, type BipedState } from './brain';
import { BIPED } from './tunables';

const base: BipedBrainInput = {
  state: 'patrol',
  distance: 100,
  hasLos: false,
  timeSinceSeen: Infinity,
  playerAlive: true,
  commanded: false,
  leapCooldown: 0,
  clawCooldown: 0,
};
const decide = (state: BipedState, over: Partial<BipedBrainInput>): BipedState => decideBiped({ ...base, state, ...over });

describe('decideBiped', () => {
  it('notices the player inside the detection range with line of sight, and only then', () => {
    expect(decide('patrol', { distance: BIPED.detectionRange - 1, hasLos: true })).toBe('chase');
    expect(decide('patrol', { distance: BIPED.detectionRange + 1, hasLos: true })).toBe('patrol');
    expect(decide('patrol', { distance: 10, hasLos: false })).toBe('patrol');
  });

  it('keeps hunting for a few seconds after losing sight, then returns to its patrol', () => {
    expect(decide('chase', { distance: 20, hasLos: false, timeSinceSeen: BIPED.loseTargetTime - 0.5 })).toBe('chase');
    expect(decide('chase', { distance: 20, hasLos: false, timeSinceSeen: BIPED.loseTargetTime + 0.5 })).toBe('patrol');
    expect(decide('chase', { distance: 20, hasLos: false, timeSinceSeen: Infinity, commanded: true })).toBe('chase');
  });

  it('crouches for the leap only inside the leap band, with line of sight and no cooldown', () => {
    const near = { hasLos: true, timeSinceSeen: 0 };
    expect(decide('chase', { ...near, distance: (BIPED.leap.min + BIPED.leap.max) / 2 })).toBe('crouch');
    expect(decide('chase', { ...near, distance: BIPED.leap.max + 1 })).toBe('chase');
    expect(decide('chase', { ...near, distance: BIPED.leap.min - 0.1 })).toBe('chase');
    expect(decide('chase', { ...near, distance: 8, leapCooldown: 1 })).toBe('chase');
    expect(decide('chase', { hasLos: false, timeSinceSeen: 1, distance: 8 })).toBe('chase');
  });

  it('swipes when adjacent and the swipe is ready, otherwise keeps closing in', () => {
    const adj = { hasLos: true, timeSinceSeen: 0, distance: BIPED.claw.range - 0.3 };
    expect(decide('chase', adj)).toBe('claw');
    expect(decide('chase', { ...adj, clawCooldown: 0.5 })).toBe('chase');
  });

  it('does not interrupt a started action and stays destroyed', () => {
    for (const s of ['crouch', 'leap', 'recover', 'claw'] as const) expect(decide(s, { distance: 5, hasLos: true, timeSinceSeen: 0 })).toBe(s);
    expect(decide('destroyed', { distance: 5, hasLos: true })).toBe('destroyed');
  });
});

describe('timed transitions and cooldowns', () => {
  it('crouches for the telegraph time, then leaps; recovers for the configured time, then chases', () => {
    expect(nextTimed('crouch', BIPED.leap.telegraph - 0.01)).toBe('crouch');
    expect(nextTimed('crouch', BIPED.leap.telegraph)).toBe('leap');
    expect(nextTimed('recover', BIPED.leap.recover - 0.01)).toBe('recover');
    expect(nextTimed('recover', BIPED.leap.recover)).toBe('chase');
    expect(nextTimed('claw', BIPED.claw.windup + BIPED.claw.recover)).toBe('chase');
    expect(nextTimed('chase', 99)).toBe('chase');
  });

  it('counts a cooldown down to zero and never below', () => {
    expect(tickCooldown(1, 0.25)).toBeCloseTo(0.75);
    expect(tickCooldown(0.1, 0.25)).toBe(0);
    expect(tickCooldown(0, 0.25)).toBe(0);
  });
});

describe('planLeap', () => {
  it('lands just short of where the player stood when it is within reach', () => {
    const p = planLeap(0, 0, 0, -8);
    expect(p.toX).toBeCloseTo(0);
    expect(p.toZ).toBeCloseTo(-(8 - BIPED.leap.standOff));
    expect(p.distance).toBeCloseTo(8 - BIPED.leap.standOff);
    // still inside the claw radius of the locked position
    expect(BIPED.leap.standOff).toBeLessThan(BIPED.leap.radius);
  });

  it('never jumps farther than the leap maximum, along the same line', () => {
    const p = planLeap(0, 0, 30, 40);
    expect(p.distance).toBeCloseTo(BIPED.leap.max - BIPED.leap.standOff);
    expect(p.toX / p.toZ).toBeCloseTo(30 / 40);
  });

  it('pulls the landing back before blocked ground', () => {
    const open = planLeap(0, 0, 0, -10, 1);
    const blocked = planLeap(0, 0, 0, -10, 0.5);
    expect(blocked.distance).toBeLessThan(open.distance * 0.5 + 1e-9);
    expect(planLeap(0, 0, 0, -10, 0).distance).toBe(0);
  });

  it('flies faster over short jumps than long ones, within the air time and apex limits', () => {
    const short = planLeap(0, 0, 0, -4);
    const long = planLeap(0, 0, 0, -16);
    expect(short.airTime).toBeGreaterThanOrEqual(BIPED.leap.minAir);
    expect(long.airTime).toBeLessThanOrEqual(BIPED.leap.maxAir);
    expect(long.airTime).toBeGreaterThan(short.airTime);
    expect(long.apex).toBeGreaterThan(short.apex);
    expect(long.apex).toBeLessThanOrEqual(BIPED.leap.maxApex);
    expect(short.apex).toBeGreaterThanOrEqual(BIPED.leap.minApex);
  });

  it('reuses the output object and handles a zero-length jump', () => {
    const out = planLeap(1, 1, 1, 1);
    expect(out.distance).toBe(0);
    expect(planLeap(0, 0, 3, 0, 1, out)).toBe(out);
    expect(out.toX).toBeCloseTo(3 - BIPED.leap.standOff);
  });
});

describe('leapAt and clawReaches', () => {
  it('follows a parabola that starts and ends on the ground and peaks mid-flight', () => {
    const plan = planLeap(0, 0, 0, -10);
    const o = { x: 0, y: 0, z: 0 };
    expect(leapAt(plan, 0, o).y).toBe(0);
    expect(leapAt(plan, 1, o).y).toBeCloseTo(0);
    expect(leapAt(plan, 1, o).z).toBeCloseTo(plan.toZ);
    expect(leapAt(plan, 0.5, o).y).toBeCloseTo(plan.apex);
    expect(leapAt(plan, 0.5, o).z).toBeCloseTo(plan.toZ / 2);
    expect(leapAt(plan, 2, o).z).toBeCloseTo(plan.toZ); // clamped
  });

  it('claws within the radius unless the player is jumping over it', () => {
    expect(clawReaches(1.9, 0, BIPED.leap.radius, BIPED.leap.clearance)).toBe(true);
    expect(clawReaches(2.1, 0, BIPED.leap.radius, BIPED.leap.clearance)).toBe(false);
    expect(clawReaches(1, BIPED.leap.clearance + 0.1, BIPED.leap.radius, BIPED.leap.clearance)).toBe(false);
  });
});
