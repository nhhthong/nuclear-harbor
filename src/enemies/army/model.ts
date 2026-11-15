import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SharedAssets } from '../SharedAssets';
import { ARMY_LOCAL } from './tunables';

/**
 * Procedural port of docs/reference-models/robot_army.html (orange heavy assault mech).
 *
 * The reference scene graph is built part by part (same dimensions, poses and palette), then flattened:
 * every mesh is baked into robot space (forward = -Z, feet at y = -centerHeight, body centre at the
 * robot origin) and merged per material. Near model = 6 draw calls (armor, gunmetal, dark, chrome,
 * decal, glow); far model = 1 draw call. Textures are generated once per SharedAssets.
 */

type Key = 'armor' | 'gunmetal' | 'dark' | 'hose' | 'glass' | 'chrome' | 'shield' | 'triangle' | 'glow';

const DARK_COLORS = { dark: 0x202328, hose: 0x181a1e, glass: 0x0b131e } as const;

/** Placeholder materials used while building; the merged result uses the real shared materials. */
const placeholders = new Map<Key, MeshBasicMaterial>();
const keyOf = new Map<Material, Key>();
function placeholder(key: Key): MeshBasicMaterial {
  let m = placeholders.get(key);
  if (!m) {
    m = new MeshBasicMaterial();
    placeholders.set(key, m);
    keyOf.set(m, key);
  }
  return m;
}

/** Radial segment count, trimmed from the reference for the triangle budget. */
const seg = (n: number): number => Math.max(8, Math.round(n * 0.55));

function box(w: number, h: number, d: number): BufferGeometry {
  return new BoxGeometry(w, h, d);
}

function chamferedBox(w: number, h: number, d: number, bevel = 0.024): BufferGeometry {
  const shape = new Shape();
  const hw = Math.max(0.01, w / 2 - bevel);
  const hh = Math.max(0.01, h / 2 - bevel);
  const cut = Math.min(hw, hh) * 0.24;
  shape.moveTo(-hw + cut, -hh);
  shape.lineTo(hw - cut, -hh);
  shape.lineTo(hw, -hh + cut);
  shape.lineTo(hw, hh - cut);
  shape.lineTo(hw - cut, hh);
  shape.lineTo(-hw + cut, hh);
  shape.lineTo(-hw, hh - cut);
  shape.lineTo(-hw, -hh + cut);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  return geo;
}

function M(geo: BufferGeometry, key: Key): Mesh {
  return new Mesh(geo, placeholder(key));
}

function G(...children: Object3D[]): Group {
  const g = new Group();
  for (const c of children) g.add(c);
  return g;
}

/** Vent / missile pod grid (reference createVentPod). Missile-cell bores use the glow material. */
function ventPod(w: number, h: number, d: number, cols: number, rows: number, missile = false): Group {
  const group = new Group();
  group.add(M(chamferedBox(w, h, d, 0.015), 'gunmetal'));
  const cavity = M(box(w * 0.82, h * 0.86, d * 0.4), 'dark');
  cavity.position.z = d * 0.34;
  group.add(cavity);
  const cellW = (w * 0.74) / cols;
  const cellH = (h * 0.8) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = -w * 0.37 + cellW * (c + 0.5);
      const cy = -h * 0.4 + cellH * (r + 0.5);
      if (missile) {
        const rad = Math.min(cellW, cellH);
        const tubeGeo = new CylinderGeometry(rad * 0.36, rad * 0.36, 0.04, seg(16));
        tubeGeo.rotateX(Math.PI / 2);
        const tube = M(tubeGeo, 'chrome');
        tube.position.set(cx, cy, d * 0.51);
        group.add(tube);
        const boreGeo = new CylinderGeometry(rad * 0.24, rad * 0.24, 0.045, seg(14));
        boreGeo.rotateX(Math.PI / 2);
        const bore = M(boreGeo, 'glow');
        bore.position.set(cx, cy, d * 0.515);
        group.add(bore);
      } else {
        const louver = M(box(w * 0.72, cellH * 0.52, 0.03), 'gunmetal');
        louver.position.set(0, cy, d * 0.51);
        louver.rotation.x = 0.25;
        group.add(louver);
      }
    }
  }
  return group;
}

