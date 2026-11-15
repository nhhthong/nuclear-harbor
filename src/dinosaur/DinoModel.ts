import {
  Box3,
  BufferAttribute,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWeatheredPaint } from '@/world/containerModel';
import { DINO } from './tunables';

/**
 * Port of docs/reference-models/dinosaur_semi_boss.html ("Crimson Rex"). The reference hierarchy is
 * built once with plain meshes, flattened per animated part (pivot) into one merged geometry per
 * material (vertex-coloured armour + emissive glow) and the temporary hierarchy is thrown away.
 * Result: 14 draw calls per dinosaur instead of ~150 meshes.
 *
 * Reference space: head towards +Z, tail towards -Z. The final model is turned by PI so the head
 * faces -Z (game yaw 0), shifted so the feet touch y = 0 and scaled to DINO.heightM.
 */

export type PivotName = 'body' | 'legL' | 'legR' | 'tailA' | 'tailB' | 'tailC' | 'jaw';
const PIVOTS: readonly PivotName[] = ['body', 'legL', 'legR', 'tailA', 'tailB', 'tailC', 'jaw'];

const PALETTE = {
  red: 0x7d0d0d,
  dark: 0x111114,
  light: 0x8f949a,
  joint: 0x2a2c30,
  claw: 0x0b0b0c,
  bone: 0xd6cdb4,
  steel: 0x4c5158,
} as const;
type Tag = keyof typeof PALETTE | 'glow';

const DUMMY = new MeshBasicMaterial();

interface PartGeometries {
  armor: BufferGeometry | null;
  glow: BufferGeometry | null;
}

/** Shared (one per module init) geometry + armour material + pivot rest transforms. */
export interface DinoAssets {
  parts: Record<PivotName, PartGeometries>;
  throatGeometry: BufferGeometry;
  armorMaterial: MeshStandardMaterial;
  /** Rest transform of each pivot relative to its parent pivot (model space before the final scale). */
  rest: Record<PivotName, Matrix4>;
  parent: Record<PivotName, PivotName | null>;
  /** Throat core position relative to the jaw pivot. */
  throatOffset: Vector3;
  /** Final uniform scale, vertical offset (applied before scaling) and unscaled height. */
  scale: number;
  groundOffset: number;
  dispose(): void;
}

function tagged(geo: BufferGeometry, tag: Tag): Mesh {
  const mesh = new Mesh(geo, DUMMY);
  mesh.userData.tag = tag;
  return mesh;
}

/** Tagged mesh with position and Euler rotation in one call. */
function part(parent: Object3D, geo: BufferGeometry, tag: Tag, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): Mesh {
  const mesh = tagged(geo, tag);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

interface Section {
  z: number;
  /** Centre height, width and height of the cross-section. */
  y: number;
  w: number;
  h: number;
}

/**
 * Smooth skin lofted through cross-sections along Z (ascending). Each section is a superellipse
 * (`power` 2 = ellipse, higher = squarer with rounded corners), so bodies, skulls and tails read as
 * shaped armour shells instead of boxes. Ends are closed with flat caps.
 */
function loft(sections: readonly Section[], sides = 16, power = 2.8): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const e = 2 / power;
  const ring = (sec: Section): number => {
    const start = pos.length / 3;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      pos.push((sec.w / 2) * Math.sign(c) * Math.abs(c) ** e, sec.y + (sec.h / 2) * Math.sign(sn) * Math.abs(sn) ** e, sec.z);
    }
    return start;
  };
  const starts = sections.map(ring);
  for (let k = 0; k < sections.length - 1; k++) {
    const a = starts[k] as number;
    const b = starts[k + 1] as number;
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides;
      idx.push(a + j, a + j1, b + j, a + j1, b + j1, b + j);
    }
  }
  // caps on their own vertices so the rim stays a hard edge
  const cap = (sec: Section, front: boolean): void => {
    const start = ring(sec);
    const centre = pos.length / 3;
    pos.push(0, sec.y, sec.z);
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides;
      if (front) idx.push(centre, start + j, start + j1);
      else idx.push(centre, start + j1, start + j);
    }
  };
  cap(sections[0] as Section, false);
  cap(sections[sections.length - 1] as Section, true);
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Flat blade: a 4-sided cone squashed sideways. */
function blade(radius: number, height: number, thickness = 0.28): BufferGeometry {
  const g = new ConeGeometry(radius, height, 4);
  g.rotateY(Math.PI / 4);
  g.scale(thickness, 1, 1);
  return g;
}

