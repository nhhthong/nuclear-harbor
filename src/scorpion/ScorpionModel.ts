import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWeatheredPaint } from '@/world/containerModel';
import { SCORPION } from './tunables';

/**
 * Port of the owner's "Cyborg Scorpion" showcase (docs/reference-models/cyborg_scorpion.html): faceted
 * gunmetal carapace with six overlapping tergites, an arched five-segment tail with drum joints, hoses
 * and a curved stinger, two heavy articulated claws and eight piston legs.
 *
 * The showcase hierarchy (about 500 meshes, +X forward) is built once, flattened per animated pivot
 * into one vertex-coloured armour geometry plus one emissive geometry, and thrown away: 13 pivots,
 * about 20 draw calls. The showcase tail curls backwards and down; here it arches up and forward over
 * the body, which is what the tail slam and the venom shot need.
 *
 * Final model: head towards -Z (game yaw 0), feet on y = 0, scaled to SCORPION.heightM.
 */

export type PivotName =
  | 'body'
  | 'tail0'
  | 'tail1'
  | 'tail2'
  | 'tail3'
  | 'tail4'
  | 'telson'
  | 'clawL'
  | 'clawR'
  | 'fingerL'
  | 'fingerR'
  | 'leg0'
  | 'leg1'
  | 'leg2'
  | 'leg3'
  | 'leg4'
  | 'leg5'
  | 'leg6'
  | 'leg7';
const LEG_PIVOTS: readonly PivotName[] = ['leg0', 'leg1', 'leg2', 'leg3', 'leg4', 'leg5', 'leg6', 'leg7'];
const PIVOTS: readonly PivotName[] = ['body', 'tail0', 'tail1', 'tail2', 'tail3', 'tail4', 'telson', 'clawL', 'clawR', 'fingerL', 'fingerR', ...LEG_PIVOTS];
/** Per leg (same order as the leg pivots): side (+1 right, -1 left) and gait set (true = first half). */
const LEG_INFO: Array<{ side: number; setA: boolean }> = [];
const TAIL: readonly PivotName[] = ['tail0', 'tail1', 'tail2', 'tail3', 'tail4', 'telson'];

const PALETTE = {
  armor: 0x2b3038,
  plate: 0x17191d,
  steel: 0x6a717c,
  blade: 0x3a414c,
  cable: 0x141518,
  hazard: 0x8a1410,
} as const;
type Tag = keyof typeof PALETTE | 'glow';

const DUMMY = new MeshBasicMaterial();

interface PartGeometries {
  armor: BufferGeometry | null;
  glow: BufferGeometry | null;
}

export interface ScorpionAssets {
  parts: Record<PivotName, PartGeometries>;
  orbGeometry: BufferGeometry;
  armorMaterial: MeshStandardMaterial;
  rest: Record<PivotName, Matrix4>;
  parent: Record<PivotName, PivotName | null>;
  /** Stinger tip relative to the telson pivot (model units). */
  orbOffset: Vector3;
  scale: number;
  groundOffset: number;
  dispose(): void;
}

