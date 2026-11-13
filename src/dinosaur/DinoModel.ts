import {
  Box3,
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
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  red: 0xcc1111,
  dark: 0x181818,
  light: 0xdddddd,
  joint: 0x333333,
  claw: 0x1a1a1a,
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

/** Builds the reference hierarchy (same numbers as the demo). Returns the root and key groups. */
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
  const chest = tagged(new BoxGeometry(0.9, 1.1, 1.3), 'red');
  chest.position.set(0, 0.5, 0.1);
  torso.add(chest);
  const plate = tagged(new BoxGeometry(0.95, 0.5, 1.1), 'dark');
  plate.position.set(0, 0.45, 0.25);
  torso.add(plate);
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
  const skull = tagged(new BoxGeometry(0.75, 0.75, 1.1), 'red');
  skull.position.set(0, 0.2, 0.15);
  head.add(skull);
  const snout = tagged(new BoxGeometry(0.65, 0.5, 0.85), 'red');
  snout.position.set(0, 0.1, 0.85);
  head.add(snout);
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
  const jawGroup = new Group();
  jawGroup.position.set(0, -0.05, 0.5);
  jawGroup.userData.pivot = 'jaw';
  head.add(jawGroup);
  const jaw = tagged(new BoxGeometry(0.6, 0.3, 0.9), 'dark');
  jaw.position.set(0, -0.1, 0.3);
  jawGroup.add(jaw);
  for (let i = 0; i < 5; i++) {
    const z = 0.45 + i * 0.12;
    for (const x of [-0.31, 0.31]) {
      const up = tagged(new ConeGeometry(0.04, 0.15, 4), 'light');
      up.position.set(x, -0.15, z);
      up.rotation.x = Math.PI;
      head.add(up);
      const low = tagged(new ConeGeometry(0.035, 0.13, 4), 'light');
      low.position.set(x * 0.9, 0.08, z - 0.05);
      jawGroup.add(low);
    }
  }
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
    const foot = tagged(new BoxGeometry(0.35, 0.3, 0.65), 'light');
    foot.position.set(0, -1.8, 0.25);
    leg.add(foot);
    for (let i = 0; i < 3; i++) {
      const toe = tagged(new ConeGeometry(0.07, 0.3, 6), 'claw');
      toe.position.set((i - 1) * 0.11, -1.92, 0.55);
      toe.rotation.x = Math.PI / 2;
      leg.add(toe);
    }
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
    const box = tagged(new BoxGeometry(0.6 * scale, 0.55 * scale, 0.5 * scale), i % 2 === 0 ? 'red' : 'dark');
    box.position.set(0, 0.1 * scale, -0.2);
    seg.add(box);
    if (i < 8) {
      const spine = tagged(new ConeGeometry(0.08 * scale, 0.25 * scale, 4), 'glow');
      spine.position.set(0, 0.35 * scale, -0.2);
      spine.rotation.x = -Math.PI / 6;
      seg.add(spine);
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

  const armorMaterial = new MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.4 });

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
}

export function createPose(): DinoPose {
  return { walkPhase: 0, walk: 0, time: 0, roar: 0, crouch: 0, glow: 1.5, tailWind: 0 };
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
      const swing = Math.sin(pose.walkPhase) * 0.55 * pose.walk;
      setRot('legL', AX, swing + pose.crouch * 0.3);
      setRot('legR', AX, -swing + pose.crouch * 0.3);
      // the legs hang under the body pivot: lift them back by the crouch drop so the feet stay put
      pivots.legL.position.set(restPos.legL.x, restPos.legL.y + pose.crouch * 0.55, restPos.legL.z);
      pivots.legR.position.set(restPos.legR.x, restPos.legR.y + pose.crouch * 0.55, restPos.legR.z);
      // tail: travelling wave, three chunks
      const base = pose.tailWind;
      setRot('tailA', AY, Math.sin(t * 2.5) * 0.12 + base * 0.4);
      setRot('tailB', AY, Math.sin(t * 2.5 - 1.2) * 0.12 + base * 0.35);
      setRot('tailC', AY, Math.sin(t * 2.5 - 2.4) * 0.12 + base * 0.25);
      setRot('jaw', AX, -0.6 * pose.roar);
      const ts = 0.01 + 1.5 * pose.roar;
      throat.scale.setScalar(ts);
      glowMaterial.emissiveIntensity = pose.glow + pose.roar * 1.5;
    },
    dispose() {
      glowMaterial.dispose();
    },
  };
}