/**
 * Builds the reference hierarchy: the demo's proportions plus the "Crimson Rex" war kit (horns, brow
 * ridges, fangs, rib cage, dorsal blades, exhausts, pistons, spurs, tail blades). Returns the root and key groups.
 */
function buildReference(): { root: Group; throat: Mesh; jawGroup: Group } {
  const mecha = new Group();
  const rig = new Group();
  mecha.add(rig);

  // 1. hips
  const hipGeo = new CylinderGeometry(0.55, 0.5, 0.7, 16);
  hipGeo.rotateZ(Math.PI / 2);
  const hip = tagged(hipGeo, 'dark');
  hip.position.set(0, 1.2, 0);
  rig.add(hip);

  // 2. torso
  const torso = new Group();
  torso.position.set(0, 1.2, 0);
  rig.add(torso);
  // barrel chest: one lofted shell, a darker armour belt around it and a keel plate
  const chest = tagged(
    loft([
      { z: -0.62, y: 0.42, w: 0.62, h: 0.7 },
      { z: -0.3, y: 0.48, w: 0.88, h: 1.02 },
      { z: 0.15, y: 0.52, w: 0.96, h: 1.16 },
      { z: 0.55, y: 0.5, w: 0.9, h: 1.04 },
      { z: 0.8, y: 0.46, w: 0.66, h: 0.74 },
    ]),
    'red',
  );
  torso.add(chest);
  const plate = tagged(
    loft([
      { z: -0.05, y: 0.5, w: 1.0, h: 1.18 },
      { z: 0.25, y: 0.52, w: 1.02, h: 1.22 },
      { z: 0.5, y: 0.5, w: 0.97, h: 1.12 },
    ]),
    'dark',
  );
  torso.add(plate);
  part(torso, loft([{ z: -0.45, y: -0.06, w: 0.3, h: 0.16 }, { z: 0.2, y: -0.1, w: 0.42, h: 0.2 }, { z: 0.72, y: -0.02, w: 0.3, h: 0.16 }], 10, 2), 'steel', 0, 0, 0);
  const coreGeo = new CylinderGeometry(0.22, 0.22, 0.15, 20);
  coreGeo.rotateX(Math.PI / 2);
  const core = tagged(coreGeo, 'glow');
  core.position.set(0, 0.45, 0.81);
  torso.add(core);
  for (const x of [-0.52, 0.52]) {
    const j = tagged(new CylinderGeometry(0.18, 0.18, 0.2, 16), 'light');
    j.rotation.x = Math.PI / 2;
    j.position.set(x, 0.8, 0.3);
    torso.add(j);
  }

  // rib cage, reactor ring, dorsal blades, exhausts, shoulder armour, belly cables
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) part(torso, new BoxGeometry(0.1, 0.72 - i * 0.06, 0.11), 'bone', sx * 0.5, 0.42, -0.34 + i * 0.3, 0, 0, sx * 0.14);
    part(torso, new CylinderGeometry(0.075, 0.1, 0.75, 10), 'steel', sx * 0.3, 1.22, -0.42, -0.7, 0, 0);
    part(torso, new CylinderGeometry(0.11, 0.11, 0.16, 10), 'dark', sx * 0.3, 1.05, -0.28, -0.7, 0, 0);
    part(torso, new SphereGeometry(0.065, 8, 6), 'glow', sx * 0.3, 1.5, -0.655);
    part(torso, new BoxGeometry(0.3, 0.36, 0.62), 'red', sx * 0.6, 0.86, 0.42, 0, 0, sx * -0.3);
    part(torso, new BoxGeometry(0.32, 0.07, 0.66), 'dark', sx * 0.66, 1.05, 0.42, 0, 0, sx * -0.3);
    part(torso, new ConeGeometry(0.08, 0.42, 5), 'bone', sx * 0.82, 1.06, 0.42, 0, 0, sx * -1.15);
    part(torso, new CylinderGeometry(0.05, 0.05, 1.0, 8), 'joint', sx * 0.2, -0.12, 0.1, Math.PI / 2, 0, 0);
    part(torso, new CylinderGeometry(0.03, 0.03, 0.9, 6), 'steel', sx * 0.32, -0.08, 0.1, Math.PI / 2, 0, 0);
  }
  part(torso, new TorusGeometry(0.3, 0.05, 8, 20), 'light', 0, 0.45, 0.77);
  part(torso, new BoxGeometry(0.1, 0.05, 1.3), 'glow', 0, 1.065, 0.08);
  for (let i = 0; i < 5; i++) {
    const h = 0.62 + Math.sin((i / 4) * Math.PI) * 0.42;
    part(torso, blade(0.24, h), 'dark', 0, 1.05 + h * 0.42, 0.55 - i * 0.27, -0.38, 0, 0);
    part(torso, blade(0.1, h * 0.55, 0.5), 'glow', 0, 1.02 + h * 0.3, 0.5 - i * 0.27, -0.38, 0, 0);
  }

  // 3. neck + head
  const neck = new Group();
  neck.position.set(0, 1.1, 0.4);
  torso.add(neck);
  const neckMesh = tagged(new CylinderGeometry(0.35, 0.45, 0.9, 16), 'dark');
  neckMesh.rotation.x = -Math.PI / 6;
  neckMesh.position.set(0, 0.35, -0.1);
  neck.add(neckMesh);
  for (let i = 0; i < 4; i++) {
    const sp = tagged(new BoxGeometry(0.25, 0.18, 0.15), 'red');
    sp.position.set(0, 0.1 + i * 0.18, -0.32 - i * 0.05);
    sp.rotation.x = Math.PI / 8;
    neck.add(sp);
  }
  const head = new Group();
  head.position.set(0, 0.8, -0.25);
  neck.add(head);
  // skull and snout as one tapering shell (wide braincase, narrow muzzle with a raised nose)
  const skull = tagged(
    loft([
      { z: -0.45, y: 0.24, w: 0.5, h: 0.5 },
      { z: -0.2, y: 0.22, w: 0.76, h: 0.74 },
      { z: 0.3, y: 0.2, w: 0.78, h: 0.72 },
      { z: 0.62, y: 0.14, w: 0.68, h: 0.56 },
      { z: 1.0, y: 0.1, w: 0.6, h: 0.48 },
      { z: 1.22, y: 0.1, w: 0.52, h: 0.44 },
      { z: 1.3, y: 0.08, w: 0.38, h: 0.32 },
    ]),
    'red',
  );
  head.add(skull);
  for (const x of [-0.38, 0.38]) {
    const eye = tagged(new SphereGeometry(0.09, 10, 10), 'glow');
    eye.position.set(x, 0.3, 0.35);
    head.add(eye);
  }
  for (const x of [-0.4, 0.4]) {
    const ear = tagged(new CylinderGeometry(0.2, 0.2, 0.1, 16), 'light');
    ear.rotation.z = Math.PI / 2;
    ear.position.set(x, 0.1, -0.1);
    head.add(ear);
  }
  // brow ridges, eye slits, horns, crest, cheek and snout armour, nostril vents, fangs, jaw rams
  for (const sx of [-1, 1]) {
    part(head, new BoxGeometry(0.16, 0.13, 0.66), 'dark', sx * 0.36, 0.5, 0.34, -0.2, 0, sx * 0.4);
    part(head, new BoxGeometry(0.02, 0.06, 0.36), 'glow', sx * 0.392, 0.3, 0.46);
    part(head, new ConeGeometry(0.095, 0.62, 6), 'bone', sx * 0.3, 0.78, -0.3, -1.0, 0, sx * -0.25);
    part(head, new ConeGeometry(0.06, 0.34, 6), 'bone', sx * 0.22, 0.7, 0.02, -0.8, 0, sx * -0.2);
    part(head, new BoxGeometry(0.08, 0.52, 0.72), 'dark', sx * 0.41, 0.03, 0.08);
    part(head, new BoxGeometry(0.1, 0.05, 0.02), 'glow', sx * 0.18, 0.22, 1.283);
    part(head, new ConeGeometry(0.06, 0.34, 5), 'bone', sx * 0.24, -0.3, 1.18, Math.PI, 0, 0);
    part(head, new CylinderGeometry(0.035, 0.035, 0.5, 8), 'light', sx * 0.4, -0.12, 0.2, 0.9, 0, 0);
  }
  // nasal armour following the muzzle
  part(head, loft([{ z: 0.5, y: 0.4, w: 0.46, h: 0.14 }, { z: 0.9, y: 0.34, w: 0.44, h: 0.14 }, { z: 1.26, y: 0.28, w: 0.3, h: 0.1 }], 10, 2.4), 'dark', 0, 0, 0);
  for (let i = 0; i < 4; i++) part(head, blade(0.1, 0.34 - i * 0.03, 0.4), 'glow', 0, 0.68, -0.32 + i * 0.24, -0.55, 0, 0);
  const jawGroup = new Group();
  jawGroup.position.set(0, -0.05, 0.5);
  jawGroup.userData.pivot = 'jaw';
  head.add(jawGroup);
  const jaw = tagged(
    loft([
      { z: -0.2, y: -0.08, w: 0.64, h: 0.34 },
      { z: 0.3, y: -0.1, w: 0.62, h: 0.3 },
      { z: 0.68, y: -0.1, w: 0.5, h: 0.24 },
      { z: 0.8, y: -0.09, w: 0.34, h: 0.16 },
    ]),
    'dark',
  );
  jawGroup.add(jaw);
  for (let i = 0; i < 5; i++) {
    const z = 0.45 + i * 0.12;
    for (const x of [-0.31, 0.31]) {
      const up = tagged(new ConeGeometry(0.045, 0.2, 4), 'bone');
      up.position.set(x, -0.15, z);
      up.rotation.x = Math.PI;
      head.add(up);
      const low = tagged(new ConeGeometry(0.04, 0.17, 4), 'bone');
      low.position.set(x * 0.9, 0.08, z - 0.05);
      jawGroup.add(low);
    }
  }
  for (const sx of [-1, 1]) {
    part(jawGroup, new BoxGeometry(0.05, 0.2, 0.82), 'red', sx * 0.32, -0.12, 0.3);
    part(jawGroup, new ConeGeometry(0.05, 0.28, 5), 'bone', sx * 0.25, 0.16, 0.66);
  }
  part(jawGroup, new ConeGeometry(0.07, 0.3, 5), 'bone', 0, -0.32, 0.66, Math.PI * 0.92, 0, 0);
  const throat = new Mesh(new SphereGeometry(0.18, 12, 12), DUMMY);
  throat.position.set(0, 0.05, 0.7);
  head.add(throat);

  // 4. little arms
  for (const x of [-0.5, 0.5]) {
    const arm = new Group();
    arm.position.set(x, 0.8, 0.7);
    arm.rotation.x = -Math.PI / 6;
    const bicep = tagged(new CylinderGeometry(0.08, 0.07, 0.4, 10), 'dark');
    bicep.position.set(0, -0.2, 0);
    arm.add(bicep);
    const fore = tagged(new CylinderGeometry(0.06, 0.05, 0.35, 10), 'light');
    fore.position.set(0, -0.5, 0.1);
    fore.rotation.x = Math.PI / 4;
    arm.add(fore);
    for (let i = 0; i < 2; i++) {
      const claw = tagged(new ConeGeometry(0.03, 0.15, 6), 'claw');
      claw.position.set((i - 0.5) * 0.06, -0.7, 0.22);
      claw.rotation.x = Math.PI / 3;
      arm.add(claw);
    }
    part(arm, blade(0.06, 0.4, 0.35), 'bone', 0, -0.74, 0.32, Math.PI / 2.6, 0, 0);
    torso.add(arm);
  }

  // 5. legs
  for (const x of [-0.65, 0.65]) {
    const leg = new Group();
    leg.position.set(x, 0.9, 0.1);
    leg.userData.pivot = x < 0 ? 'legL' : 'legR';
    rig.add(leg);
    const thigh = tagged(new CylinderGeometry(0.32, 0.25, 0.9, 14), 'red');
    thigh.position.set(0, -0.4, 0);
    thigh.rotation.x = -Math.PI / 12;
    leg.add(thigh);
    const knee = tagged(new SphereGeometry(0.22, 12, 12), 'glow');
    knee.position.set(0, -0.85, 0.1);
    leg.add(knee);
    const shin = tagged(new CylinderGeometry(0.22, 0.18, 0.85, 14), 'dark');
    shin.position.set(0, -1.35, 0.15);
    shin.rotation.x = Math.PI / 10;
    leg.add(shin);
    const foot = tagged(
      loft([{ z: -0.14, y: -1.82, w: 0.3, h: 0.24 }, { z: 0.2, y: -1.8, w: 0.42, h: 0.32 }, { z: 0.6, y: -1.84, w: 0.4, h: 0.22 }], 12, 2.6),
      'light',
    );
    leg.add(foot);
    for (let i = 0; i < 3; i++) {
      const toe = tagged(new ConeGeometry(0.085, 0.44, 6), 'claw');
      toe.position.set((i - 1) * 0.13, -1.9, 0.66);
      toe.rotation.x = Math.PI / 2 + 0.15;
      leg.add(toe);
    }
    const sx = Math.sign(x);
    part(leg, new BoxGeometry(0.12, 0.78, 0.52), 'dark', sx * 0.3, -0.4, 0, -Math.PI / 12, 0, 0);
    part(leg, new BoxGeometry(0.13, 0.08, 0.54), 'red', sx * 0.31, -0.1, 0.03, -Math.PI / 12, 0, 0);
    part(leg, new ConeGeometry(0.09, 0.42, 5), 'bone', 0, -0.85, 0.4, Math.PI / 2, 0, 0);
    part(leg, new CylinderGeometry(0.045, 0.045, 0.82, 8), 'light', 0, -0.9, -0.24, 0.15, 0, 0);
    part(leg, new CylinderGeometry(0.065, 0.065, 0.4, 8), 'steel', 0, -0.62, -0.22, 0.15, 0, 0);
    part(leg, new ConeGeometry(0.07, 0.34, 5), 'claw', 0, -1.76, -0.2, -Math.PI / 2, 0, 0);
    part(leg, new BoxGeometry(0.46, 0.12, 0.52), 'dark', 0, -1.62, 0.25);
  }

  // 6. tail: 11 segments, grouped into three rigid chunks (A: 0-3, B: 4-7, C: 8-10)
  let parent: Object3D = rig;
  for (let i = 0; i < 11; i++) {
    const seg = new Group();
    if (i === 0) seg.position.set(0, 1.1, -0.4);
    else seg.position.set(0, 0, -0.45);
    if (i === 0) seg.userData.pivot = 'tailA';
    if (i === 4) seg.userData.pivot = 'tailB';
    if (i === 8) seg.userData.pivot = 'tailC';
    const scale = Math.max(0.4, 1 - i * 0.07);
    // continuous tapering tail: each link runs into the size of the next one, with a dark band at the joint
    const next = i === 10 ? scale * 0.7 : Math.max(0.4, 1 - (i + 1) * 0.07);
    const box = tagged(
      loft(
        [
          { z: -0.5, y: 0.1 * next, w: 0.6 * next, h: 0.55 * next },
          { z: -0.2, y: 0.1 * scale, w: 0.6 * (scale + next) * 0.5, h: 0.56 * (scale + next) * 0.5 },
          { z: 0.06, y: 0.1 * scale, w: 0.6 * scale, h: 0.55 * scale },
        ],
        12,
        2.4,
      ),
      'red',
    );
    seg.add(box);
    part(seg, loft([{ z: -0.03, y: 0.1 * scale, w: 0.66 * scale, h: 0.6 * scale }, { z: 0.07, y: 0.1 * scale, w: 0.66 * scale, h: 0.6 * scale }], 12, 2.4), 'dark', 0, 0, 0);
    if (i < 8) {
      const spine = tagged(new ConeGeometry(0.08 * scale, 0.25 * scale, 4), 'glow');
      spine.position.set(0, 0.35 * scale, -0.2);
      spine.rotation.x = -Math.PI / 6;
      seg.add(spine);
    }
    for (const sx of [-1, 1]) part(seg, blade(0.09 * scale, 0.42 * scale, 0.4), 'dark', sx * 0.38 * scale, 0.1 * scale, -0.2, 0, 0, sx * -Math.PI / 2);

    if (i === 10) {
      // tail club: four bone spikes and a glowing blade
      for (const sx of [-1, 1]) {
        part(seg, new ConeGeometry(0.07, 0.56, 5), 'bone', sx * 0.3, 0.12, -0.36, 0, 0, sx * -1.25);
        part(seg, new ConeGeometry(0.06, 0.46, 5), 'bone', sx * 0.14, 0.34, -0.4, -0.5, 0, sx * -0.4);
      }
      part(seg, blade(0.16, 0.6, 0.3), 'glow', 0, 0.06, -0.62, -Math.PI / 2, 0, 0);
    }
    parent.add(seg);
    parent = seg;
  }

  return { root: mecha, throat, jawGroup };
}

