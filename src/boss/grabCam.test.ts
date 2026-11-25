import { describe, expect, it } from 'vitest';
import { carryPose, grabShot, lungePose, raisePose, recoverPose, stepGrabBlend } from './grabCam';
import { CRAB } from './tunables';

describe('claw poses (spec 35)', () => {
  it('the arms rise smoothly to full height during the telegraph', () => {
    expect(raisePose(0).claw).toBe(0);
    expect(raisePose(1).claw).toBe(1);
    let prev = -1;
    for (let f = 0; f <= 1; f += 0.05) {
      const p = raisePose(f);
      expect(p.claw).toBeGreaterThanOrEqual(prev);
      expect(p.strike).toBe(0);
      expect(p.clamp).toBe(0);
      prev = p.claw;
    }
  });

  it('the lunge starts with the arms up and whips them forward within the first part of it', () => {
    expect(lungePose(0)).toEqual({ claw: 1, strike: 0, clamp: 0 });
    expect(lungePose(CRAB.armPose.whipPortion).strike).toBeCloseTo(1, 9);
    expect(lungePose(1).strike).toBe(1);
    // the whip is fast: half of it is done well before half of the whip portion has passed
    expect(lungePose(CRAB.armPose.whipPortion * 0.3).strike).toBeGreaterThan(0.6);
  });

  it('the carry clamps shut, rises with the prey and throws the arms down on the slam', () => {
    expect(carryPose(0, 0).clamp).toBe(1);
    expect(carryPose(0, 0).claw).toBeCloseTo(0.35, 9);
    expect(carryPose(1, 0).claw).toBe(1);
    expect(carryPose(1, 0).strike).toBe(0);
    expect(carryPose(1, 1).strike).toBe(1);
    expect(carryPose(1, 0.2).strike).toBeGreaterThan(carryPose(1, 0).strike);
  });

  it('after the slam the pose relaxes to nothing', () => {
    const from = carryPose(1, 1);
    expect(recoverPose(0, from)).toEqual(from);
    const end = recoverPose(1, from);
    expect(end.claw).toBeCloseTo(0, 9);
    expect(end.strike).toBeCloseTo(0, 9);
    expect(end.clamp).toBeCloseTo(0, 9);
  });
});

describe('claw grab cutscene camera (spec 35)', () => {
  it('blends in over blendIn while carried and out over blendOut after', () => {
    const G = CRAB.grabCam;
    let b = 0;
    for (let t = 0; t < G.blendIn + 0.01; t += 0.01) b = stepGrabBlend(b, true, 0.01);
    expect(b).toBe(1);
    expect(stepGrabBlend(b, true, 5)).toBe(1);
    for (let t = 0; t < G.blendOut / 2; t += 0.01) b = stepGrabBlend(b, false, 0.01);
    expect(b).toBeGreaterThan(0.3);
    expect(b).toBeLessThan(0.7);
    expect(stepGrabBlend(b, false, 5)).toBe(0);
  });

  const focus = { x: 0, y: 5, z: -10 };
  const boss = { x: 0, y: 5, z: -3 };
  const pos = { x: 0, y: 0, z: 0 };
  const target = { x: 0, y: 0, z: 0 };

  it('stands in front of the claws, to the side and above them, and looks between the prey and the boss', () => {
    // yaw 0: the boss faces -Z, so "in front" is further to -Z
    grabShot(focus, boss, 0, 1, 0, pos, target);
    expect(pos.z).toBeLessThan(focus.z - CRAB.grabCam.distance + 1);
    expect(Math.abs(pos.x)).toBeCloseTo(CRAB.grabCam.side, 6);
    expect(pos.y).toBeCloseTo(focus.y + CRAB.grabCam.height, 6);
    expect(target.z).toBeGreaterThan(focus.z);
    expect(target.z).toBeLessThan(boss.z);
  });

  it('follows the lift, pushes in over the carry and scales with the boss size', () => {
    grabShot(focus, boss, 0, 1, 0, pos, target);
    const far = Math.hypot(pos.x - focus.x, pos.z - focus.z);
    grabShot(focus, boss, 0, 1, CRAB.grab.liftTime, pos, target);
    const near = Math.hypot(pos.x - focus.x, pos.z - focus.z);
    expect(near).toBeLessThan(far);
    grabShot({ ...focus, y: 9 }, boss, 0, 1, 0, pos, target);
    expect(pos.y).toBeCloseTo(9 + CRAB.grabCam.height, 6);
    grabShot(focus, boss, 0, 0.5, 0, pos, target);
    expect(Math.hypot(pos.x - focus.x, pos.z - focus.z)).toBeCloseTo(far * 0.5, 6);
  });

  it('turns with the boss yaw', () => {
    grabShot(focus, boss, Math.PI / 2, 1, 0, pos, target); // faces -X
    expect(pos.x).toBeLessThan(focus.x - CRAB.grabCam.distance + 1);
  });

  it('the cutscene has a catch shake, a slam shake and an overlay peak', () => {
    const G = CRAB.grabCam;
    expect(G.shakeSlam).toBeGreaterThanOrEqual(G.shakeCatch);
    expect(G.flashCatch.opacity).toBeGreaterThan(0);
    expect(G.flashSlam.seconds).toBeGreaterThan(0);
    expect(G.barsFraction).toBeLessThan(0.2);
  });
});