function add(parent: Object3D, geo: BufferGeometry, tag: Tag, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Mesh {
  const mesh = new Mesh(geo, DUMMY);
  mesh.userData.tag = tag;
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

/** Bevelled polygon plate (showcase `createBeveledPlate`), lying flat: outline in XZ, thickness in Y. */
function plate(points: ReadonlyArray<readonly [number, number]>, depth: number, bevel = 0.03): BufferGeometry {
  const shape = new Shape();
  const first = points[0] as readonly [number, number];
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as readonly [number, number];
    shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: bevel, bevelThickness: bevel });
  geo.center();
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** Drum joint with a bearing ring and a hex pin (showcase `createMechJoint`). */
function joint(parent: Object3D, radius: number, width: number, axis: 'x' | 'y' | 'z', x = 0, y = 0, z = 0): void {
  const g = new Group();
  g.position.set(x, y, z);
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  else if (axis === 'x') g.rotation.z = Math.PI / 2;
  add(g, new CylinderGeometry(radius, radius, width, 12), 'plate');
  add(g, new CylinderGeometry(radius * 0.68, radius * 0.68, width * 1.12, 12), 'steel');
  add(g, new CylinderGeometry(radius * 0.34, radius * 0.34, width * 1.24, 6), 'armor');
  parent.add(g);
}

const UP = new Vector3(0, 1, 0);

/** Hydraulic ram between two points (sleeve, rod, collar). */
function piston(parent: Object3D, a: Vector3, b: Vector3, radius: number): void {
  const dir = new Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-3) return;
  const g = new Group();
  g.position.copy(a).add(b).multiplyScalar(0.5);
  g.quaternion.setFromUnitVectors(UP, dir.normalize());
  const sleeve = len * 0.58;
  add(g, new CylinderGeometry(radius, radius, sleeve, 8), 'plate', 0, -len * 0.5 + sleeve * 0.5, 0);
  add(g, new CylinderGeometry(radius * 0.58, radius * 0.58, len * 0.92, 8), 'steel');
  add(g, new CylinderGeometry(radius * 1.22, radius * 1.22, 0.03, 8), 'steel', 0, -len * 0.5 + sleeve, 0);
  parent.add(g);
}

function cable(parent: Object3D, points: Array<[number, number, number]>, radius: number, tag: Tag = 'cable'): void {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p[0], p[1], p[2])));
  add(parent, new TubeGeometry(curve, 8, radius, 5, false), tag);
}

/** Tail segments: length, radii and pitch (rad about Z; the first leans back, the rest curl forward). */
const TAIL_SEGMENTS = [
  { len: 0.46, rTop: 0.25, rBot: 0.27, pitch: 0.95 },
  { len: 0.5, rTop: 0.23, rBot: 0.25, pitch: -0.5 },
  { len: 0.54, rTop: 0.21, rBot: 0.23, pitch: -0.55 },
  { len: 0.56, rTop: 0.19, rBot: 0.21, pitch: -0.6 },
  { len: 0.58, rTop: 0.17, rBot: 0.19, pitch: -0.55 },
] as const;
const TELSON_PITCH = -0.5;

const LEGS = [
  { x: 0.62, z: 0.44, yaw: 0.42, femur: 0.56, tibia: 0.58, tarsus: 0.42 },
  { x: 0.24, z: 0.48, yaw: 0.14, femur: 0.62, tibia: 0.62, tarsus: 0.44 },
  { x: -0.16, z: 0.46, yaw: -0.16, femur: 0.68, tibia: 0.66, tarsus: 0.46 },
  { x: -0.56, z: 0.4, yaw: -0.46, femur: 0.74, tibia: 0.7, tarsus: 0.48 },
] as const;

