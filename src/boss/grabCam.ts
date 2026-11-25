import { CRAB } from './tunables';

/**
 * Pure helpers of the claw grab's presentation (spec 35): how the arms are posed in each stage and where the
 * cutscene camera stands. No three.js, so it is unit tested; `index.ts` applies it to the scene.
 */

export interface ClawPose {
  /** 0..1 arms raised high (negative: slammed below the rest pose). */
  claw: number;
  /** 0..1 the arms whip forward and down. */
  strike: number;
  /** 0..1 the arms close inward on the prey. */
  clamp: number;
}

const ease = (x: number): number => Math.min(1, Math.max(0, x));
const easeOut = (x: number): number => 1 - (1 - ease(x)) ** 3;
const smooth = (x: number): number => {
  const u = ease(x);
  return u * u * (3 - 2 * u);
};

/** Telegraph: the arms rise high, `f` 0..1 over the telegraph. */
export function raisePose(f: number): ClawPose {
  return { claw: smooth(f), strike: 0, clamp: 0 };
}

/**
 * The lunge, `u` 0..1: the arms are up at the start and are whipped forward and down in the first
 * `whipPortion` of it (a fast strike), then hold out in front.
 */
export function lungePose(u: number): ClawPose {
  const whip = easeOut(u / CRAB.armPose.whipPortion);
  return { claw: 1, strike: whip, clamp: 0 };
}

/**
 * Carrying: the claws are clamped shut and rise with the prey (height share `h` 0..1); on the slam (`slamU` 0..1)
 * they are thrown down hard.
 */
export function carryPose(h: number, slamU: number): ClawPose {
  const down = easeOut(slamU * 1.6);
  return { claw: 0.35 + 0.65 * ease(h), strike: down, clamp: 1 };
}

/** After the slam or a miss: everything relaxes, `u` 0..1 over the recovery. */
export function recoverPose(u: number, from: ClawPose): ClawPose {
  const k = 1 - smooth(u);
  return { claw: from.claw * k, strike: from.strike * k, clamp: from.clamp * k };
}

/** Moves the cutscene blend (0 = the player's eyes, 1 = the cutscene camera) towards its target. */
export function stepGrabBlend(blend: number, carried: boolean, dt: number): number {
  const G = CRAB.grabCam;
  if (carried) return Math.min(1, blend + dt / G.blendIn);
  return Math.max(0, blend - dt / G.blendOut);
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * The cutscene shot. `focus` is the caught player (at the claw point), `boss` the body centre, `yaw` the boss's
 * yaw (it faces (-sin, -cos)), `carry` seconds into the carry. The camera stands in front of the claws, to the
 * side and above them, so the frame holds the claws, the player and the boss behind; it pushes in a little
 * and follows the lift.
 */
export function grabShot(focus: Vec3, boss: Vec3, yaw: number, k: number, carry: number, pos: Vec3, target: Vec3): void {
  const G = CRAB.grabCam;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const sx = Math.cos(yaw);
  const sz = -Math.sin(yaw);
  const push = smooth(carry / CRAB.grab.liftTime) * G.dolly;
  const dist = (G.distance - push) * k;
  pos.x = focus.x + fx * dist + sx * G.side * k;
  pos.z = focus.z + fz * dist + sz * G.side * k;
  pos.y = focus.y + G.height * k;
  target.x = focus.x * 0.7 + boss.x * 0.3;
  target.y = focus.y * 0.7 + boss.y * 0.3;
  target.z = focus.z * 0.7 + boss.z * 0.3;
}