/** Turbine shoulder hub (reference createTurbineHub), rotor left at rest. */
function turbineHub(radius: number, depth: number, rotorX: number, flip: boolean): Group {
  const hub = new Group();
  const ringGeo = new TorusGeometry(radius, 0.042, 8, seg(36));
  ringGeo.rotateY(Math.PI / 2);
  hub.add(M(ringGeo, 'armor'));
  const drumGeo = new CylinderGeometry(radius * 0.94, radius * 0.94, depth, seg(32));
  drumGeo.rotateZ(Math.PI / 2);
  hub.add(M(drumGeo, 'gunmetal'));
  const rotor = new Group();
  const cap = M(new CylinderGeometry(radius * 0.28, radius * 0.28, 0.05, seg(20)), 'chrome');
  cap.rotation.z = Math.PI / 2;
  rotor.add(cap);
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI * 2) / 8;
    const blade = M(box(0.025, radius * 0.62, 0.045), 'chrome');
    blade.position.set(0.01, Math.cos(ang) * radius * 0.52, Math.sin(ang) * radius * 0.52);
    blade.rotation.x = ang;
    blade.rotation.y = 0.38;
    rotor.add(blade);
  }
  rotor.position.x = rotorX;
  if (flip) rotor.rotation.y = Math.PI;
  hub.add(rotor);
  return hub;
}

function centralHead(): Group {
  const head = new Group();
  head.add(M(chamferedBox(0.56, 0.54, 0.56, 0.04), 'armor'));
  const forehead = M(chamferedBox(0.46, 0.22, 0.16, 0.02), 'armor');
  forehead.position.set(0, 0.18, 0.24);
  forehead.rotation.x = -0.36;
  head.add(forehead);
  const shield = M(new PlaneGeometry(0.14, 0.14), 'shield');
  shield.position.set(0, 0.185, 0.318);
  shield.rotation.x = -0.36;
  head.add(shield);
  for (const side of [-1, 1]) {
    const eye = G(M(box(0.17, 0.065, 0.04), 'dark'), M(box(0.145, 0.045, 0.045), 'glass'));
    eye.position.set(side * 0.13, 0.06, 0.285);
    eye.rotation.set(0, side * 0.24, side * 0.22);
    head.add(eye);
  }
  const snout = M(chamferedBox(0.24, 0.22, 0.24, 0.02), 'armor');
  snout.position.set(0, -0.05, 0.28);
  head.add(snout);
  const grille = M(box(0.14, 0.08, 0.04), 'dark');
  grille.position.set(0, -0.04, 0.395);
  head.add(grille);
  const chin = M(chamferedBox(0.32, 0.12, 0.24, 0.015), 'gunmetal');
  chin.position.set(0, -0.22, 0.24);
  head.add(chin);
  for (const side of [-1, 1]) {
    const pod = new Group();
    pod.position.set(side * 0.26, -0.07, 0.22);
    pod.rotation.y = side * 0.35;
    pod.add(M(chamferedBox(0.15, 0.24, 0.18, 0.015), 'gunmetal'));
    for (const [lx, ly] of [
      [0, 0.055],
      [-0.032, -0.035],
      [0.032, -0.035],
    ] as const) {
      const ringGeo = new CylinderGeometry(0.026, 0.026, 0.04, 10);
      ringGeo.rotateX(Math.PI / 2);
      const ring = M(ringGeo, 'chrome');
      ring.position.set(lx, ly, 0.085);
      pod.add(ring);
      const glass = M(new SphereGeometry(0.018, 8, 6), 'glass');
      glass.position.set(lx, ly, 0.1);
      pod.add(glass);
    }
    head.add(pod);
  }
  return head;
}