/** Showcase hierarchy in its own frame (+X forward, +Y up). */
function buildReference(): { root: Group; orb: Object3D; telson: Group } {
  const root = new Group();
  // showcase +X -> pipeline +Z (the pipeline then turns the model to face -Z)
  const frame = new Group();
  frame.rotation.y = -Math.PI / 2;
  root.add(frame);
  const body = new Group();
  body.position.set(0.15, 1.08, 0);
  body.rotation.z = -0.04;
  frame.add(body);

  // ---- chassis, belly fins ----
  add(body, new BoxGeometry(2.55, 0.38, 0.88), 'plate', -0.05, -0.05, 0);
  for (let i = 0; i < 8; i++) add(body, new BoxGeometry(0.14, 0.24, 1.02 - Math.abs(i - 3.5) * 0.08), 'steel', -1.05 + i * 0.28, -0.18, 0);
  // reactor slit along the belly and glowing seams between the tergites
  add(body, new BoxGeometry(1.9, 0.03, 0.2), 'glow', -0.1, -0.31, 0);

  // ---- head shield, crest, vents, sensors ----
  add(body, plate([[-0.45, -0.58], [0.52, -0.44], [0.68, -0.22], [0.68, 0.22], [0.52, 0.44], [-0.45, 0.58], [-0.55, 0]], 0.24, 0.04), 'armor', 0.78, 0.22, 0);
  add(body, plate([[-0.38, -0.26], [0.45, -0.18], [0.52, 0], [0.45, 0.18], [-0.38, 0.26]], 0.12, 0.025), 'plate', 0.78, 0.36, 0);
  add(body, plate([[-0.3, -0.07], [0.42, -0.05], [0.42, 0.05], [-0.3, 0.07]], 0.03, 0.01), 'hazard', 0.8, 0.43, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) add(body, new BoxGeometry(0.12, 0.04, 0.14), 'steel', 0.48 + i * 0.18, 0.33, side * 0.34, 0, side * -0.22, 0);
    add(body, new CylinderGeometry(0.045, 0.055, 0.08, 10), 'steel', 1.22, 0.34, side * 0.11, 0, 0, Math.PI / 2);
    add(body, new SphereGeometry(0.042, 10, 8), 'glow', 1.265, 0.34, side * 0.11);
    for (let e = 0; e < 3; e++) add(body, new SphereGeometry(0.026, 8, 6), 'glow', 1.28 - e * 0.08, 0.24, side * (0.31 + e * 0.04));
    // chelicerae
    const chel = new Group();
    chel.position.set(1.38, 0.06, side * 0.16);
    chel.rotation.y = side * -0.15;
    add(chel, new BoxGeometry(0.24, 0.12, 0.12), 'plate');
    add(chel, new ConeGeometry(0.055, 0.28, 5), 'blade', 0.22, 0.03, 0, 0, 0, -Math.PI / 2 - 0.15);
    add(chel, new ConeGeometry(0.045, 0.24, 5), 'blade', 0.2, -0.04, 0, 0, 0, -Math.PI / 2 + 0.22);
    body.add(chel);
  }

  // ---- six overlapping tergites ----
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const width = 1.24 - t * 0.48;
    const length = 0.34;
    const x = 0.18 - i * 0.28;
    const y = 0.26 - t * 0.04;
    add(
      body,
      plate([[-length * 0.55, -width * 0.44], [length * 0.45, -width * 0.5], [length * 0.58, -width * 0.25], [length * 0.58, width * 0.25], [length * 0.45, width * 0.5], [-length * 0.55, width * 0.44]], 0.15, 0.025),
      'armor',
      x,
      y,
      0,
      0,
      0,
      0.08,
    );
    add(body, new BoxGeometry(0.24, 0.08, 0.26 - t * 0.08), 'plate', x + 0.02, y + 0.09, 0);
    add(body, new BoxGeometry(0.03, 0.02, width * 0.7), 'glow', x - 0.16, y + 0.03, 0);
    for (const side of [-1, 1]) {
      add(body, new CylinderGeometry(0.022, 0.024, 0.025, 6), 'steel', x + 0.05, y + 0.085, side * width * 0.36);
      add(body, new BoxGeometry(0.24, 0.18, 0.07), 'plate', x, y - 0.14, side * width * 0.46, side * 0.35, 0, 0);
    }
  }

  // ---- tail: five segments and the telson, arching up and forward over the body ----
  let parent: Object3D = new Group();
  parent.position.set(-1.38, 0.16, 0);
  body.add(parent);
  TAIL_SEGMENTS.forEach((cfg, idx) => {
    const seg = new Group();
    if (idx > 0) seg.position.set(0, (TAIL_SEGMENTS[idx - 1] as (typeof TAIL_SEGMENTS)[number]).len, 0);
    seg.rotation.z = cfg.pitch;
    seg.userData.pivot = TAIL[idx];
    parent.add(seg);
    joint(seg, cfg.rBot * 0.82, cfg.rBot * 1.75, 'z');
    add(seg, new CylinderGeometry(cfg.rTop * 0.72, cfg.rBot * 0.72, cfg.len, 10), 'plate', 0, cfg.len * 0.5, 0);
    add(seg, new CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len * 0.78, 8), 'armor', 0, cfg.len * 0.5, 0, 0, Math.PI / 8, 0);
    // venom line glowing along the back of the tail
    add(seg, new BoxGeometry(0.02, cfg.len * 0.6, 0.028), 'glow', -cfg.rTop * 1.0, cfg.len * 0.5, 0);
    for (const side of [-1, 1]) {
      add(seg, new BoxGeometry(0.08, cfg.len * 0.74, 0.05), 'steel', -cfg.rTop * 0.85, cfg.len * 0.5, side * cfg.rTop * 0.42);
      cable(seg, [[0.04, -0.08, side * cfg.rBot * 0.88], [0.11, 0.04, side * cfg.rBot * 0.96], [0.05, 0.16, side * cfg.rBot * 0.88]], 0.022);
      cable(seg, [[cfg.rBot * 0.75, -0.06, side * 0.06], [cfg.rBot * 0.85, cfg.len * 0.5, side * 0.06], [cfg.rTop * 0.75, cfg.len + 0.06, side * 0.06]], 0.02);
      add(seg, new CylinderGeometry(0.018, 0.02, 0.02, 6), 'steel', 0, cfg.len * 0.5, side * cfg.rTop * 0.95, Math.PI / 2, 0, 0);
    }
    for (const b of [0.22, 0.78]) add(seg, new CylinderGeometry(cfg.rTop * 1.04, cfg.rBot * 1.04, 0.045, 8), 'plate', 0, cfg.len * b, 0, 0, Math.PI / 8, 0);
    parent = seg;
  });
  const telson = new Group();
  telson.position.set(0, TAIL_SEGMENTS[4].len, 0);
  telson.rotation.z = TELSON_PITCH;
  telson.userData.pivot = 'telson';
  parent.add(telson);
  joint(telson, 0.14, 0.28, 'z');
  add(telson, new CylinderGeometry(0.12, 0.19, 0.44, 8), 'armor', 0.02, 0.24, 0, 0, Math.PI / 8, 0);
  add(telson, new BoxGeometry(0.16, 0.36, 0.22), 'plate', -0.06, 0.24, 0, 0, 0, -0.15);
  // venom reservoir windows and exhaust nozzles
  for (const side of [-1, 1]) {
    add(telson, new CylinderGeometry(0.035, 0.045, 0.14, 8), 'steel', 0.06, 0.32, side * 0.15);
    add(telson, new SphereGeometry(0.07, 8, 6), 'glow', 0.04, 0.2, side * 0.13);
  }
  // curved stinger: tapered cone bent forward
  const stinger = new CylinderGeometry(0.003, 0.095, 0.62, 6, 10);
  const sp = stinger.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const t = Math.min(1, Math.max(0, (sp.getY(i) + 0.31) / 0.62));
    sp.setX(i, sp.getX(i) + Math.pow(t, 1.85) * 0.24);
  }
  stinger.computeVertexNormals();
  add(telson, stinger, 'blade', 0.02, 0.72, 0);
  const orb = new Object3D();
  orb.position.set(0.27, 1.05, 0);
  telson.add(orb);

  // ---- claws ----
  for (const side of [1, -1]) {
    const shoulder = new Group();
    shoulder.position.set(1.12, 0.06, side * 0.56);
    shoulder.userData.pivot = side === 1 ? 'clawR' : 'clawL';
    body.add(shoulder);
    joint(shoulder, 0.18, 0.26, 'y');
    const femur = new Group();
    femur.rotation.set(0, side * -0.58, -0.08);
    shoulder.add(femur);
    const fl = 0.78;
    add(femur, new BoxGeometry(fl, 0.16, 0.16), 'steel', fl * 0.5, 0, 0);
    add(femur, new BoxGeometry(fl * 0.86, 0.24, 0.25), 'armor', fl * 0.5, 0.02, side * 0.02);
    piston(femur, new Vector3(0.08, -0.11, -side * 0.11), new Vector3(fl * 0.85, -0.09, -side * 0.11), 0.028);
    const patella = new Group();
    patella.position.set(fl, 0, 0);
    patella.rotation.set(0, side * 1.15, -0.05);
    femur.add(patella);
    joint(patella, 0.17, 0.28, 'y');
    const pl = 0.74;
    add(patella, new CylinderGeometry(0.16, 0.14, pl, 8), 'armor', pl * 0.5, 0, 0, Math.PI / 8, 0, Math.PI / 2);
    add(patella, new BoxGeometry(pl * 0.82, 0.26, 0.3), 'plate', pl * 0.5, 0.02, side * 0.02);
    const wrist = new Group();
    wrist.position.set(pl, -0.04, 0);
    wrist.rotation.set(side * -0.18, side * 0.32, 0);
    patella.add(wrist);
    joint(wrist, 0.16, 0.26, 'y');
    add(wrist, plate([[0, -0.18], [0.35, -0.28], [0.82, -0.22], [0.92, 0], [0.82, 0.22], [0.35, 0.26], [0, 0.18]], 0.34, 0.045), 'armor', 0.46, 0, 0);
    add(wrist, plate([[0.08, -0.14], [0.72, -0.16], [0.8, 0], [0.72, 0.16], [0.08, 0.14]], 0.12, 0.025), 'plate', 0.45, 0.19, 0);
    add(wrist, new BoxGeometry(0.5, 0.02, 0.06), 'hazard', 0.45, 0.262, 0);
    for (let r = 0; r < 4; r++) add(wrist, new BoxGeometry(0.045, 0.04, 0.26), 'steel', 0.24 + r * 0.15, 0.26, 0);
    // fixed finger
    const fixed = new Group();
    fixed.position.set(0.86, -0.02, side * 0.11);
    fixed.rotation.y = side * 0.08;
    wrist.add(fixed);
    const fb = new ConeGeometry(0.11, 0.78, 6);
    fb.scale(1.2, 1, 0.75);
    add(fixed, fb, 'blade', 0.36, 0, 0, 0, 0, -Math.PI / 2);
    for (let t = 0; t < 6; t++) add(fixed, new ConeGeometry(0.024, 0.06, 4), 'steel', 0.14 + t * 0.09, 0, -side * 0.07, side * (Math.PI / 2), 0, 0);
    // movable finger (its own pivot: the claws snap)
    const movable = new Group();
    movable.position.set(0.76, -0.02, -side * 0.12);
    movable.rotation.y = side * -0.24;
    movable.userData.pivot = side === 1 ? 'fingerR' : 'fingerL';
    wrist.add(movable);
    joint(movable, 0.095, 0.22, 'y');
    const mb = new ConeGeometry(0.095, 0.74, 6);
    mb.scale(1.15, 1, 0.72);
    add(movable, mb, 'blade', 0.35, 0, 0, 0, 0, -Math.PI / 2);
    for (let t = 0; t < 5; t++) add(movable, new ConeGeometry(0.022, 0.055, 4), 'steel', 0.16 + t * 0.09, 0, side * 0.065, -side * (Math.PI / 2), 0, 0);
    piston(wrist, new Vector3(0.35, -0.06, -side * 0.22), new Vector3(0.84, -0.05, -side * 0.16), 0.025);
  }

  // ---- eight legs, each on its own hip pivot; gait sets R1 L2 R3 L4 / L1 R2 L3 R4 ----
  LEG_INFO.length = 0;
  LEGS.forEach((cfg, index) => {
    for (const side of [1, -1]) {
      const setA = (index % 2 === 0) === (side === 1);
      const hip = new Group();
      hip.position.set(cfg.x, -0.08, side * cfg.z);
      hip.rotation.y = side * -cfg.yaw;
      hip.userData.pivot = LEG_PIVOTS[LEG_INFO.length];
      LEG_INFO.push({ side, setA });
      body.add(hip);
      add(hip, new SphereGeometry(0.115, 10, 8), 'steel');
      add(hip, new CylinderGeometry(0.13, 0.14, 0.1, 10), 'plate', 0, 0, 0, Math.PI / 2, 0, 0);
      const femur = new Group();
      femur.rotation.x = side * -0.52;
      hip.add(femur);
      add(femur, new CylinderGeometry(0.048, 0.056, cfg.femur, 8), 'steel', 0, 0, side * cfg.femur * 0.5, Math.PI / 2, 0, 0);
      add(femur, new BoxGeometry(0.11, 0.13, cfg.femur * 0.82), 'armor', 0, 0.03, side * cfg.femur * 0.5);
      piston(femur, new Vector3(0, -0.07, side * 0.06), new Vector3(0, -0.06, side * cfg.femur * 0.88), 0.019);
      cable(femur, [[-0.04, 0.14, -side * 0.08], [-0.03, 0.18, side * 0.12], [0, 0.08, side * cfg.femur * 0.45]], 0.015);
      const knee = new Group();
      knee.position.set(0, 0, side * cfg.femur);
      knee.rotation.x = side * 1.48;
      femur.add(knee);
      joint(knee, 0.085, 0.15, 'x');
      add(knee, new CylinderGeometry(0.042, 0.052, cfg.tibia, 8), 'steel', 0, 0, side * cfg.tibia * 0.5, Math.PI / 2, 0, 0);
      add(knee, new BoxGeometry(0.095, 0.11, cfg.tibia * 0.8), 'armor', 0, 0.025, side * cfg.tibia * 0.5);
      piston(knee, new Vector3(0, -0.06, side * 0.06), new Vector3(0, -0.05, side * cfg.tibia * 0.88), 0.017);
      const ankle = new Group();
      ankle.position.set(0, 0, side * cfg.tibia);
      ankle.rotation.x = side * 0.36;
      knee.add(ankle);
      joint(ankle, 0.065, 0.12, 'x');
      add(ankle, new CylinderGeometry(0.058, 0.045, cfg.tarsus * 0.45, 8), 'plate', 0, 0, side * cfg.tarsus * 0.25, Math.PI / 2, 0, 0);
      add(ankle, new ConeGeometry(0.046, cfg.tarsus * 0.65, 6), 'blade', 0, 0, side * cfg.tarsus * 0.72, side * (Math.PI / 2), 0, 0);
    }
  });

  return { root, orb, telson };
}

