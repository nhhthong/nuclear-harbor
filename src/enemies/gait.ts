/**
 * Two-legged walk cycle shared by the bipeds (samurai, army mech). Pure functions: the class feeds the distance it really
 * travelled, so the feet keep pace with the ground instead of sliding.
 */

export interface LegPose {
  /** Hip angle (rad): positive swings the leg forward. */
  hip: number;
  /** Knee angle (rad): negative folds the shin back. */
  knee: number;
}

export interface GaitPose {
  left: LegPose;
  right: LegPose;
  /** Vertical offset of the pelvis (m, <= 0): lowest when both feet are apart. */
  bob: number;
  /** Side lean of the body over the standing leg and twist of the torso against the legs (rad). */
  sway: number;
  twist: number;
}

/** Hip swing amplitude (rad) for a speed fraction 0..1 (walk to run). */
export function hipAmplitude(speedFraction: number): number {
  const f = Math.max(0, Math.min(1, speedFraction));
  return 0.3 + 0.36 * f;
}

/**
 * Ground covered by one full cycle (two steps): a foot sweeps 2 * L * sin(A) under the hip while it
 * stands, and there are two stance sweeps per cycle.
 */
export function strideLength(legLength: number, speedFraction: number): number {
  return 4 * legLength * Math.sin(hipAmplitude(speedFraction));
}

function legAt(phase: number, amp: number, lift: number, out: LegPose): void {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  // stance: the leg sweeps back almost straight; swing: it comes forward with the knee folded
  const swing = Math.max(0, c);
  out.hip = amp * s + lift * swing * 0.35;
  out.knee = -(0.12 + lift * swing * swing + 0.1 * Math.max(0, -s) * amp);
}

/**
 * Pose at cycle `phase` (rad). `amount` 0..1 fades the cycle in and out so starts and stops are
 * smooth; `speedFraction` 0..1 widens the stride and raises the knees from a walk to a run.
 */
export function gaitPose(phase: number, amount: number, speedFraction: number, legLength: number, out: GaitPose): GaitPose {
  const f = Math.max(0, Math.min(1, speedFraction));
  const k = Math.max(0, Math.min(1, amount));
  const amp = hipAmplitude(f) * k;
  const lift = (0.7 + 0.55 * f) * k;
  legAt(phase, amp, lift, out.left);
  legAt(phase + Math.PI, amp, lift, out.right);
  // the pelvis is highest when a leg passes under the body and lowest at foot strike
  out.bob = -legLength * (1 - Math.cos(amp)) * Math.abs(Math.sin(phase)) - 0.02 * k;
  out.sway = 0.045 * k * Math.cos(phase);
  out.twist = 0.1 * k * Math.sin(phase);
  return out;
}

export function createGaitPose(): GaitPose {
  return { left: { hip: 0, knee: 0 }, right: { hip: 0, knee: 0 }, bob: 0, sway: 0, twist: 0 };
}

/** Moves `current` towards `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  return Math.abs(d) <= maxDelta ? target : current + Math.sign(d) * maxDelta;
}