function nearestPivot(node: Object3D, includeSelf: boolean): PivotName | null {
  let n: Object3D | null = includeSelf ? node : node.parent;
  while (n) {
    const p = n.userData.pivot as PivotName | undefined;
    if (p) return p;
    n = n.parent;
  }
  return null;
}

const tmpColor = new Color();

/** Builds the shared geometries (once). The caller tracks/disposes through `dispose()`. */
export function createDinoAssets(): DinoAssets {
  const { root, throat, jawGroup } = buildReference();
  root.updateMatrixWorld(true);

  const groups = new Map<PivotName, Object3D>();
  groups.set('body', root);
  root.traverse((n) => {
    const p = n.userData.pivot as PivotName | undefined;
    if (p) groups.set(p, n);
  });

  const bucket: Record<PivotName, { armor: BufferGeometry[]; glow: BufferGeometry[] }> = {} as never;
  for (const p of PIVOTS) bucket[p] = { armor: [], glow: [] };

  const inv = new Matrix4();
  const rel = new Matrix4();
  root.traverse((n) => {
    if (!(n as Mesh).isMesh || n === throat) return;
    const mesh = n as Mesh;
    const pivot = nearestPivot(mesh, false) ?? 'body';
    const owner = groups.get(pivot) as Object3D;
    inv.copy(owner.matrixWorld).invert();
    rel.multiplyMatrices(inv, mesh.matrixWorld);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(rel);
    const tag = mesh.userData.tag as Tag;
    if (tag === 'glow') {
      geo.deleteAttribute('uv');
      bucket[pivot].glow.push(geo);
    } else {
      tmpColor.setHex(PALETTE[tag]);
      const count = geo.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
      geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
      geo.deleteAttribute('uv');
      bucket[pivot].armor.push(geo);
    }
  });

  const parts = {} as Record<PivotName, PartGeometries>;
  for (const p of PIVOTS) {
    const merge = (list: BufferGeometry[]): BufferGeometry | null => {
      if (list.length === 0) return null;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      return merged;
    };
    parts[p] = { armor: merge(bucket[p].armor), glow: merge(bucket[p].glow) };
  }

  // pivot rest transforms relative to the parent pivot
  const rest = {} as Record<PivotName, Matrix4>;
  const parent = {} as Record<PivotName, PivotName | null>;
  for (const p of PIVOTS) {
    const g = groups.get(p) as Object3D;
    const par = p === 'body' ? null : (nearestPivot(g, false) ?? 'body');
    parent[p] = par;
    if (par === null) {
      rest[p] = new Matrix4();
    } else {
      const pg = groups.get(par) as Object3D;
      rest[p] = new Matrix4().copy(pg.matrixWorld).invert().multiply(g.matrixWorld);
    }
  }
  // the jaw pivot hangs under the body pivot (head is static)

  const throatOffset = new Vector3();
  {
    const m = new Matrix4().copy(jawGroup.matrixWorld).invert().multiply(throat.matrixWorld);
    throatOffset.setFromMatrixPosition(m);
  }

  // height and ground level from the assembled rest pose
  const box = new Box3().setFromObject(root);
  const rawHeight = box.max.y - box.min.y;
  const scale = DINO.heightM / rawHeight;
  const groundOffset = -box.min.y;

  const throatGeometry = new SphereGeometry(0.18, 12, 12);
  throatGeometry.deleteAttribute('uv');

  root.traverse((n) => {
    const m = n as Mesh;
    if (m.isMesh) m.geometry.dispose();
  });

  const armorMaterial = new MeshStandardMaterial({ vertexColors: true, metalness: 0.72, roughness: 0.36 });
  applyWeatheredPaint(armorMaterial, { bottomY: -1, height: 5, wear: 0.55, key: 'dino', local: true, detail: 4 });

  return {
    parts,
    throatGeometry,
    armorMaterial,
    rest,
    parent,
    throatOffset,
    scale,
    groundOffset,
    dispose() {
      for (const p of PIVOTS) {
        parts[p].armor?.dispose();
        parts[p].glow?.dispose();
      }
      throatGeometry.dispose();
      armorMaterial.dispose();
    },
  };
}