function upperTorso(): Group {
  const torso = new Group();
  const hull = M(chamferedBox(1.26, 1.18, 0.96, 0.05), 'armor');
  hull.position.set(0, 0.58, -0.04);
  torso.add(hull);
  const cowl = M(chamferedBox(0.76, 0.72, 0.36, 0.03), 'dark');
  cowl.position.set(0, 0.62, 0.32);
  torso.add(cowl);
  const head = centralHead();
  head.position.set(0, 0.58, 0.38);
  torso.add(head);
  const hood = M(chamferedBox(0.74, 0.24, 0.76, 0.03), 'armor');
  hood.position.set(0, 1.16, 0.04);
  hood.rotation.x = 0.22;
  torso.add(hood);
  const hatch = M(chamferedBox(0.42, 0.06, 0.38, 0.012), 'armor');
  hatch.position.set(0, 1.24, 0.06);
  hatch.rotation.x = 0.22;
  torso.add(hatch);
  for (const side of [-1, 1]) {
    const topPod = ventPod(0.16, 0.22, 0.18, 1, 2, true);
    topPod.position.set(side * 0.44, 1.18, -0.06);
    torso.add(topPod);
    const antenna = M(new CylinderGeometry(0.006, 0.011, 0.68, 6), 'dark');
    antenna.position.set(side * 0.26, 1.56, -0.14);
    torso.add(antenna);
  }
  for (const side of [-1, 1]) {
    const sideChest = M(chamferedBox(0.36, 0.78, 0.72, 0.03), 'armor');
    sideChest.position.set(side * 0.64, 0.64, 0.08);
    torso.add(sideChest);
    const chestPod = ventPod(0.26, 0.56, 0.14, 2, 4, true);
    chestPod.position.set(side * 0.64, 0.65, 0.42);
    torso.add(chestPod);
    const rib = M(chamferedBox(0.32, 0.32, 0.56, 0.02), 'armor');
    rib.position.set(side * 0.54, 0.22, 0.06);
    torso.add(rib);
  }
  const abs = M(chamferedBox(0.54, 0.24, 0.28, 0.02), 'armor');
  abs.position.set(0, 0.18, 0.34);
  torso.add(abs);
  const backpack = M(chamferedBox(0.96, 0.92, 0.42, 0.035), 'gunmetal');
  backpack.position.set(0, 0.64, -0.56);
  torso.add(backpack);
  for (const side of [-1, 1]) {
    const cannon = new Group();
    cannon.position.set(side * 0.66, 0.88, -0.44);
    cannon.rotation.z = side === 1 ? -0.14 : 0.02;
    cannon.rotation.x = -0.05;
    const breech = M(chamferedBox(0.22, 0.88, 0.28, 0.02), 'gunmetal');
    breech.position.y = -0.12;
    cannon.add(breech);
    const base = M(new CylinderGeometry(0.075, 0.085, 0.46, seg(20)), 'dark');
    base.position.y = 0.52;
    cannon.add(base);
    const tip = M(new CylinderGeometry(0.055, 0.068, 0.48, seg(20)), 'gunmetal');
    tip.position.y = 0.96;
    cannon.add(tip);
    const brake = M(new CylinderGeometry(0.072, 0.072, 0.12, seg(20)), 'chrome');
    brake.position.y = 1.22;
    cannon.add(brake);
    torso.add(cannon);
  }
  // ---- heavy-assault kit: reactor exhausts, radiator fins, sensor mast, collar armour ----------
  for (const side of [-1, 1]) {
    const stack = new Group();
    stack.position.set(side * 0.3, 1.12, -0.7);
    stack.rotation.x = -0.32;
    stack.add(M(new CylinderGeometry(0.075, 0.09, 0.62, seg(18)), 'gunmetal'));
    const shroud = M(new CylinderGeometry(0.1, 0.1, 0.2, seg(18)), 'dark');
    shroud.position.y = -0.12;
    stack.add(shroud);
    const lip = M(new CylinderGeometry(0.088, 0.078, 0.06, seg(18)), 'chrome');
    lip.position.y = 0.33;
    stack.add(lip);
    const ember = M(new CylinderGeometry(0.06, 0.06, 0.02, seg(14)), 'glow');
    ember.position.y = 0.352;
    stack.add(ember);
    torso.add(stack);
    // collar plates sweeping up from the shoulders
    const collar = M(chamferedBox(0.34, 0.07, 0.62, 0.02), 'armor');
    collar.position.set(side * 0.6, 1.2, 0.0);
    collar.rotation.z = side * 0.5;
    torso.add(collar);
    const collarEdge = M(chamferedBox(0.05, 0.09, 0.64, 0.012), 'dark');
    collarEdge.position.set(side * 0.74, 1.285, 0.0);
    collarEdge.rotation.z = side * 0.5;
    torso.add(collarEdge);
    // hip tassets
    const tasset = M(chamferedBox(0.3, 0.42, 0.07, 0.02), 'armor');
    tasset.position.set(side * 0.3, -0.06, 0.42);
    tasset.rotation.x = -0.2;
    torso.add(tasset);
  }
  for (let i = 0; i < 7; i++) {
    const fin = M(box(0.7, 0.035, 0.07), 'chrome');
    fin.position.set(0, 0.3 + i * 0.1, -0.79);
    fin.rotation.x = 0.3;
    torso.add(fin);
  }
  const reactor = M(new CylinderGeometry(0.16, 0.16, 0.05, seg(20)).rotateX(Math.PI / 2), 'glow');
  reactor.position.set(0, 0.2, -0.775);
  torso.add(reactor);
  const reactorRing = M(new CylinderGeometry(0.21, 0.21, 0.04, seg(22)).rotateX(Math.PI / 2), 'chrome');
  reactorRing.position.set(0, 0.2, -0.77);
  torso.add(reactorRing);
  // sensor mast with a radar bar
  const mast = M(new CylinderGeometry(0.022, 0.03, 0.5, 8), 'gunmetal');
  mast.position.set(-0.46, 1.5, -0.4);
  torso.add(mast);
  const radar = M(chamferedBox(0.34, 0.09, 0.07, 0.015), 'dark');
  radar.position.set(-0.46, 1.78, -0.4);
  radar.rotation.y = 0.4;
  torso.add(radar);
  const radarEye = M(box(0.2, 0.03, 0.01), 'glow');
  radarEye.position.set(-0.445, 1.78, -0.362);
  radarEye.rotation.y = 0.4;
  torso.add(radarEye);
  return torso;
}

