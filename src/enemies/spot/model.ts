import { BufferGeometry, Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { box, cylX, cylZ, Parts, rod, sphere, sweptLink, type V3 } from '../duck/modelKit';
import { SPOT } from './tunables';

/** "Hound" palette: gunmetal armour with hazard-yellow accents (names kept from the reference Spot). */
export const SPOT_COLORS = {
  yellow: 0x55616a,
  yellowSide: 0x3a444c,
  yellowHighlight: 0xf2b21a,
  accent: 0xf2b21a,
  red: 0xa8231c,
  dark: 0x202326,
  black: 0x111416,
  graphite: 0x3f4547,
  graphiteLight: 0x737979,
  silver: 0xb9c0c0,
  rubber: 0x171a1a,
  lens: 0x0a141a,
} as const;

export interface SpotModel {
  body: BufferGeometry;
  /** Diagonal leg pairs, authored around the shoulder axis (mesh sits at `legPivot`). */
  legsA: BufferGeometry;
  legsB: BufferGeometry;
  legPivot: Vector3;
  /** Emissive optics (corner lamps, lens stack, visor strip). */
  lamps: BufferGeometry;
  far: BufferGeometry;
}

const C = SPOT_COLORS;
const SHOULDER_Y = 1.76;

function mk(pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): Matrix4 {
  return new Matrix4().compose(
    new Vector3(pos[0], pos[1], pos[2]),
    new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2])),
    new Vector3(scale[0], scale[1], scale[2]),
  );
}

interface LegDef {
  side: 1 | -1;
  front: boolean;
  z: number;
  zStep: number;
}

const LEGS: readonly LegDef[] = [
  { side: 1, front: true, z: 0.77, zStep: 0.17 },
  { side: -1, front: true, z: 0.77, zStep: 0.17 },
  { side: 1, front: false, z: -0.78, zStep: -0.15 },
  { side: -1, front: false, z: -0.78, zStep: -0.15 },
];

function addLeg(p: Parts, leg: LegDef): void {
  const s = leg.side * 0.78;
  const z = leg.z;
  const zs = leg.zStep;
  const kneeZ = z + zs;
  const wheelZ = z + zs + (leg.front ? 0.13 : -0.11);
  p.add(rod([s * 0.65, 1.67, z - 0.015], [s * 0.78, 1.3, z + zs * 0.46], 0.085, 0.065, 8), C.dark);
  p.add(rod([s * 0.62, 1.69, z - 0.08], [s * 0.83, 1.27, z + zs * 0.48], 0.026, 0.022, 6), C.silver);
  p.add(rod([s * 0.83, 1.28, z + zs * 0.48], [s * 0.91, 1.13, z + zs * 0.85], 0.035, 0.028, 6), C.graphiteLight);
  p.add(
    sweptLink(
      [
        [s * 0.75, 1.78, z],
        [s * 0.88, 1.7, z + zs * 0.12],
        [s * 0.98, 1.43, z + zs * 0.48],
        [s * 1.0, 1.1, z + zs],
      ],
      [0.165, 0.075, 0.018],
      [0.145, 0.072, 0.012],
      10,
      12,
    ),
    C.yellow,
  );
  p.add(sphere(0.145, 10, 7), C.yellowHighlight, [s * 0.91, 1.57, z + zs * 0.36], [0, 0, 0], [1.08, 1.18, 0.82]);
  p.add(cylX(0.085, 0.17, 12), C.dark, [s * 1.0, 1.09, kneeZ]);
  p.add(cylX(0.057, 0.19, 10), C.silver, [s * 1.055, 1.09, kneeZ]);
  p.add(sphere(0.12, 10, 7), C.dark, [s * 0.99, 1.08, kneeZ], [0, 0, 0], [1, 0.92, 0.92]);
  p.add(cylX(0.105, 0.18, 12), C.graphite, [s * 1.02, 1.08, kneeZ]);
  p.add(cylX(0.07, 0.2, 10), C.silver, [s * 1.09, 1.08, kneeZ]);
  p.add(
    sweptLink(
      [
        [s * 1.0, 1.02, kneeZ],
        [s * 1.055, 0.78, kneeZ + (leg.front ? 0.035 : -0.025)],
        [s * 1.11, 0.48, wheelZ + (leg.front ? 0.12 : -0.1)],
        [s * 1.06, 0.2, wheelZ],
      ],
      [0.082, 0.06, 0.01],
      [0.046, 0.035, 0.004],
      8,
      12,
    ),
    C.graphite,
  );
  p.add(rod([s * 0.94, 0.96, kneeZ - 0.035], [s * 0.97, 0.55, wheelZ + 0.08], 0.028, 0.022, 6), C.silver);
  p.add(sphere(0.075, 8, 6), C.graphiteLight, [s * 1.06, 0.23, wheelZ], [0, 0, 0], [1, 0.65, 0.72]);
  // wheel foot: rubber tyre, graphite and silver caps
  const wx = s * 1.05;
  p.add(cylX(0.135, 0.19, 16), C.rubber, [wx, 0.145, wheelZ]);
  p.add(cylX(0.078, 0.215, 12), C.graphite, [wx + leg.side * 0.015, 0.145, wheelZ]);
  p.add(cylX(0.045, 0.228, 10), C.silver, [wx + leg.side * 0.02, 0.145, wheelZ]);
  p.add(cylX(0.022, 0.235, 8), C.dark, [wx + leg.side * 0.025, 0.145, wheelZ]);
  // knee guard with a hazard edge, shin blade and a second hydraulic ram
  p.add(box(0.05, 0.24, 0.26, 0.03), C.yellowSide, [s * 1.15, 1.1, kneeZ], [0, 0, leg.side * -0.12]);
  p.add(box(0.054, 0.045, 0.27, 0.015), C.accent, [s * 1.152, 1.2, kneeZ], [0, 0, leg.side * -0.12]);
  p.add(box(0.035, 0.46, 0.11, 0.02), C.yellow, [s * 1.14, 0.62, wheelZ + (leg.front ? 0.2 : -0.18)], [leg.front ? -0.3 : 0.3, 0, 0]);
  p.add(rod([s * 0.86, 1.52, z + zs * 0.2], [s * 1.02, 1.16, kneeZ + (leg.front ? -0.1 : 0.1)], 0.03, 0.03, 6), C.dark);
  p.add(rod([s * 0.9, 1.42, z + zs * 0.3], [s * 1.02, 1.16, kneeZ + (leg.front ? -0.1 : 0.1)], 0.017, 0.017, 6), C.silver);
  // mud guard over the wheel
  p.add(box(0.2, 0.03, 0.3, 0.012), C.yellowSide, [wx, 0.31, wheelZ]);
}

