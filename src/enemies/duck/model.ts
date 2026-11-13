import {
  BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Matrix4,
  Quaternion,
  ShapeGeometry,
  SphereGeometry,
  Shape,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  Euler,
} from 'three';
import { box, cylX, cylZ, Parts, sphere, type V3 } from './modelKit';
import { DUCK } from './tunables';

/** Palette of the reference duck. */
export const DUCK_COLORS = {
  purple: 0xc2b0d8,
  richPurple: 0xa283cc,
  yellow: 0xf7dc4f,
  cyan: 0xa7dde6,
  faceplate: 0x878580,
  servo: 0x1e2025,
  silver: 0xd0d3da,
  screw: 0x3b3e45,
  glass: 0x090d16,
  white: 0xf1f2f4,
  wire: 0x151619,
} as const;

export interface DuckModel {
  /** Static shell: torso, neck servos, head, thigh covers, hips. */
  body: BufferGeometry;
  /** Lower jaw, authored around its hinge (origin = hinge). */
  beak: BufferGeometry;
  /** Both feet in one geometry (they hop together). */
  feet: BufferGeometry;
  /** Low-detail single mesh for the far LOD. */
  far: BufferGeometry;
  /** Hinge pose of the jaw inside the root (rest orientation includes the reference opening). */
  beakPosition: Vector3;
  beakQuaternion: Quaternion;
  /** Reference opening of the jaw (rad). */
  beakRest: number;
  /** Beacon placement (root-local). */
  beaconPosition: Vector3;
}

const DEG = Math.PI / 180;
const C = DUCK_COLORS;

function mk(pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): Matrix4 {
  return new Matrix4().compose(
    new Vector3(pos[0], pos[1], pos[2]),
    new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2])),
    new Vector3(scale[0], scale[1], scale[2]),
  );
}

function servo(p: Parts, parent: Matrix4, pos: V3, rot: V3): void {
  p.base = parent.clone().multiply(mk(pos, rot));
  p.add(box(0.36, 0.48, 0.34, 0.03), C.servo);
  p.add(box(0.41, 0.06, 0.38, 0.01), C.servo, [0, 0.08, 0]);
  p.add(box(0.08, 0.11, 0.03), C.white, [-0.07, -0.1, 0.175]);
  p.add(cylX(0.125, 0.03, 14), C.silver, [0.18, 0.12, 0]);
  p.add(box(0.025, 0.34, 0.24, 0.04), C.silver, [-0.2, 0.15, 0]);
  p.add(box(0.025, 0.34, 0.24, 0.04), C.silver, [0.2, 0.15, 0]);
  p.add(box(0.425, 0.025, 0.24), C.silver, [0, 0.31, 0]);
}

function archShape(w: number, h: number): Shape {
  const hw = w / 2;
  const s = new Shape();
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.quadraticCurveTo(hw + 0.04, 0.32, hw - 0.12, 0.56);
  s.bezierCurveTo(hw - 0.25, h + 0.08, -hw + 0.25, h + 0.08, -hw + 0.12, 0.56);
  s.quadraticCurveTo(-hw - 0.04, 0.32, -hw, 0);
  return s;
}

function thighShape(): Shape {
  const s = new Shape();
  s.moveTo(-0.22, 0.24);
  s.lineTo(0.26, 0.12);
  s.quadraticCurveTo(0.32, 0.08, 0.28, -0.05);
  s.lineTo(0.14, -0.32);
  s.quadraticCurveTo(0.08, -0.38, -0.04, -0.32);
  s.lineTo(-0.26, 0.08);
  s.quadraticCurveTo(-0.3, 0.2, -0.22, 0.24);
  return s;
}

function cable(points: V3[], r: number): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((q) => new Vector3(q[0], q[1], q[2])));
  return new TubeGeometry(curve, 8, r, 5, false);
}