function arm(isLeft: boolean): { armRoot: Group } {
  const side = isLeft ? 1 : -1;
  const armRoot = new Group();
  armRoot.add(turbineHub(0.24, 0.28, side * 0.14, !isLeft));

  const upperArm = new Group();
  upperArm.position.set(side * 0.06, -0.34, 0);
  upperArm.add(M(new CylinderGeometry(0.11, 0.095, 0.46, seg(16)), 'dark'));
  const upperArmor = M(chamferedBox(0.24, 0.34, 0.26, 0.02), 'armor');
  upperArmor.position.y = 0.02;
  upperArm.add(upperArmor);
  const piston = M(new CylinderGeometry(0.022, 0.022, 0.42, 8), 'chrome');
  piston.position.set(side * -0.11, -0.02, 0.06);
  upperArm.add(piston);
  armRoot.add(upperArm);

  const forearm = new Group();
  forearm.position.set(0, -0.32, 0.04);
  const elbowGeo = new CylinderGeometry(0.12, 0.12, 0.26, seg(20));
  elbowGeo.rotateZ(Math.PI / 2);
  forearm.add(M(elbowGeo, 'gunmetal'));
  const forearmBox = M(chamferedBox(0.32, 0.44, 0.34, 0.025), 'armor');
  forearmBox.position.set(0, -0.26, 0.04);
  forearm.add(forearmBox);

  const hand = new Group();
  hand.position.set(0, -0.54, 0.06);
  hand.add(M(chamferedBox(0.24, 0.16, 0.24, 0.015), 'gunmetal'));
  for (let f = 0; f < 3; f++) {
    const finger = new Group();
    finger.position.set(side * 0.09, -0.06, -0.07 + f * 0.07);
    finger.rotation.z = side * -0.35;
    const s1 = M(box(0.055, 0.11, 0.052), 'gunmetal');
    s1.position.y = -0.04;
    const s2 = M(box(0.05, 0.1, 0.048), 'chrome');
    s2.position.set(side * -0.03, -0.11, 0);
    s2.rotation.z = side * -0.65;
    finger.add(s1, s2);
    hand.add(finger);
  }
  const thumb = M(box(0.06, 0.13, 0.065), 'gunmetal');
  thumb.position.set(side * -0.09, -0.08, 0.09);
  thumb.rotation.set(0.35, 0, side * 0.35);
  hand.add(thumb);
  forearm.add(hand);

  if (!isLeft) {
    const launcher = ventPod(0.18, 0.42, 0.24, 1, 2, true);
    launcher.position.set(-0.24, -0.22, 0.06);
    forearm.add(launcher);
  } else {
    const gunPod = new Group();
    gunPod.position.set(0.28, -0.18, 0.12);
    const upperPod = ventPod(0.22, 0.16, 0.36, 3, 1, true);
    upperPod.position.set(0, 0.12, 0.02);
    gunPod.add(upperPod);
    gunPod.add(M(chamferedBox(0.24, 0.2, 0.44, 0.02), 'gunmetal'));
    const barrels = new Group();
    barrels.position.set(0, -0.02, 0.24);
    for (const bx of [-0.048, 0.048]) {
      const barrel = M(new CylinderGeometry(0.036, 0.042, 0.56, seg(18)), 'gunmetal');
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, 0, 0.26);
      barrels.add(barrel);
      const tip = M(new CylinderGeometry(0.044, 0.044, 0.08, seg(18)), 'chrome');
      tip.rotation.x = Math.PI / 2;
      tip.position.set(bx, 0, 0.52);
      barrels.add(tip);
    }
    const clamp = M(box(0.18, 0.09, 0.06), 'chrome');
    clamp.position.set(0, 0, 0.36);
    barrels.add(clamp);
    gunPod.add(barrels);
    forearm.add(gunPod);
  }
  upperArm.add(forearm);
  // initial pose of the reference (idle values of the animation loop)
  if (isLeft) {
    armRoot.position.set(0.92, 0.88, 0.02);
    armRoot.rotation.set(0.08, -0.1, 0.1);
    forearm.rotation.set(-0.34, -0.16, -0.06);
  } else {
    armRoot.position.set(-0.92, 0.88, 0.02);
    armRoot.rotation.set(0.06, 0.08, -0.08);
    forearm.rotation.set(-0.22, 0.12, 0.05);
  }
  return { armRoot };
}