/**
 * Builds every Spot geometry once in the reference's units and bakes scale, floor offset and the turn
 * (the reference faces +Z, the game faces -Z). Legs are merged per diagonal pair for a trot with 2 meshes.
 */
export function buildSpotModel(): SpotModel {
  const s = SPOT.modelScale;
  const world = new Matrix4()
    .makeRotationY(Math.PI)
    .multiply(new Matrix4().makeTranslation(0, -SPOT.centerHeight, 0))
    .multiply(new Matrix4().makeScale(s, s, s));
  const id = new Matrix4();

  const body = new Parts();
  body.base = id;
  body.add(box(0.84, 0.52, 2.72, 0.145), C.dark, [0, 1.9, -0.02]);
  body.add(box(0.82, 0.5, 2.68, 0.14), C.yellow, [0, 1.94, -0.02]);
  body.add(box(0.66, 0.045, 2.25, 0.035), C.yellowHighlight, [0, 2.205, -0.04]);
  body.add(box(0.48, 0.018, 1.2), C.yellowSide, [0, 2.232, -0.4]);
  // nose module
  body.add(box(0.9, 0.51, 0.34, 0.105), C.yellow, [0, 1.91, 1.4]);
  body.add(box(0.72, 0.35, 0.055, 0.045), C.dark, [0, 1.89, 1.595]);
  body.add(box(0.43, 0.29, 0.018), C.black, [-0.1, 1.89, 1.632]);
  for (let i = 0; i < 5; i++) body.add(box(0.012, 0.25, 0.012), C.graphite, [-0.29 + i * 0.075, 1.89, 1.646]);
  body.add(box(0.17, 0.32, 0.035, 0.035), C.black, [-0.34, 1.9, 1.638]);
  body.add(box(0.68, 0.052, 0.09, 0.025), C.yellowSide, [0, 1.62, 1.47]);
  for (const x of [-0.39, 0.39]) body.add(box(0.075, 0.065, 0.035, 0.02), C.dark, [x, 1.67, 1.56]);
  // side rails, insets and hinge mounts
  for (const side of [-1, 1]) {
    body.add(box(0.028, 0.11, 1.62, 0.022), C.black, [side * 0.418, 1.8, -0.02], [0, 0, side * 0.035]);
    body.add(box(0.022, 0.075, 1.22, 0.016), C.yellowSide, [side * 0.435, 1.83, -0.03], [0, 0, side * 0.035]);
    body.add(box(0.026, 0.17, 0.46, 0.028), C.dark, [side * 0.421, 1.99, -0.66]);
    for (const z of [0.82, -0.82]) {
      body.add(cylX(0.15, 0.09, 14), C.dark, [side * 0.445, 1.76, z]);
      body.add(cylX(0.12, 0.13, 14), C.graphite, [side * 0.505, 1.76, z]);
      body.add(cylX(0.083, 0.14, 12), C.silver, [side * 0.56, 1.76, z]);
      body.add(cylX(0.044, 0.15, 10), C.dark, [side * 0.585, 1.76, z]);
    }
  }
  // roof service cover
  body.add(box(0.34, 0.035, 0.3, 0.04), C.dark, [0, 2.22, -0.92]);
  body.add(box(0.26, 0.022, 0.22, 0.025), C.graphite, [0, 2.247, -0.92]);
  // ---- "Hound" armour kit --------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // angled pauldrons over the four shoulder joints, hazard strip on the lower edge
    for (const z of [0.82, -0.82]) {
      body.add(box(0.06, 0.4, 0.66, 0.03), C.yellow, [side * 0.69, 2.02, z], [0, 0, side * -0.38]);
      body.add(box(0.064, 0.05, 0.6, 0.015), C.accent, [side * 0.755, 1.87, z], [0, 0, side * -0.38]);
      for (const bz of [-0.24, 0.24]) body.add(cylX(0.022, 0.08, 6), C.silver, [side * 0.7, 2.06, z + bz], [0, 0, side * -0.38]);
    }
    // ammunition drum and feed chute into the back gun
    body.add(cylX(0.19, 0.16, 14), C.dark, [side * 0.5, 1.98, 0.02]);
    body.add(cylX(0.14, 0.19, 12), C.graphite, [side * 0.52, 1.98, 0.02]);
    body.add(cylX(0.05, 0.21, 8), C.accent, [side * 0.53, 1.98, 0.02]);
    body.add(rod([side * 0.46, 2.12, 0.02], [side * 0.16, 2.34, -0.1], 0.04, 0.04, 6), C.graphite);
    // twin exhaust stacks at the rear
    body.add(cylZ(0.062, 0.3, 10), C.silver, [side * 0.24, 2.02, -1.46]);
    body.add(cylZ(0.046, 0.31, 8), C.black, [side * 0.24, 2.02, -1.47]);
    // whip antennas
    body.add(rod([side * 0.33, 2.2, -1.2], [side * 0.4, 3.05, -1.62], 0.014, 0.006, 5), C.black);
    body.add(cylX(0.03, 0.05, 6), C.graphiteLight, [side * 0.33, 2.22, -1.2]);
    // armoured side skirt with cooling slots
    body.add(box(0.03, 0.2, 1.0, 0.02), C.yellowSide, [side * 0.44, 1.69, -0.02]);
    for (let i = 0; i < 6; i++) body.add(box(0.034, 0.12, 0.03), C.black, [side * 0.445, 1.69, -0.42 + i * 0.16]);
  }
  // belly battery with cooling fins
  body.add(box(0.5, 0.17, 1.3, 0.04), C.dark, [0, 1.6, -0.05]);
  for (let i = 0; i < 8; i++) body.add(box(0.54, 0.05, 0.025), C.graphiteLight, [0, 1.53, -0.58 + i * 0.15]);
  // front ram bar with teeth, red recognition chevron on the brow
  body.add(box(0.96, 0.07, 0.09, 0.02), C.black, [0, 1.6, 1.62]);
  for (let i = 0; i < 5; i++) body.add(box(0.07, 0.11, 0.05, 0.012), C.silver, [-0.36 + i * 0.18, 1.55, 1.655], [0.35, 0, 0]);
  body.add(box(0.5, 0.05, 0.02), C.red, [0, 2.125, 1.572]);
  body.add(box(0.1, 0.03, 0.5, 0.01), C.red, [0, 2.232, 1.05]);
  // rear tow hook block and battery latch
  body.add(box(0.3, 0.2, 0.1, 0.03), C.black, [0, 1.84, -1.4]);
  body.add(cylX(0.05, 0.36, 8), C.silver, [0, 1.76, -1.44]);
  // static rifle prop on the back (reference group scale 1.42 / 1.30 / 1.25, lowered by 0.83)
  body.base = mk([0, -0.83, 0], [0, 0, 0], [1.42, 1.3, 1.25]);
  body.add(box(0.24, 0.075, 0.78, 0.055), C.dark, [0, 2.365, -0.06]);
  for (const z of [-0.34, 0.25]) body.add(box(0.31, 0.055, 0.12, 0.025), C.graphite, [0, 2.405, z]);
  body.add(box(0.19, 0.17, 0.58, 0.045), C.black, [0, 2.49, -0.16]);
  body.add(box(0.16, 0.13, 0.42, 0.035), C.dark, [0, 2.48, -0.6]);
  body.add(box(0.15, 0.12, 0.19, 0.035), C.black, [0, 2.49, -0.88]);
  body.add(cylZ(0.034, 0.92, 10), C.black, [0, 2.515, 0.57]);
  body.add(cylZ(0.046, 0.12, 10), C.graphite, [0, 2.515, 1.06]);
  body.add(box(0.075, 0.035, 0.55), C.graphite, [0, 2.595, -0.04]);
  body.add(cylZ(0.052, 0.23, 10), C.black, [0, 2.665, -0.18]);
  body.add(box(0.09, 0.035, 0.16), C.black, [0, 2.635, 0.3]);
  body.add(box(0.055, 0.1, 0.18, 0.018), C.dark, [0.115, 2.435, -0.18]);
  body.add(box(0.09, 0.19, 0.12, 0.025), C.black, [0, 2.365, -0.12], [0.18, 0, 0]);
  // shoulder sockets stay on the chassis
  body.base = id;
  for (const leg of LEGS) {
    const sx = leg.side * 0.78;
    body.add(sphere(0.215, 12, 8), C.dark, [sx * 0.7, SHOULDER_Y, leg.z], [0, 0, 0], [1, 0.92, 0.95]);
    body.add(cylX(0.175, 0.19, 14), C.graphite, [sx * 0.78, SHOULDER_Y, leg.z]);
    body.add(cylX(0.138, 0.205, 12), C.silver, [sx * 0.865, SHOULDER_Y, leg.z]);
    body.add(cylX(0.072, 0.225, 10), C.graphiteLight, [sx * 0.91, SHOULDER_Y, leg.z]);
  }
  const bodyGeo = body.merge(world);

  // diagonal leg pairs: (FR + RL) and (FL + RR)
  const pivotGame = new Vector3(0, SHOULDER_Y * s - SPOT.centerHeight, 0);
  const pivotShift = new Matrix4().makeTranslation(0, -pivotGame.y, 0);
  const bake = pivotShift.clone().multiply(world);
  const pairA = new Parts();
  pairA.base = id;
  addLeg(pairA, LEGS[0] as LegDef);
  addLeg(pairA, LEGS[3] as LegDef);
  const legsA = pairA.merge(bake);
  const pairB = new Parts();
  pairB.base = id;
  addLeg(pairB, LEGS[1] as LegDef);
  addLeg(pairB, LEGS[2] as LegDef);
  const legsB = pairB.merge(bake);

  // emissive optics
  const lamps = new Parts();
  lamps.base = id;
  for (const x of [-0.39, 0.39]) lamps.add(sphere(0.045, 8, 6), C.yellowHighlight, [x, 1.67, 1.59], [0, 0, 0], [1, 0.8, 0.45]);
  for (let i = 0; i < 4; i++) lamps.add(sphere(0.03, 8, 6), C.lens, [-0.34, 2.015 - i * 0.074, 1.69], [0, 0, 0], [1, 0.8, 0.4]);
  lamps.add(box(0.4, 0.05, 0.012), C.lens, [-0.1, 1.89, 1.645]);
  // visor slit across the brow, antenna tips, exhaust glow
  lamps.add(box(0.62, 0.03, 0.012), C.lens, [0, 2.07, 1.578]);
  for (const side of [-1, 1]) {
    lamps.add(sphere(0.022, 6, 5), C.lens, [side * 0.4, 3.06, -1.62]);
    lamps.add(cylZ(0.036, 0.02, 8), C.lens, [side * 0.24, 2.02, -1.62]);
  }
  const lampGeo = lamps.merge(world);

  // far LOD
  const far = new Parts();
  far.base = id;
  far.add(box(0.84, 0.55, 2.7), C.yellow, [0, 1.92, 0]);
  far.add(box(0.9, 0.5, 0.36), C.yellow, [0, 1.91, 1.4]);
  far.add(box(0.2, 0.3, 2.1), C.black, [0, 2.5, 0.2]);
  for (const leg of LEGS) far.add(box(0.22, 1.7, 0.26), C.graphite, [leg.side * 0.95, 0.95, leg.z + leg.zStep]);
  const farGeo = far.merge(world);

  return { body: bodyGeo, legsA, legsB, legPivot: pivotGame, lamps: lampGeo, far: farGeo };
}
