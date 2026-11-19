import { describe, expect, it } from 'vitest';
import { createPose } from './ScorpionModel';
import { GAIT, GLOW, LEGS, TAIL_CURL, createJoints, solveJoints } from './scorpionPose';

const solve = (patch: Partial<ReturnType<typeof createPose>>) => solveJoints({ ...createPose(), ...patch }, createJoints());

describe('authored scorpion joints', () => {
  it('has four legs in two trot sets, one pair per side', () => {
    expect(LEGS).toHaveLength(4);
    expect(LEGS.filter((l) => l.side < 0)).toHaveLength(2);
    expect(LEGS.filter((l) => l.front)).toHaveLength(2);
    // diagonal pairs share a set
    expect(LEGS[0]?.setA).toBe(LEGS[3]?.setA);
    expect(LEGS[1]?.setA).toBe(LEGS[2]?.setA);
    expect(LEGS[0]?.setA).not.toBe(LEGS[1]?.setA);
  });

  it('stands still at rest: no leg or tail motion, no lean', () => {
    const j = solve({ time: 0, tailLash: 0 });
    expect(j.legYaw.every((v) => v === 0)).toBe(true);
    expect(j.legRoll.every((v) => v === 0)).toBe(true);
    expect(j.tail.every((v) => v === 0)).toBe(true);
    expect(Math.abs(j.spinePitch)).toBe(0);
  });

  it('walks: diagonal legs swing together and opposite to the other pair, mirrored sides move the same way', () => {
    const j = solve({ walk: 1, walkPhase: 0.9 });
    // forward swing is a positive yaw on the right (+X) and a negative one on the left
    const fwd = (i: number): number => (LEGS[i]?.side ?? 1) * (j.legYaw[i] ?? 0);
    expect(fwd(0)).toBeCloseTo(fwd(3), 9);
    expect(fwd(1)).toBeCloseTo(fwd(2), 9);
    expect(Math.sign(fwd(0))).toBe(-Math.sign(fwd(1)));
    expect(Math.max(...j.legYaw.map(Math.abs))).toBeLessThanOrEqual(GAIT.swing + 1e-9);
  });

  it('lifts a foot only while it swings forward and never pushes a foot into the ground', () => {
    for (let p = 0; p < Math.PI * 2; p += 0.1) {
      const j = solve({ walk: 1, walkPhase: p });
      for (let i = 0; i < 4; i++) {
        const side = LEGS[i]?.side ?? 1;
        // roll about Z: a right leg lifts with a positive roll, a left leg with a negative one
        expect(side * (j.legRoll[i] ?? 0)).toBeGreaterThanOrEqual(-1e-9);
        expect(side * (j.legRoll[i] ?? 0)).toBeLessThanOrEqual(GAIT.lift + 1e-9);
      }
    }
  });

  it('scales the walk with the walk amount', () => {
    const half = solve({ walk: 0.5, walkPhase: 0.7 });
    const full = solve({ walk: 1, walkPhase: 0.7 });
    expect(Math.abs(half.legYaw[0] ?? 0)).toBeCloseTo(Math.abs(full.legYaw[0] ?? 0) / 2, 9);
  });

  it('crouches: body and hips drop together, legs splay outwards', () => {
    const j = solve({ crouch: 1 });
    expect(j.hipDrop).toBeCloseTo(-GAIT.drop, 9);
    expect(j.spineY).toBeCloseTo(-GAIT.drop, 3);
    for (let i = 0; i < 4; i++) expect((LEGS[i]?.side ?? 1) * (j.legRoll[i] ?? 0)).toBeCloseTo(GAIT.splay, 9);
  });

  it('leans the head down for a positive pitch (head is -Z: negative rotation about X)', () => {
    expect(solve({ pitch: 0.1 }).spinePitch).toBeCloseTo(-0.1, 9);
  });

  it('tail: a strike curls forward and down, a wind-up and an aim curl the other way, per segment', () => {
    const strike = solve({ tailStrike: 1, tailLash: 0 });
    const wind = solve({ tailStrike: -1, tailLash: 0 });
    const aim = solve({ tailAim: 1, tailLash: 0 });
    for (let i = 0; i < 4; i++) {
      expect(strike.tail[i]).toBeCloseTo(TAIL_CURL.strike[i] ?? 0, 9);
      expect(strike.tail[i]).toBeLessThan(0);
      expect(wind.tail[i]).toBeGreaterThan(0);
      expect(aim.tail[i]).toBeGreaterThan(0);
    }
  });

  it('crossed claws (shield pose) sweep the front legs forward, rear legs stay put', () => {
    const j = solve({ claws: -0.85 });
    expect(Math.abs(j.legYaw[0] ?? 0)).toBeGreaterThan(0.2);
    expect(Math.abs(j.legYaw[2] ?? 0)).toBeGreaterThan(0.2);
    expect(Math.abs(j.legYaw[1] ?? 1)).toBe(0);
    expect(Math.abs(j.legYaw[3] ?? 1)).toBe(0);
    // both front legs reach forward: right +, left -
    expect(j.legYaw[0]).toBeLessThan(0);
    expect(j.legYaw[2]).toBeGreaterThan(0);
  });

  it('glow: idle is dim, telegraph and venom charge are brighter, a flicker only dims', () => {
    const idle = solve({ glow: 1.1 }).glow;
    const telegraph = solve({ glow: 4.5 }).glow;
    expect(solve({ glow: 9, charge: 1 }).glow).toBe(GLOW.max);
    const charged = solve({ glow: 1.5, charge: 1 }).glow;
    expect(idle).toBeCloseTo(1.1 * GLOW.scale, 9);
    expect(idle).toBeLessThan(1);
    expect(telegraph).toBeGreaterThan(2 * idle);
    expect(telegraph).toBeLessThanOrEqual(GLOW.max);
    expect(charged).toBeGreaterThan(idle * 2);
    const flick = solve({ glow: 1.1, flicker: 1, time: 0.37 }).glow;
    expect(flick).toBeLessThanOrEqual(idle + 1e-9);
    expect(flick).toBeGreaterThanOrEqual(0);
  });
});