function foot(p: Parts, isLeft: boolean): void {
  const side = isLeft ? -1 : 1;
  p.base = mk([isLeft ? -0.58 : 0.42, 0.34, isLeft ? 0.22 : 0.36], [0.06, isLeft ? -0.34 : 0.18, isLeft ? -0.05 : 0.04]);
  p.add(box(0.46, 0.62, 0.28, 0.11), C.richPurple, [0, 0.02, 0.06]);
  p.add(box(0.48, 0.65, 0.16, 0.1), C.yellow, [0, 0.01, -0.09]);
  p.add(cylX(0.085, 0.04, 14), C.silver, [side * 0.24, -0.12, -0.08]);
  p.add(cylX(0.045, 0.045, 10), C.servo, [side * 0.245, -0.12, -0.08]);
}

/**
 * Builds every duck geometry once, in the reference's units, then bakes scale, floor offset and the
 * 180 degree turn (the reference faces +Z, the game faces -Z).
 */
export function buildDuckModel(): DuckModel {
  const s = DUCK.modelScale;
  const world = new Matrix4()
    .makeRotationY(Math.PI)
    .multiply(new Matrix4().makeTranslation(0, -DUCK.centerHeight, 0))
    .multiply(new Matrix4().makeScale(s, s, s));
  const id = new Matrix4();

  // ---- body -------------------------------------------------------------------------
  const body = new Parts();
  body.base = id;
  body.add(box(1.16, 0.56, 0.88, 0.16), C.purple, [0, 1.15, -0.08]);
  body.add(box(0.46, 0.24, 0.44, 0.08), C.purple, [-0.08, 1.41, -0.02]);
  body.add(cylX(0.13, 0.04, 14), C.silver, [-0.31, 1.42, -0.02]);

  const neck = mk([-0.05, 1.38, -0.02], [0, 16 * DEG, 0]);
  servo(body, neck, [0, 0.22, 0], [0.08, 0.15, -0.05]);
  servo(body, neck, [0.02, 0.64, 0.04], [-0.06, 0.15, 0.03]);
  body.base = neck;
  body.add(
    cable(
      [
        [-0.12, 0.85, -0.15],
        [-0.34, 0.78, -0.25],
        [-0.38, 0.55, -0.22],
        [-0.18, 0.35, -0.14],
      ],
      0.014,
    ),
    C.wire,
  );
  body.add(
    cable(
      [
        [-0.08, 0.88, -0.18],
        [-0.29, 0.83, -0.29],
        [-0.33, 0.6, -0.26],
        [-0.15, 0.4, -0.16],
      ],
      0.012,
    ),
    C.wire,
  );

  // head
  const headLocal = mk([0.04, 0.94, 0.16], [4 * DEG, 0, -2.5 * DEG]);
  const head = neck.clone().multiply(headLocal);
  body.base = head;
  const archDepth = 0.88;
  const arch = new ExtrudeGeometry(archShape(1.18, 0.78), {
    depth: archDepth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.045,
    bevelThickness: 0.055,
    curveSegments: 10,
  });
  arch.translate(0, 0, -archDepth / 2);
  body.add(arch, C.purple);
  const fhw = 1.18 / 2 - 0.045;
  const face = new Shape();
  face.moveTo(-fhw, 0.01);
  face.lineTo(fhw, 0.01);
  face.quadraticCurveTo(fhw + 0.03, 0.3, fhw - 0.11, 0.52);
  face.bezierCurveTo(fhw - 0.22, 0.8, -fhw + 0.22, 0.8, -fhw + 0.11, 0.52);
  face.quadraticCurveTo(-fhw - 0.03, 0.3, -fhw, 0.01);
  body.add(new ShapeGeometry(face, 10), C.faceplate, [0, 0.01, archDepth / 2 + 0.018], [-0.06, 0, 0]);
  body.add(box(1.27, 0.065, 1.0, 0.02), C.yellow, [0, -0.015, 0.01]);
  // cyclops eye
  body.base = head.clone().multiply(mk([-0.02, 0.36, archDepth / 2 + 0.032], [-0.06, 0, 0]));
  body.add(new TorusGeometry(0.175, 0.058, 6, 20), C.cyan, [0, 0, 0], [0, 0, 0], [1, 1, 0.72]);
  body.add(cylZ(0.18, 0.035, 20), C.cyan, [0, 0, -0.005]);
  body.add(cylZ(0.115, 0.055, 20), C.servo, [0, 0, 0.015]);
  body.add(new TorusGeometry(0.082, 0.01, 5, 16), C.screw, [0, 0, 0.038]);
  const lens = new SphereGeometry(0.074, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
  lens.rotateX(Math.PI / 2);
  body.add(lens, C.glass, [0, 0, 0.012]);
  body.base = head;
  body.add(box(0.11, 0.052, 0.02, 0.02), C.glass, [0.28, 0.25, archDepth / 2 + 0.025], [-0.06, 0, -0.15]);

  // hips, thigh covers, ankle brackets
  for (const isLeft of [true, false]) {
    const side = isLeft ? -1 : 1;
    servo(body, id, [side * 0.44, 0.68, -0.05], [0.25, side * 0.22, side * -0.15]);
    body.base = id;
    const thigh = new ExtrudeGeometry(thighShape(), {
      depth: 0.09,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 6,
    });
    thigh.center();
    thigh.rotateY(Math.PI / 2);
    body.add(thigh, C.purple, [side * 0.78, 0.56, -0.08], [0, side * -0.22, 0]);
    body.add(box(0.28, 0.24, 0.34, 0.04), C.servo, [side * 0.46, 0.36, 0.04], [0, side * -0.25, 0]);
    body.add(cylX(0.11, 0.04, 14), C.silver, [side * 0.31, 0.38, 0.12]);
  }
  const bodyGeo = body.merge(world);

  // ---- feet --------------------------------------------------------------------------
  const feet = new Parts();
  foot(feet, true);
  foot(feet, false);
  const feetGeo = feet.merge(world);

  // ---- jaw ---------------------------------------------------------------------------
  const jaw = new Parts();
  jaw.base = id;
  const jawLength = archDepth + 0.14;
  const jawWidth = 1.18 + 0.07;
  jaw.add(box(jawWidth, 0.075, jawLength, 0.03), C.yellow, [0, -0.02, jawLength / 2 - 0.18]);
  jaw.add(box(jawWidth - 0.11, 0.04, jawLength - 0.1, 0.02), C.richPurple, [0, 0.015, jawLength / 2 - 0.18]);
  for (const side of [-1, 1]) {
    jaw.add(box(0.035, 0.15, 0.12, 0.015), C.yellow, [side * (jawWidth / 2 + 0.01), 0.03, 0.01]);
  }
  const beakGeo = jaw.merge(new Matrix4().makeScale(s, s, s));
  const hinge = world.clone().multiply(head).multiply(mk([0, -0.055, -0.24]));
  const beakPosition = new Vector3();
  const beakQuaternion = new Quaternion();
  hinge.decompose(beakPosition, beakQuaternion, new Vector3());
  const beakRest = 18 * DEG;
  beakQuaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), beakRest));

  // ---- far LOD -------------------------------------------------------------------------
  const far = new Parts();
  far.base = id;
  far.add(box(0.58, 0.3, 0.46), C.purple, [0, -0.04, 0.03]);
  far.add(sphere(0.3, 8, 6), C.purple, [0, 0.72, -0.04], [0, 0, 0], [1, 0.85, 0.9]);
  far.add(box(0.62, 0.06, 0.5), C.yellow, [0, 0.55, -0.22]);
  far.add(box(0.24, 0.34, 0.26), C.richPurple, [-0.34, -0.42, -0.1]);
  far.add(box(0.24, 0.34, 0.26), C.richPurple, [0.24, -0.42, -0.2]);
  const farGeo = far.merge();

  const beaconPosition = new Vector3(0, 1.04, -0.02);
  return { body: bodyGeo, beak: beakGeo, feet: feetGeo, far: farGeo, beakPosition, beakQuaternion, beakRest, beaconPosition };
}