function leg(isLeft: boolean): Group {
  const side = isLeft ? 1 : -1;
  const legRoot = new Group();
  legRoot.position.set(side * 0.42, -0.18, 0);
  const hipGeo = new CylinderGeometry(0.18, 0.18, 0.46, seg(24));
  hipGeo.rotateZ(Math.PI / 2);
  const hip = M(hipGeo, 'gunmetal');
  hip.position.set(side * 0.22, 0, 0);
  legRoot.add(hip);

  const thigh = new Group();
  thigh.position.set(side * 0.42, -0.02, 0.02);
  thigh.rotation.z = side * 0.09;
  const thighBox = M(chamferedBox(0.38, 0.84, 0.44, 0.035), 'armor');
  thighBox.position.y = -0.36;
  thigh.add(thighBox);
  const thighVent = ventPod(0.22, 0.14, 0.06, 1, 3, false);
  thighVent.position.set(0, -0.12, 0.22);
  thigh.add(thighVent);
  const tri = M(new PlaneGeometry(0.14, 0.14), 'triangle');
  tri.position.set(0, -0.32, 0.225);
  thigh.add(tri);

  const knee = new Group();
  knee.position.set(0, -0.82, 0.04);
  const kneeGeo = new CylinderGeometry(0.18, 0.18, 0.42, seg(24));
  kneeGeo.rotateZ(Math.PI / 2);
  knee.add(M(kneeGeo, 'gunmetal'));
  const kneeCap = M(new CylinderGeometry(0.11, 0.11, 0.45, seg(20)), 'chrome');
  kneeCap.rotation.z = Math.PI / 2;
  knee.add(kneeCap);
  const kneeGuard = M(chamferedBox(0.28, 0.34, 0.24, 0.025), 'armor');
  kneeGuard.position.set(0, 0.02, 0.16);
  knee.add(kneeGuard);

  const shin = new Group();
  shin.rotation.z = side * 0.04;
  const upperShin = M(chamferedBox(0.28, 0.42, 0.3, 0.022), 'armor');
  upperShin.position.set(0, -0.28, 0.04);
  shin.add(upperShin);
  const shinVent = ventPod(0.18, 0.11, 0.05, 1, 3, false);
  shinVent.position.set(0, -0.22, 0.185);
  shin.add(shinVent);
  const lowerShin = M(chamferedBox(0.24, 0.38, 0.26, 0.02), 'armor');
  lowerShin.position.set(0, -0.68, 0.02);
  shin.add(lowerShin);
  const rear = M(box(0.22, 0.84, 0.18), 'gunmetal');
  rear.position.set(0, -0.46, -0.08);
  shin.add(rear);
  for (const px of [-0.13, 0.13]) {
    const rod = M(new CylinderGeometry(0.024, 0.024, 0.78, 8), 'chrome');
    rod.position.set(px, -0.46, -0.02);
    shin.add(rod);
  }

  const foot = new Group();
  foot.position.set(0, -0.96, 0.04);
  foot.rotation.z = side * -0.13;
  foot.rotation.y = side * 0.14;
  const ankle = M(chamferedBox(0.28, 0.16, 0.32, 0.02), 'gunmetal');
  ankle.position.y = 0.06;
  foot.add(ankle);
  for (const tx of [-0.095, 0.095]) {
    const toe = M(chamferedBox(0.13, 0.09, 0.34, 0.015), 'armor');
    toe.position.set(tx, -0.02, 0.16);
    toe.rotation.x = 0.12;
    foot.add(toe);
    const toeTip = M(chamferedBox(0.12, 0.075, 0.14, 0.012), 'gunmetal');
    toeTip.position.set(tx, -0.045, 0.34);
    foot.add(toeTip);
  }
  for (const sx of [-0.21, 0.21]) {
    const stab = M(chamferedBox(0.11, 0.075, 0.22, 0.012), 'armor');
    stab.position.set(sx, -0.04, 0);
    foot.add(stab);
    const pad = M(box(0.1, 0.04, 0.24), 'dark');
    pad.position.set(sx, -0.065, 0);
    foot.add(pad);
  }
  const heel = M(chamferedBox(0.24, 0.08, 0.22, 0.014), 'gunmetal');
  heel.position.set(0, -0.04, -0.18);
  foot.add(heel);

  shin.add(foot);
  knee.add(shin);
  thigh.add(knee);
  legRoot.add(thigh);
  return legRoot;
}

