/**
 * Pure joint maths of the authored scorpion (spec 28). The game keeps one pose description for both looks
 * (`ScorpionPose` in ScorpionModel.ts); this file turns it into rotations of the GLB nodes: four legs
 * (hip pivots), a four-segment tail chain and a body lean. Angles are in radians about the node's own
 * axes in the model frame (+Y up, head towards -Z, +X to the right of the scorpion).
 */
export interface PoseInput {
  walkPhase: number;
  walk: number;
  time: number;
  tailStrike: number;
  tailAim: number;
  tailLash: number;
  claws: number;
  pitch: number;
  crouch: number;
  glow: number;
  flicker: number;
  charge: number;
}

export interface LegInfo {
  /** +1 right (+X), -1 left. */
  side: number;
  front: boolean;
  /** Trot set: front-left with rear-right, front-right with rear-left. */
  setA: boolean;
}

/** Same order as `LEG_NODES`: L0, L1, R0, R1 (0 = front). */
export const LEGS: readonly LegInfo[] = [
  { side: -1, front: true, setA: true },
  { side: -1, front: false, setA: false },
  { side: 1, front: true, setA: false },
  { side: 1, front: false, setA: true },
];

export const GAIT = {
  /** Hip swing about the vertical axis at full walk (rad). */
  swing: 0.5,
  /** Roll that lifts a foot on the way forward (rad). */
  lift: 0.3,
  /** Legs splay outwards while crouching (rad per unit of crouch) and the body drops (m per unit). */
  splay: 0.2,
  drop: 0.3,
  /** Bob of the body with every step (m). */
  bob: 0.04,
} as const;

/** Tail curl per segment (rad about X): negative = forward and down, positive = back and up. */
export const TAIL_CURL = {
  strike: [-0.4, -0.3, -0.15, -0.05],
  wind: [0.18, 0.22, 0.2, 0.1],
  aim: [0.35, 0.35, 0.3, 0.25],
} as const;

/** Emissive intensity: the glow of the procedural model scaled down so the idle accents stay thin. */
export const GLOW = { scale: 0.62, chargeBoost: 3, max: 1.7 } as const;

export interface Joints {
  /** Body lean about X (rad) and vertical offset (m) of the spine group (body and tail chain). */
  spinePitch: number;
  spineY: number;
  /** Vertical offset of the hips (m): they follow a crouch but not the breathing. */
  hipDrop: number;
  tail: [number, number, number, number];
  legYaw: [number, number, number, number];
  legRoll: [number, number, number, number];
  glow: number;
}

export function createJoints(): Joints {
  return { spinePitch: 0, spineY: 0, hipDrop: 0, tail: [0, 0, 0, 0], legYaw: [0, 0, 0, 0], legRoll: [0, 0, 0, 0], glow: 0 };
}

/** Fills `out` from the pose. Nothing is allocated. */
export function solveJoints(pose: PoseInput, out: Joints): Joints {
  const t = pose.time;
  const breathe = Math.sin(t * 2.4) * 0.025;
  const stepBob = Math.abs(Math.sin(pose.walkPhase)) * GAIT.bob * pose.walk;
  out.hipDrop = -pose.crouch * GAIT.drop;
  out.spineY = breathe + stepBob + out.hipDrop;
  // positive pose.pitch lowers the head (head = -Z): that is a negative rotation about X
  out.spinePitch = -pose.pitch;

  const clawsUp = Math.max(0, pose.claws);
  const cross = Math.max(0, -pose.claws);
  for (let i = 0; i < LEGS.length; i++) {
    const info = LEGS[i] as LegInfo;
    const p = pose.walkPhase + (info.setA ? 0 : Math.PI);
    const swing = Math.sin(p) * GAIT.swing * pose.walk;
    const up = Math.max(0, Math.cos(p)) * GAIT.lift * pose.walk;
    let yaw = info.side * swing;
    let roll = info.side * (up + pose.crouch * GAIT.splay);
    if (info.front) {
      // the claw pose of the game: front legs rise and reach forward; crossed (shield) they sweep in front
      yaw += info.side * (clawsUp * 0.18 + cross * 0.42);
      roll += info.side * (clawsUp * 0.3 + cross * 0.12);
    }
    out.legYaw[i] = yaw;
    out.legRoll[i] = roll;
  }

  const strike = Math.max(0, pose.tailStrike);
  const wind = Math.max(0, -pose.tailStrike);
  for (let i = 0; i < 4; i++) {
    const sway = Math.sin(t * 1.8 - i * 0.7) * 0.035 * pose.tailLash;
    out.tail[i] =
      sway + (TAIL_CURL.strike[i] as number) * strike + (TAIL_CURL.wind[i] as number) * wind + (TAIL_CURL.aim[i] as number) * pose.tailAim;
  }

  const flick = pose.flicker > 0 ? 1 - pose.flicker * (0.5 + 0.5 * Math.sin(t * 61) * Math.sin(t * 23)) : 1;
  // capped: above about 1.7 the thin accents turn white instead of brighter green
  out.glow = Math.min(GLOW.max, (pose.glow + pose.charge * GLOW.chargeBoost) * GLOW.scale) * flick;
  return out;
}
