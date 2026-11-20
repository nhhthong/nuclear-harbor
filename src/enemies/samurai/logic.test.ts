import { describe, expect, it } from 'vitest';
import { coneHit, dashUsesDue, deflectedDamage, distanceToSegment, pickDashPoint, crescentHit } from './logic';
import { crescentRibbon, crescentShape } from './Samurai';
import { SAMURAI } from './tunables';

describe('samurai logic', () => {
  it('is twice a regular robot', () => {
    expect(SAMURAI.hp).toBe(300);
    expect(SAMURAI.leap.damage).toBe(24);
  });

  it('deflects frontal damage only while spinning', () => {
    expect(deflectedDamage(100, 0, true)).toBeCloseTo(100 * (1 - SAMURAI.spin.reduction));
    expect(deflectedDamage(100, Math.PI, true)).toBe(100);
    expect(deflectedDamage(100, 0, false)).toBe(100);
  });

  it('cone hit respects radius, angle and height', () => {
    expect(coneHit(2, 0.2, 0, 3, 1, 1.8)).toBe(true);
    expect(coneHit(4, 0.2, 0, 3, 1, 1.8)).toBe(false);
    expect(coneHit(2, 2.5, 0, 3, 1, 1.8)).toBe(false);
    expect(coneHit(2, 0.2, 2.2, 3, 1, 1.8)).toBe(false);
  });

  it('measures the distance to a dash segment', () => {
    expect(distanceToSegment(5, 2, 0, 0, 10, 0)).toBeCloseTo(2);
    expect(distanceToSegment(-3, 0, 0, 0, 10, 0)).toBeCloseTo(3);
    expect(distanceToSegment(1, 1, 4, 4, 4, 4)).toBeCloseTo(Math.hypot(3, 3));
  });

  it('spends the dash at 70% and 35% HP, twice at most', () => {
    expect(dashUsesDue(1)).toBe(0);
    expect(dashUsesDue(0.7)).toBe(1);
    expect(dashUsesDue(0.5)).toBe(1);
    expect(dashUsesDue(0.2)).toBe(2);
    expect(SAMURAI.dash.uses).toBe(2);
  });

  it('picks dash points inside the area, far enough, on a clear line', () => {
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const out = { x: 0, z: 0 };
    for (let i = 0; i < 50; i++) {
      pickDashPoint(0, 0, 3, 3, rand, () => true, out);
      expect(Math.hypot(out.x - 3, out.z - 3)).toBeLessThanOrEqual(SAMURAI.dash.radius + 1e-6);
      expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(SAMURAI.dash.minLength);
    }
    // nothing reachable: stays where it is
    pickDashPoint(1, 2, 3, 3, rand, () => false, out);
    expect(out).toEqual({ x: 1, z: 2 });
  });
});

describe('crescent wave (skill 4)', () => {
  const w = SAMURAI.wave;
  it('hits a player standing in its path during the step, not one beside it, behind it or high above', () => {
    // flying north (-z) from z = 0 to z = -0.2
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, 0, -0.1, 0)).toBe(true);
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, w.hitHalfWidth + 0.3, -0.1, 0)).toBe(true); // capsule touches the horn
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, w.hitHalfWidth + 0.5, -0.1, 0)).toBe(false); // stepped aside
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, 0, 2, 0)).toBe(false); // behind it
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, 0, -3, 0)).toBe(false); // not reached yet
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, 0, -0.1, 1.8)).toBe(true); // a double jump does not clear it
    expect(crescentHit(0, 0, 0, -0.2, 0, -1, 0, -0.1, w.height)).toBe(false);
  });

  it('is slower than a bullet and hits harder than the quick cut', () => {
    expect(w.speed).toBeLessThan(20);
    expect(w.damage).toBeGreaterThan(SAMURAI.cut.damage);
    expect(w.damage).toBeGreaterThan(SAMURAI.leap.damage);
  });
});

describe('crescent shape', () => {
  it('stands upright from the ground to its height and bulges sideways by the given amount', () => {
    const pts = crescentShape(2.9, 0.75, 0.34).getPoints();
    const ys = pts.map((p) => p.y);
    const xs = pts.map((p) => p.x);
    expect(Math.min(...ys)).toBeCloseTo(0, 5);
    expect(Math.max(...ys)).toBeCloseTo(2.9, 5);
    expect(Math.max(...xs)).toBeCloseTo(0.75, 2);
    expect(Math.min(...xs)).toBeGreaterThan(-0.01); // horns meet at x = 0
  });
});

describe('crescent ribbon', () => {
  it('runs horn to horn (u 0..1) from the inner arc (v 0) to the cutting edge (v 1)', () => {
    const g = crescentRibbon(2.9, 0.75, 0.55, 10);
    const uv = g.getAttribute('uv');
    const pos = g.getAttribute('position');
    expect(pos.count).toBe(22);
    expect(g.getIndex()!.count).toBe(60);
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      // the edge vertex of each slice lies outside its inner vertex
      if (i % 2 === 1) expect(pos.getX(i)).toBeGreaterThanOrEqual(pos.getX(i - 1) - 1e-6);
    }
    g.dispose();
  });
});