function pelvisAndLegs(): Group {
  const pelvis = new Group();
  pelvis.position.set(0, 2.04, 0);
  const waist = M(new CylinderGeometry(0.42, 0.38, 0.22, seg(24)), 'gunmetal');
  waist.position.y = 0.14;
  pelvis.add(waist);
  for (const side of [-1, 1]) {
    const c1 = new CatmullRomCurve3([
      new Vector3(side * 0.44, 0.26, 0.06),
      new Vector3(side * 0.62, 0.12, 0.12),
      new Vector3(side * 0.48, -0.06, 0.08),
    ]);
    pelvis.add(M(new TubeGeometry(c1, 8, 0.022, 5, false), 'hose'));
    const c2 = new CatmullRomCurve3([
      new Vector3(side * 0.4, -0.22, 0.04),
      new Vector3(side * 0.56, -0.34, 0.1),
      new Vector3(side * 0.34, -0.44, 0.06),
    ]);
    pelvis.add(M(new TubeGeometry(c2, 8, 0.02, 5, false), 'hose'));
  }
  const box1 = M(chamferedBox(0.56, 0.68, 0.58, 0.035), 'armor');
  box1.position.set(0, -0.24, 0.04);
  pelvis.add(box1);
  const shield = M(new PlaneGeometry(0.18, 0.18), 'shield');
  shield.position.set(0, -0.14, 0.335);
  pelvis.add(shield);
  const vent = ventPod(0.24, 0.24, 0.08, 4, 1, false);
  vent.position.set(0, -0.38, 0.32);
  pelvis.add(vent);
  pelvis.add(leg(true));
  pelvis.add(leg(false));
  return pelvis;
}

/** Whole mech in reference space (faces +Z, feet at y = 0). */
function buildMech(): Group {
  const root = new Group();
  const lower = pelvisAndLegs();
  root.add(lower);
  const torso = upperTorso();
  torso.position.set(0, 0.22, 0);
  lower.add(torso);
  torso.add(arm(false).armRoot);
  torso.add(arm(true).armRoot);
  return root;
}