function nearestPivot(node: Object3D): PivotName | null {
  let n: Object3D | null = node.parent;
  while (n) {
    const p = n.userData.pivot as PivotName | undefined;
    if (p) return p;
    n = n.parent;
  }
  return null;
}

const tmpColor = new Color();

/** Builds the shared geometries (once per module init). */
export function createScorpionAssets(): ScorpionAssets {
  const { root, orb, telson } = buildReference();
  root.updateMatrixWorld(true);

  const groups = new Map<PivotName, Object3D>();
  groups.set('body', root);
  root.traverse((n) => {
    const p = n.userData.pivot as PivotName | undefined;
    if (p) groups.set(p, n);
  });

  const bucket = {} as Record<PivotName, { armor: BufferGeometry[]; glow: BufferGeometry[] }>;
  for (const p of PIVOTS) bucket[p] = { armor: [], glow: [] };
  const inv = new Matrix4();
  const rel = new Matrix4();
  root.traverse((n) => {
    const mesh = n as Mesh;
    if (!mesh.isMesh) return;
    const pivot = (mesh.userData.pivot as PivotName | undefined) ?? nearestPivot(mesh) ?? 'body';
    const owner = groups.get(pivot) as Object3D;
    inv.copy(owner.matrixWorld).invert();
    rel.multiplyMatrices(inv, mesh.matrixWorld);
    // every part must merge: non-indexed, position + normal (+ colour) only
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    src.applyMatrix4(rel);
    for (const name of Object.keys(src.attributes)) if (name !== 'position' && name !== 'normal') src.deleteAttribute(name);
    const tag = mesh.userData.tag as Tag;
    if (tag === 'glow') {
      bucket[pivot].glow.push(src);
    } else {
      tmpColor.setHex(PALETTE[tag]);
      const count = src.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
      src.setAttribute('color', new Float32BufferAttribute(colors, 3));
      bucket[pivot].armor.push(src);
    }
  });

  const parts = {} as Record<PivotName, PartGeometries>;
  const merge = (list: BufferGeometry[]): BufferGeometry | null => {
    if (list.length === 0) return null;
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    return merged;
  };
  for (const p of PIVOTS) parts[p] = { armor: merge(bucket[p].armor), glow: merge(bucket[p].glow) };

  const rest = {} as Record<PivotName, Matrix4>;
  const parent = {} as Record<PivotName, PivotName | null>;
  for (const p of PIVOTS) {
    const g = groups.get(p) as Object3D;
    const par = p === 'body' ? null : (nearestPivot(g) ?? 'body');
    parent[p] = par;
    rest[p] = par === null ? new Matrix4() : new Matrix4().copy((groups.get(par) as Object3D).matrixWorld).invert().multiply(g.matrixWorld);
  }

  const orbOffset = new Vector3().setFromMatrixPosition(new Matrix4().copy(telson.matrixWorld).invert().multiply(orb.matrixWorld));

  const box = new Box3().setFromObject(root);
  const scale = SCORPION.heightM / (box.max.y - box.min.y);
  const groundOffset = -box.min.y;

  root.traverse((n) => {
    const m = n as Mesh;
    if (m.isMesh) m.geometry.dispose();
  });

  const orbGeometry = new SphereGeometry(0.16, 12, 10);
  const armorMaterial = new MeshStandardMaterial({ vertexColors: true, metalness: 0.86, roughness: 0.3 });
  applyWeatheredPaint(armorMaterial, { bottomY: 0, height: 3, wear: 0.3, key: 'scorpion', local: true, detail: 5 });

  return {
    parts,
    orbGeometry,
    armorMaterial,
    rest,
    parent,
    orbOffset,
    scale,
    groundOffset,
    dispose() {
      for (const p of PIVOTS) {
        parts[p].armor?.dispose();
        parts[p].glow?.dispose();
      }
      orbGeometry.dispose();
      armorMaterial.dispose();
    },
  };
}