/** Per-frame inputs of the pose. All values are cheap numbers; nothing is allocated per frame. */
export interface DinoPose {
  /** Walk cycle phase (rad) and amount 0..1. */
  walkPhase: number;
  walk: number;
  /** Seconds, for breathing and the tail wave. */
  time: number;
  /** 0..1 jaw open + throat glow. */
  roar: number;
  /** 0..1 crouch before a leap. */
  crouch: number;
  /** Glow emissive intensity. */
  glow: number;
  /** Extra tail yaw (rad), used by the tail spin wind-up. */
  tailWind: number;
  /** Body lean (rad): positive lowers the head (charge, stun), negative rears up (roar, leap). */
  pitch: number;
  /** 0..1 legs tucked back (airborne). */
  legTuck: number;
  /** Tail wave multiplier (1 = calm). */
  tailLash: number;
  /** 0..1 damage flicker of the glow. */
  flicker: number;
}

export function createPose(): DinoPose {
  return { walkPhase: 0, walk: 0, time: 0, roar: 0, crouch: 0, glow: 1.5, tailWind: 0, pitch: 0, legTuck: 0, tailLash: 1, flicker: 0 };
}

const qa = new Quaternion();
const qb = new Quaternion();
const AX = new Vector3(1, 0, 0);
const AY = new Vector3(0, 1, 0);
const scratchPos = new Vector3();
const scratchScale = new Vector3();

