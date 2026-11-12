import { describe, expect, it } from 'vitest';
import { angleBetween, bestInCone } from './aim';

const eye = { x: 0, y: 0, z: 0 };
const fwd = { x: 0, y: 0, z: -1 };

describe('aim assist', () => {
  it('computes the angle between the view and a point', () => {
    expect(angleBetween(eye, fwd, { x: 0, y: 0, z: -10 })).toBeCloseTo(0, 6);
    expect(angleBetween(eye, fwd, { x: 10, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2, 6);
  });

  it('picks the candidate closest to the view axis inside the cone', () => {
    const cands = [
      { id: 'a', position: { x: 1, y: 0, z: -20 } }, // ~2.86 deg
      { id: 'b', position: { x: 0.5, y: 0, z: -20 } }, // ~1.43 deg
      { id: 'c', position: { x: 5, y: 0, z: -20 } }, // 14 deg
    ];
    expect(bestInCone(eye, fwd, cands, 3 * (Math.PI / 180))?.id).toBe('b');
  });

  it('returns null when nothing is inside the cone', () => {
    const cands = [{ id: 'c', position: { x: 5, y: 0, z: -20 } }];
    expect(bestInCone(eye, fwd, cands, 3 * (Math.PI / 180))).toBeNull();
  });

  it('ignores candidates behind the player', () => {
    const cands = [{ id: 'd', position: { x: 0, y: 0, z: 20 } }];
    expect(bestInCone(eye, fwd, cands, 3 * (Math.PI / 180))).toBeNull();
  });
});