// ---- textures --------------------------------------------------------------------------------

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic pseudo random so the generated textures are identical on every load. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function armorTextures(): { map: CanvasTexture; roughnessMap: CanvasTexture; bumpMap: CanvasTexture } | null {
  const size = 512;
  const k = size / 1024;
  const a = canvas(size, size);
  const r = canvas(size, size);
  const b = canvas(size, size);
  const aCtx = a?.getContext('2d');
  const rCtx = r?.getContext('2d');
  const bCtx = b?.getContext('2d');
  if (!a || !r || !b || !aCtx || !rCtx || !bCtx) return null;
  const rand = rng(20);
  aCtx.fillStyle = '#e46b29';
  aCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#757575';
  rCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const gr = (35 + rand() * 110) * k;
    const grad = aCtx.createRadialGradient(gx, gy, 3, gx, gy, gr);
    grad.addColorStop(0, 'rgba(60, 28, 12, 0.08)');
    grad.addColorStop(1, 'rgba(60, 28, 12, 0)');
    aCtx.fillStyle = grad;
    aCtx.fillRect(0, 0, size, size);
  }
  bCtx.strokeStyle = '#262626';
  bCtx.lineWidth = 3 * k;
  aCtx.strokeStyle = 'rgba(42, 24, 14, 0.55)';
  aCtx.lineWidth = 2.2 * k;
  for (const p0 of [190, 512, 830]) {
    const p = p0 * k;
    for (const ctx of [aCtx, bCtx]) {
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
    }
  }
  for (let x = 40 * k; x < size; x += 64 * k) {
    for (const y0 of [172, 208, 494, 530, 812, 848]) {
      aCtx.fillStyle = 'rgba(45, 30, 20, 0.5)';
      aCtx.beginPath();
      aCtx.arc(x, y0 * k, 3.2 * k, 0, Math.PI * 2);
      aCtx.fill();
      bCtx.fillStyle = '#c8c8c8';
      bCtx.beginPath();
      bCtx.arc(x, y0 * k, 3.2 * k, 0, Math.PI * 2);
      bCtx.fill();
    }
  }
  for (let i = 0; i < 220; i++) {
    const sx = rand() * size;
    const sy = rand() * size;
    const sw = (2 + rand() * 16) * k * 1.6;
    const sh = (1 + rand() * 3.5) * k * 1.6;
    const ang = (rand() - 0.5) * 1.4;
    const colors = [rand() > 0.4 ? '#4a4e54' : '#9ca3af', '#242424', '#4a4a4a'];
    [aCtx, rCtx, bCtx].forEach((ctx, idx) => {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(ang);
      ctx.fillStyle = colors[idx] ?? '#000';
      ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
      ctx.restore();
    });
  }
  const map = new CanvasTexture(a);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  const roughnessMap = new CanvasTexture(r);
  roughnessMap.wrapS = roughnessMap.wrapT = RepeatWrapping;
  const bumpMap = new CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = RepeatWrapping;
  return { map, roughnessMap, bumpMap };
}

/** One 512 x 256 atlas: left half the white shield, right half the white down-triangle. */
function decalAtlas(): CanvasTexture | null {
  const c = canvas(512, 256);
  const ctx = c?.getContext('2d');
  if (!c || !ctx) return null;
  ctx.clearRect(0, 0, 512, 256);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.beginPath();
  ctx.moveTo(64, 52);
  ctx.lineTo(192, 52);
  ctx.lineTo(184, 152);
  ctx.lineTo(128, 212);
  ctx.lineTo(72, 152);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e46b29';
  ctx.fillRect(84, 72, 38, 26);
  ctx.fillRect(134, 72, 38, 26);
  ctx.fillRect(88, 112, 80, 12);
  ctx.beginPath();
  ctx.moveTo(96, 136);
  ctx.lineTo(160, 136);
  ctx.lineTo(128, 182);
  ctx.closePath();
  ctx.fill();
  // triangle (shifted by 256)
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(256 + 52, 68);
  ctx.lineTo(256 + 204, 68);
  ctx.lineTo(256 + 128, 198);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(256 + 86, 88);
  ctx.lineTo(256 + 170, 88);
  ctx.lineTo(256 + 128, 160);
  ctx.closePath();
  ctx.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// ---- flatten + merge --------------------------------------------------------------------------

const MERGE_GROUP: Record<Key, 'armor' | 'gunmetal' | 'dark' | 'chrome' | 'decal' | 'glow'> = {
  armor: 'armor',
  gunmetal: 'gunmetal',
  dark: 'dark',
  hose: 'dark',
  glass: 'dark',
  chrome: 'chrome',
  shield: 'decal',
  triangle: 'decal',
  glow: 'glow',
};

type Group6 = 'armor' | 'gunmetal' | 'dark' | 'chrome' | 'decal' | 'glow';

function prepared(geo: BufferGeometry, key: Key, matrixWorld: Object3D['matrixWorld']): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(matrixWorld);
  // keep only position / normal / uv / color so every part merges
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  const count = g.getAttribute('position').count;
  const color = new Color(key === 'dark' || key === 'hose' || key === 'glass' ? DARK_COLORS[key] : 0xffffff);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  if (key === 'shield' || key === 'triangle') {
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i) * 0.5 + (key === 'triangle' ? 0.5 : 0);
      uv.setX(i, u);
    }
  }
  return g;
}

export interface ArmyAssets {
  near: ReadonlyArray<{ id: Group6; geometry: BufferGeometry; material: Material }>;
  far: { geometry: BufferGeometry; material: Material };
  /** Missile-cell glow materials, dim -> bright (swapped on the glow mesh, never cloned per robot). */
  glow: ReadonlyArray<Material>;
}