/** Hit-volume reference points (model reference space) used by the collider builder. */
export interface DinoRig {
  group: Group;
  glowMaterial: MeshStandardMaterial;
  /** Number of meshes (== draw calls when visible and unculled). */
  meshCount: number;
  apply(pose: DinoPose): void;
  dispose(): void;
}

/** One dinosaur instance: meshes share the asset geometries and the armour material. */
export function createDinoRig(assets: DinoAssets): DinoRig {
  const group = new Group();
  const turn = new Group();
  turn.rotation.y = Math.PI;
  turn.position.y = assets.groundOffset * assets.scale;
  turn.scale.setScalar(assets.scale);
  group.add(turn);

  const glowMaterial = new MeshStandardMaterial({
    color: 0xff5500,
    emissive: 0xff4400,
    emissiveIntensity: 1.5,
    metalness: 0.5,
    roughness: 0.2,
  });

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
      g.add(new Mesh(part.armor, assets.armorMaterial));
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
  const throat = new Mesh(assets.throatGeometry, glowMaterial);
  throat.position.copy(assets.throatOffset);
  throat.scale.setScalar(0.01);
  pivots.jaw.add(throat);
  meshCount++;

  function setRot(p: PivotName, axis: Vector3, angle: number): void {
    qa.setFromAxisAngle(axis, angle);
    qb.copy(restQuat[p]).multiply(qa);
    pivots[p].quaternion.copy(qb);
  }

  return {
    group,
    glowMaterial,
    meshCount,
    apply(pose) {
      const t = pose.time;
      const breathe = Math.sin(t * 3) * 0.04;
      scratchPos.copy(restPos.body);
      pivots.body.position.set(scratchPos.x, scratchPos.y + breathe - pose.crouch * 0.55, scratchPos.z);
      // lean of the whole body; the legs counter-rotate so the feet stay planted
      setRot('body', AX, pose.pitch);
      const swing = Math.sin(pose.walkPhase) * 0.55 * pose.walk;
      const legBase = pose.crouch * 0.3 - pose.pitch + pose.legTuck * 0.75;
      setRot('legL', AX, swing + legBase);
      setRot('legR', AX, -swing + legBase);
      // the legs hang under the body pivot: lift them back by the crouch drop so the feet stay put
      pivots.legL.position.set(restPos.legL.x, restPos.legL.y + pose.crouch * 0.55, restPos.legL.z);
      pivots.legR.position.set(restPos.legR.x, restPos.legR.y + pose.crouch * 0.55, restPos.legR.z);
      // tail: travelling wave, three chunks
      const base = pose.tailWind;
      const lash = 0.12 * pose.tailLash;
      const rate = 2.5 + (pose.tailLash - 1) * 1.6;
      setRot('tailA', AY, Math.sin(t * rate) * lash + base * 0.4);
      setRot('tailB', AY, Math.sin(t * rate - 1.2) * lash * 1.3 + base * 0.35);
      setRot('tailC', AY, Math.sin(t * rate - 2.4) * lash * 1.6 + base * 0.25);
      setRot('jaw', AX, -0.6 * pose.roar);
      const ts = 0.01 + 1.5 * pose.roar;
      throat.scale.setScalar(ts);
      const flick = pose.flicker > 0 ? 1 - pose.flicker * (0.5 + 0.5 * Math.sin(t * 61) * Math.sin(t * 23)) : 1;
      glowMaterial.emissiveIntensity = (pose.glow + pose.roar * 1.5) * flick;
    },
    dispose() {
      glowMaterial.dispose();
    },
  };
}
