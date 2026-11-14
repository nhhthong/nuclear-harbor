import { describe, expect, it } from 'vitest';
import { approachHorizontal, canSprint, clampPitch, desiredVelocity } from './movement';

const out = () => ({ x: 0, z: 0 });

describe('desiredVelocity', () => {
  it('AC1: forward at yaw 0 goes -Z at the given speed', () => {
    const v = desiredVelocity(0, 1, 0, 5, out());
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-5);
  });

  it('AC1: diagonals are not faster', () => {
    const v = desiredVelocity(1, 1, 0.7, 5, out());
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(5);
  });

  it('strafes right at yaw 0 along +X and follows yaw', () => {
    expect(desiredVelocity(1, 0, 0, 5, out()).x).toBeCloseTo(5);
    const v = desiredVelocity(0, 1, Math.PI / 2, 5, out());
    expect(v.x).toBeCloseTo(-5);
    expect(v.z).toBeCloseTo(0);
  });

  it('no input gives zero', () => {
    expect(desiredVelocity(0, 0, 1, 5, out())).toEqual({ x: 0, z: 0 });
  });
});

describe('approachHorizontal', () => {
  it('accelerates by accel*dt and snaps to the target', () => {
    const v = out();
    approachHorizontal(v, { x: 0, z: -5 }, 60, 50, 0.01, 1);
    expect(v.z).toBeCloseTo(-0.6);
    approachHorizontal(v, { x: 0, z: -5 }, 60, 50, 1, 1);
    expect(v.z).toBe(-5);
  });

  it('decelerates when no target and scales with air control', () => {
    const v = { x: 4, z: 0 };
    approachHorizontal(v, { x: 0, z: 0 }, 60, 50, 0.01, 0.5);
    expect(v.x).toBeCloseTo(3.75);
  });
});

describe('pitch and sprint', () => {
  it('AC4: clamps pitch to the maximum', () => {
    const max = (89 * Math.PI) / 180;
    expect(clampPitch(3, 89)).toBeCloseTo(max);
    expect(clampPitch(-3, 89)).toBeCloseTo(-max);
    expect(clampPitch(0.2, 89)).toBe(0.2);
  });

  it('sprints only when grounded, forward and held', () => {
    expect(canSprint(true, 1, true)).toBe(true);
    expect(canSprint(false, 1, true)).toBe(false);
    expect(canSprint(false, 1, true, true)).toBe(true);
    expect(canSprint(false, 0, true, true)).toBe(false);
    expect(canSprint(true, 0, true)).toBe(false);
    expect(canSprint(true, -1, true)).toBe(false);
    expect(canSprint(true, 1, false)).toBe(false);
  });
});