const cache = new WeakMap<SharedAssets, ArmyAssets>();

/** Far silhouette: a handful of boxes with vertex colours (one draw call). */
function buildFarGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const orange = new Color(0xe46b29);
  const steel = new Color(0x3b4048);
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, c: Color): void => {
    const g = new BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    g.deleteAttribute('uv');
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new BufferAttribute(arr, 3));
    parts.push(g);
  };
  const c = ARMY_LOCAL.centerHeight;
  for (const s of [-1, 1]) {
    add(0.4, 1.9, 0.45, s * 0.5, 0.95 - c, 0, orange); // legs
    add(0.34, 1.0, 0.34, s * 0.95, 2.95 - c, 0, orange); // arms
    add(0.2, 1.4, 0.26, s * 0.66, 3.6 - c, 0.44, steel); // back cannons (rear = +z)
  }
  add(0.9, 0.7, 0.7, 0, 1.8 - c, 0, orange); // pelvis
  add(1.3, 1.2, 1.0, 0, 2.85 - c, 0, orange); // torso
  add(0.55, 0.5, 0.55, 0, 2.85 - c, -0.4, orange); // head (forward = -z)
  add(0.95, 0.9, 0.4, 0, 2.85 - c, 0.55, steel); // backpack
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) throw new Error('army far model merge failed');
  return merged;
}

/** Builds (once per SharedAssets) every merged geometry and material of the mech. */
export function getArmyAssets(shared: SharedAssets): ArmyAssets {
  const hit = cache.get(shared);
  if (hit) return hit;

  const scene = buildMech();
  const holder = new Group();
  holder.rotation.y = Math.PI; // reference faces +Z, the game faces -Z
  holder.position.y = -ARMY_LOCAL.centerHeight;
  holder.add(scene);
  holder.updateMatrixWorld(true);

  const buckets = new Map<Group6, BufferGeometry[]>();
  holder.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const key = keyOf.get(mesh.material as Material);
    if (!key) return;
    const id = MERGE_GROUP[key];
    const list = buckets.get(id) ?? [];
    list.push(prepared(mesh.geometry, key, mesh.matrixWorld));
    buckets.set(id, list);
    mesh.geometry.dispose();
  });

  const armor = armorTextures();
  const decal = decalAtlas();
  const materials: Record<Group6, () => Material> = {
    armor: () =>
      new MeshStandardMaterial({
        color: armor ? 0xffffff : 0xe46b29,
        map: armor?.map ?? null,
        roughnessMap: armor?.roughnessMap ?? null,
        bumpMap: armor?.bumpMap ?? null,
        bumpScale: 0.02,
        roughness: 0.5,
        metalness: 0.4,
      }),
    gunmetal: () => new MeshStandardMaterial({ color: 0x4a5058, roughness: 0.34, metalness: 0.85 }),
    dark: () => new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0.7 }),
    chrome: () => new MeshStandardMaterial({ color: 0xd8dfe6, roughness: 0.14, metalness: 1 }),
    decal: () =>
      new MeshBasicMaterial({
        map: decal,
        color: decal ? 0xffffff : 0xf8fafc,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    glow: () => new MeshStandardMaterial({ color: 0x401000, emissive: 0xff7a1a, emissiveIntensity: 0.05 }),
  };

  const order: Group6[] = ['armor', 'gunmetal', 'dark', 'chrome', 'decal', 'glow'];
  const near = order.map((id) => {
    const parts = buckets.get(id) ?? [];
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) throw new Error(`army model: nothing to merge for ${id}`);
    return {
      id,
      geometry: shared.get(`army:${id}-geo`, () => merged),
      material: shared.get(`army:${id}-mat`, materials[id]),
    };
  });

  const glow = ARMY_LOCAL.glowLevels.map((level, i) =>
    shared.get(
      `army:glow-mat-${i}`,
      () => new MeshStandardMaterial({ color: 0x401000, emissive: i >= 3 ? 0xffd24a : 0xff7a1a, emissiveIntensity: level }),
    ),
  );

  const far = {
    geometry: shared.get('army:far-geo', buildFarGeometry),
    material: shared.get('army:far-mat', () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 })),
  };

  const assets: ArmyAssets = { near, far, glow };
  cache.set(shared, assets);
  return assets;
}