/** Per-frame pose inputs. Plain numbers, nothing is allocated per frame. */
export interface ScorpionPose {
  /** Gait phase (rad, advanced by the distance walked) and amount 0..1. */
  walkPhase: number;
  walk: number;
  time: number;
  /** Tail: -1 = wound back, 0 = rest arch, +1 = struck down in front of the head. */
  tailStrike: number;
  /** 0..1 tail raised and aimed (venom shot). */
  tailAim: number;
  /** Tail sway multiplier (1 = calm). */
  tailLash: number;
  /** 0..1 claws spread and raised (threat, charge). */
  claws: number;
  /** 0..1 fingers opened. */
  snap: number;
  /** Body lean (rad): positive lowers the head. */
  pitch: number;
  /** 0..1 body pressed to the ground. */
  crouch: number;
  /** Emissive intensity and its damage flicker 0..1. */
  glow: number;
  flicker: number;
  /** 0..1 venom orb at the stinger. */
  charge: number;
}

export function createPose(): ScorpionPose {
  return { walkPhase: 0, walk: 0, time: 0, tailStrike: 0, tailAim: 0, tailLash: 1, claws: 0, snap: 0, pitch: 0, crouch: 0, glow: 1.1, flicker: 0, charge: 0 };
}

const qa = new Quaternion();
const qb = new Quaternion();
const AX = new Vector3(1, 0, 0);
const AY = new Vector3(0, 1, 0);
const AZ = new Vector3(0, 0, 1);
const scratchScale = new Vector3();

export interface ScorpionRig {
  group: Group;
  glowMaterial: MeshStandardMaterial;
  /** Number of meshes (== draw calls when visible and unculled). */
  meshCount: number;
  apply(pose: ScorpionPose): void;
  /** World position of the stinger tip (valid after the group's world matrix was updated). */
  stingerWorld(out: Vector3): Vector3;
  dispose(): void;
}

/** Curl added per tail pivot at tailStrike = +1 (forward and down) and -1 (wound back). */
const STRIKE = [-0.55, -0.34, -0.3, -0.26, -0.2, -0.35] as const;
const WIND = [0.3, 0.2, 0.16, 0.12, 0.1, 0.2] as const;
const AIM = [0.12, 0.12, 0.1, -0.1, -0.2, -0.35] as const;

export function createScorpionRig(assets: ScorpionAssets): ScorpionRig {
  const group = new Group();
  const turn = new Group();
  turn.rotation.y = Math.PI;
  turn.position.y = assets.groundOffset * assets.scale;
  turn.scale.setScalar(assets.scale);
  group.add(turn);

  const glowMaterial = new MeshStandardMaterial({ color: 0x0c2a10, emissive: 0x38ff4a, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.25 });

  const pivots = {} as Record<PivotName, Group>;
  const restQuat = {} as Record<PivotName, Quaternion>;
  const restPos = {} as Record<PivotName, Vector3>;
  let meshCount = 0;
  for (const p of PIVOTS) {
    const g = new Group();
    const q = new Quaternion();
    const pos = new Vector3();
    assets.rest[p].decompose(pos, q, scratchScale);
    g.position.copy(pos);
    g.quaternion.copy(q);
    pivots[p] = g;
    restQuat[p] = q;
    restPos[p] = pos;
    const part = assets.parts[p];
    if (part.armor) {
      const m = new Mesh(part.armor, assets.armorMaterial);
      m.castShadow = true;
      g.add(m);
      meshCount++;
    }
    if (part.glow) {
      g.add(new Mesh(part.glow, glowMaterial));
      meshCount++;
    }
  }
  for (const p of PIVOTS) {
    const par = assets.parent[p];
    (par ? pivots[par] : turn).add(pivots[p]);
  }
  const orb = new Mesh(assets.orbGeometry, glowMaterial);
  orb.position.copy(assets.orbOffset);
  orb.scale.setScalar(0.01);
  pivots.telson.add(orb);
  meshCount++;

  const setRot = (p: PivotName, axis: Vector3, angle: number): void => {
    qa.setFromAxisAngle(axis, angle);
    pivots[p].quaternion.copy(restQuat[p]).multiply(qa);
  };

  return {
    group,
    glowMaterial,
    meshCount,
    apply(pose) {
      const t = pose.time;
      const breathe = Math.sin(t * 2.4) * 0.025;
      // body: the pipeline frame has the head on +Z, so a positive X rotation lowers it
      pivots.body.position.set(restPos.body.x, restPos.body.y + breathe - pose.crouch * 0.22, restPos.body.z);
      setRot('body', AX, pose.pitch);
      // legs: alternating tetrapod gait, each leg swings about its own hip and lifts on the way forward
      const amp = 0.28 * pose.walk;
      const lift = 0.42 * pose.walk;
      for (let i = 0; i < LEG_INFO.length; i++) {
        const info = LEG_INFO[i] as { side: number; setA: boolean };
        const p = pose.walkPhase + (info.setA ? 0 : Math.PI) + i * 0.12;
        const swing = Math.sin(p) * amp;
        const up = Math.max(0, Math.cos(p)) * lift + pose.crouch * 0.35;
        const leg = LEG_PIVOTS[i] as PivotName;
        qa.setFromAxisAngle(AY, info.side * swing);
        qb.setFromAxisAngle(AX, -info.side * up);
        pivots[leg].quaternion.copy(restQuat[leg]).multiply(qa).multiply(qb);
      }
      // tail: breathing sway plus strike / wind-up / aim curls (pivot Z is the curl axis)
      const strike = Math.max(0, pose.tailStrike);
      const wind = Math.max(0, -pose.tailStrike);
      for (let i = 0; i < TAIL.length; i++) {
        const sway = Math.sin(t * 1.8 - i * 0.7) * 0.035 * pose.tailLash;
        setRot(TAIL[i] as PivotName, AZ, sway + (STRIKE[i] as number) * strike + (WIND[i] as number) * wind + (AIM[i] as number) * pose.tailAim);
      }
      // claws: spread outwards and lift; fingers snap
      const idle = Math.sin(t * 1.3) * 0.04;
      setRot('clawR', AY, -(pose.claws * 0.45 + idle));
      setRot('clawL', AY, pose.claws * 0.45 + idle);
      const open = pose.snap * 0.55;
      setRot('fingerR', AY, -open);
      setRot('fingerL', AY, open);
      orb.scale.setScalar(0.01 + pose.charge * 1.6 * (1 + Math.sin(t * 40) * 0.08));
      const flick = pose.flicker > 0 ? 1 - pose.flicker * (0.5 + 0.5 * Math.sin(t * 61) * Math.sin(t * 23)) : 1;
      glowMaterial.emissiveIntensity = (pose.glow + pose.charge * 3) * flick;
    },
    stingerWorld(out) {
      return orb.getWorldPosition(out);
    },
    dispose() {
      glowMaterial.dispose();
    },
  };
}
