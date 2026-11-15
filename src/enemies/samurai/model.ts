import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { box, cylX, Parts, rod, sphere } from '../duck/modelKit';
import { SAMURAI } from './tunables';

/**
 * Cyber samurai after the owner's concept image: black and gunmetal block armour, gold V crest, red
 * eyes and light strips, a torn red sash, and a polearm with a huge cleaver blade and a gold cross
 * guard at each end. Built from the shared `Parts` kit, vertex-coloured, one geometry per moving part.
 * Forward is -Z, the origin is the body centre (feet at -centerHeight).
 */
export const SAMURAI_COLORS = {
  black: 0x17181c,
  gunmetal: 0x3a3d45,
  grey: 0x6e727b,
  gold: 0xc9a14a,
  goldDark: 0x8a6a2a,
  red: 0x8c1717,
  redDark: 0x5c0f10,
  steel: 0xb4bcc6,
  /** Ground cutting bevel: almost white so it catches the sky. */
  edge: 0xf2f6fa,
  steelDark: 0x4a4f58,
  wood: 0x2c1c13,
  glow: 0xffffff,
} as const;

export interface SamuraiModel {
  body: BufferGeometry;
  /** Emissive parts of the body (eyes, strips). */
  bodyGlow: BufferGeometry;
  /** Legs authored around the hip pivot. */
  legL: BufferGeometry;
  legR: BufferGeometry;
  hip: { x: number; y: number };
  /** Polearm authored along X around its grip centre. */
  weapon: BufferGeometry;
  /** Both blades: mirror-polished, own material. */
  blade: BufferGeometry;
  weaponGlow: BufferGeometry;
  /** Grip centre in the body frame and the rest angle about Z (right end up). */
  grip: Vector3;
  restAngle: number;
  /** Sash and its tails, authored around the waist knot. */
  cloth: BufferGeometry;
  clothPivot: Vector3;
}

const C = SAMURAI_COLORS;
const HIP_X = 0.25;
const HIP_Y = 1.62;

function leg(side: 1 | -1, armor: Parts): void {
  const x = side * HIP_X;
  armor.add(sphere(0.17, 10, 8), C.gunmetal, [x, HIP_Y, 0]);
  armor.add(rod([x, HIP_Y, 0], [x + side * 0.03, 0.98, -0.06], 0.14, 0.12, 8), C.gunmetal);
  armor.add(box(0.36, 0.52, 0.38, 0.12), C.black, [x + side * 0.04, 1.3, -0.05], [0.06, 0, 0]);
  armor.add(sphere(0.14, 10, 8), C.grey, [x + side * 0.03, 0.98, -0.2], [0, 0, 0], [1, 1.15, 0.6]);
  armor.add(rod([x + side * 0.03, 1.02, -0.26], [x + side * 0.03, 1.2, -0.42], 0.05, 0.004, 5), C.gold);
  armor.add(sphere(0.15, 10, 8), C.steelDark, [x + side * 0.03, 0.96, -0.04]);
  armor.add(rod([x + side * 0.03, 0.96, -0.04], [x + side * 0.04, 0.3, 0.02], 0.11, 0.1, 8), C.gunmetal);
  armor.add(box(0.36, 0.7, 0.42, 0.13), C.black, [x + side * 0.05, 0.6, 0], [-0.04, 0, 0]);
  armor.add(box(0.4, 0.16, 0.46, 0.02), C.gunmetal, [x + side * 0.05, 0.92, 0]);
  armor.add(box(0.26, 0.5, 0.08, 0.02), C.grey, [x + side * 0.05, 0.6, -0.23]);
  armor.add(box(0.4, 0.2, 0.44, 0.03), C.gunmetal, [x + side * 0.05, 0.3, 0.02]);
  armor.add(box(0.38, 0.2, 0.66, 0.08), C.black, [x + side * 0.05, 0.1, -0.1]);
  armor.add(box(0.3, 0.12, 0.2, 0.02), C.grey, [x + side * 0.05, 0.08, -0.46]);
  armor.add(box(0.26, 0.24, 0.16, 0.03), C.gunmetal, [x + side * 0.05, 0.14, 0.26]);
}

/** Blade stations along its length: x, spine height, edge height, thickness. The last one is the point. */
const STATIONS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0, 0.3, -0.26, 0.085],
  [0.18, 0.34, -0.33, 0.08],
  [0.6, 0.35, -0.385, 0.072],
  [1.05, 0.35, -0.4, 0.062],
  [1.45, 0.34, -0.37, 0.05],
  [1.78, 0.25, -0.3, 0.036],
  [2.0, 0.02, -0.19, 0.018],
  [2.12, -0.13, -0.13, 0.0],
];
/** Width of the ground bevel above the cutting edge (m). */
const BEVEL = 0.17;

/**
 * Glaive blade as a real knife section instead of a slab: flat spine, two flats, and two ground
 * bevels that meet in a zero-thickness cutting edge; the section shrinks to a point at the tip.
 * Returns the flats (with the spine) and the bevels separately so they can be coloured apart.
 * Faces are not shared between quads, so every facet stays crisp.
 */
function bladeGeometry(dir: 1 | -1, x0: number): { flats: BufferGeometry; bevels: BufferGeometry } {
  const flats: number[] = [];
  const bevels: number[] = [];
  type P = [number, number, number];
  const ring = (st: readonly [number, number, number, number]): P[] => {
    const [x, top, edge, t] = st;
    const mid = Math.min(top, edge + BEVEL);
    const px = x0 + dir * x;
    // spine +z, spine -z, shoulder -z, cutting edge, shoulder +z
    return [
      [px, top, t / 2],
      [px, top, -t / 2],
      [px, mid, -t / 2],
      [px, edge, 0],
      [px, mid, t / 2],
    ];
  };
  const quad = (out: number[], a: P, b: P, c: P, d: P): void => {
    // winding follows the blade direction so the faces point outwards on both blades
    if (dir === 1) out.push(...a, ...b, ...c, ...a, ...c, ...d);
    else out.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  for (let k = 0; k < STATIONS.length - 1; k++) {
    const a = ring(STATIONS[k] as (typeof STATIONS)[number]);
    const b = ring(STATIONS[k + 1] as (typeof STATIONS)[number]);
    for (let j = 0; j < 5; j++) {
      const j1 = (j + 1) % 5;
      const target = j === 2 || j === 3 ? bevels : flats;
      quad(target, a[j] as P, b[j] as P, b[j1] as P, a[j1] as P);
    }
  }
  // heel cap at the guard
  const h = ring(STATIONS[0] as (typeof STATIONS)[number]);
  quad(flats, h[0] as P, h[4] as P, h[2] as P, h[1] as P);
  quad(flats, h[4] as P, h[3] as P, h[2] as P, h[2] as P);
  const make = (arr: number[]): BufferGeometry => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(arr), 3));
    g.computeVertexNormals();
    return g;
  };
  return { flats: make(flats), bevels: make(bevels) };
}

function blade(p: Parts, steel: Parts, glow: Parts, dir: 1 | -1): void {
  const x0 = dir * 1.06;
  // gold cross guard: bar with swept ends, rounded collar and a pommel ring on the shaft
  p.add(box(0.12, 0.6, 0.14, 0.05), C.gold, [x0, 0, 0]);
  p.add(sphere(0.12, 10, 8), C.gold, [x0, 0, 0], [0, 0, 0], [1, 1.1, 0.8]);
  for (const s of [-1, 1]) {
    p.add(rod([x0, s * 0.26, 0], [x0 + dir * 0.2, s * 0.5, 0], 0.07, 0.035, 8), C.gold);
    p.add(sphere(0.045, 8, 6), C.goldDark, [x0 + dir * 0.21, s * 0.51, 0]);
  }
  p.add(cylX(0.07, 0.16, 12), C.goldDark, [x0 - dir * 0.13, 0, 0]);
  p.add(cylX(0.055, 0.1, 12), C.black, [x0 - dir * 0.26, 0, 0]);
  const bx = x0 + dir * 0.1;
  const g = bladeGeometry(dir, bx);
  steel.add(g.flats, C.steel);
  steel.add(g.bevels, C.edge);
  // dark spine cladding near the guard, fuller (blood groove) glowing along the flat
  p.add(box(0.62, 0.11, 0.1, 0.03), C.steelDark, [bx + dir * 0.34, 0.3, 0]);
  p.add(box(0.2, 0.22, 0.1, 0.03), C.black, [bx + dir * 0.08, 0.14, 0]);
  for (const z of [-1, 1]) glow.add(box(1.25, 0.02, 0.01), C.glow, [bx + dir * 0.82, 0.12, z * 0.034], [0, 0, dir * -0.012]);
}

/** Builds every samurai geometry once. */
export function buildSamuraiModel(): SamuraiModel {
  const down = new Matrix4().makeTranslation(0, -SAMURAI.centerHeight, 0);

  // ---- body -----------------------------------------------------------------------------
  const b = new Parts();
  const g = new Parts();
  // pelvis and armour skirt
  b.add(box(0.66, 0.3, 0.44, 0.1), C.gunmetal, [0, 1.68, 0]);
  b.add(box(0.5, 0.56, 0.07, 0.02), C.black, [0, 1.36, -0.27], [0.14, 0, 0]);
  b.add(box(0.5, 0.5, 0.07, 0.02), C.black, [0, 1.4, 0.26], [-0.14, 0, 0]);
  for (const s of [-1, 1]) {
    b.add(box(0.07, 0.6, 0.44, 0.02), C.black, [s * 0.4, 1.36, 0], [0, 0, s * 0.16]);
    b.add(box(0.075, 0.1, 0.46, 0.02), C.gunmetal, [s * 0.44, 1.12, 0], [0, 0, s * 0.16]);
  }
  // waist, chest, collar
  b.add(box(0.48, 0.34, 0.38, 0.12), C.steelDark, [0, 1.96, 0]);
  for (let i = 0; i < 3; i++) b.add(box(0.5, 0.05, 0.4, 0.02), C.black, [0, 1.86 + i * 0.1, 0]);
  b.add(box(1.0, 0.54, 0.62, 0.16), C.black, [0, 2.34, 0]);
  // chest core behind a grille
  g.add(sphere(0.085, 10, 8), C.glow, [0, 2.2, -0.31], [0, 0, 0], [1, 1, 0.4]);
  b.add(box(0.26, 0.05, 0.05, 0.02), C.gold, [0, 2.12, -0.33]);
  b.add(box(0.7, 0.3, 0.1, 0.03), C.gunmetal, [0, 2.38, -0.3], [-0.12, 0, 0]);
  for (let i = 0; i < 3; i++) b.add(box(0.46, 0.04, 0.05), C.grey, [0, 2.28 + i * 0.085, -0.345]);
  b.add(box(0.56, 0.14, 0.5, 0.03), C.gunmetal, [0, 2.63, 0.02]);
  b.add(box(0.6, 0.6, 0.26, 0.1), C.gunmetal, [0, 2.3, 0.38]);
  for (const s of [-1, 1]) b.add(cylX(0.07, 0.12, 8), C.steelDark, [s * 0.2, 2.4, 0.52], [0, Math.PI / 2, 0]);
  // head: helmet, face mask, gold crest
  b.add(sphere(0.21, 14, 10), C.black, [0, 2.88, 0], [0, 0, 0], [1, 0.95, 1.12]);
  b.add(box(0.3, 0.22, 0.34, 0.08), C.black, [0, 2.78, -0.02]);
  b.add(box(0.46, 0.05, 0.5, 0.02), C.gunmetal, [0, 2.9, 0.03], [0.12, 0, 0]);
  // layered neck guard flaring out behind the helmet
  for (let i = 0; i < 3; i++) b.add(box(0.5 + i * 0.1, 0.07, 0.3, 0.03), i % 2 ? C.gunmetal : C.black, [0, 2.78 - i * 0.07, 0.16 + i * 0.05], [-0.5, 0, 0]);
  // fangs on the mask
  for (const fx of [-0.06, 0.06]) b.add(rod([fx, 2.72, -0.26], [fx * 1.2, 2.63, -0.27], 0.02, 0.003, 5), C.gold);
  b.add(box(0.22, 0.15, 0.1, 0.03), C.gunmetal, [0, 2.76, -0.2]);
  b.add(box(0.08, 0.1, 0.08, 0.02), C.grey, [0, 2.72, -0.25]);
  for (const s of [-1, 1]) {
    b.add(box(0.07, 0.24, 0.3, 0.02), C.gunmetal, [s * 0.2, 2.8, 0.02], [0, 0, s * -0.12]);
    b.add(rod([s * 0.03, 2.96, -0.2], [s * 0.5, 3.32, -0.1], 0.04, 0.006, 6), C.gold);
    b.add(rod([s * 0.02, 2.98, -0.2], [s * 0.22, 3.5, -0.12], 0.034, 0.005, 6), C.gold);
    g.add(box(0.085, 0.028, 0.02), C.glow, [s * 0.075, 2.845, -0.205], [0, 0, s * 0.32]);
  }
  b.add(box(0.1, 0.12, 0.06, 0.02), C.gold, [0, 2.98, -0.2]);
  // pauldrons with light strips and spikes
  for (const s of [-1, 1]) {
    b.add(sphere(0.3, 14, 10), C.black, [s * 0.76, 2.52, 0], [0, 0, s * -0.18], [1, 0.72, 1.05]);
    // three overlapping shoulder plates, each a little lower and wider
    for (let i = 0; i < 3; i++) {
      b.add(box(0.36, 0.2, 0.6 + i * 0.04, 0.07), i === 1 ? C.gunmetal : C.black, [s * (0.86 + i * 0.1), 2.44 - i * 0.16, 0], [0, 0, s * (-0.35 - i * 0.16)]);
      b.add(box(0.37, 0.03, 0.62 + i * 0.04, 0.012), C.gold, [s * (0.9 + i * 0.105), 2.35 - i * 0.165, 0], [0, 0, s * (-0.35 - i * 0.16)]);
    }
    b.add(box(0.5, 0.1, 0.62, 0.04), C.gunmetal, [s * 0.78, 2.72, 0], [0, 0, s * -0.18]);
    b.add(rod([s * 0.95, 2.2, 0.1], [s * 1.2, 1.9, 0.2], 0.07, 0.005, 5), C.black);
    g.add(box(0.26, 0.04, 0.02), C.glow, [s * 0.8, 2.6, -0.305], [0, 0, s * -0.18]);
    g.add(box(0.04, 0.16, 0.02), C.glow, [s * 0.98, 2.42, -0.315], [0, 0, s * -0.4]);
  }
  // arms: right hand high, left hand low on the shaft
  const hands: Array<[1 | -1, [number, number, number], [number, number, number]]> = [
    [1, [0.92, 2.02, -0.22], [0.5, 2.28, -0.55]],
    [-1, [-0.9, 1.92, -0.14], [-0.5, 1.56, -0.55]],
  ];
  for (const [s, elbow, hand] of hands) {
    b.add(rod([s * 0.78, 2.4, 0], elbow, 0.13, 0.11, 8), C.gunmetal);
    b.add(sphere(0.14, 10, 8), C.steelDark, elbow);
    b.add(rod(elbow, hand, 0.12, 0.1, 8), C.black);
    b.add(box(0.22, 0.22, 0.24, 0.08), C.gunmetal, hand);
    b.add(sphere(0.16, 10, 8), C.black, [(elbow[0] + hand[0]) / 2, (elbow[1] + hand[1]) / 2, (elbow[2] + hand[2]) / 2], [0, 0, 0], [1, 1.25, 1]);
    b.add(box(0.22, 0.1, 0.24, 0.02), C.black, [hand[0], hand[1] + 0.06, hand[2]]);
    g.add(box(0.03, 0.1, 0.02), C.glow, [hand[0] + s * 0.06, hand[1] + 0.2, hand[2] + 0.1]);
  }
  // sheathed katana on the left hip
  b.add(rod([-0.44, 1.7, -0.34], [-0.62, 1.42, 0.86], 0.045, 0.036, 8), C.redDark);
  b.add(rod([-0.44, 1.7, -0.34], [-0.4, 1.76, -0.62], 0.032, 0.03, 8), C.black);
  b.add(sphere(0.07, 10, 6), C.gold, [-0.44, 1.7, -0.34], [0.25, 0, 0], [1, 1, 0.3]);
  b.add(sphere(0.04, 8, 6), C.gold, [-0.4, 1.76, -0.63]);
  const body = b.merge(down);
  const bodyGlow = g.merge(down);

  // ---- legs (pivot at the hip) ------------------------------------------------------------
  const hipDown = new Matrix4().makeTranslation(0, -HIP_Y, 0);
  const ll = new Parts();
  const lr = new Parts();
  leg(-1, ll);
  leg(1, lr);
  const legL = ll.merge(hipDown);
  const legR = lr.merge(hipDown);

  // ---- polearm ----------------------------------------------------------------------------
  const w = new Parts();
  const wg = new Parts();
  const ws = new Parts();
  w.add(cylX(0.04, 2.3, 12), C.wood, [0, 0, 0]);
  for (const x of [-0.62, -0.5, 0, 0.5, 0.62]) w.add(cylX(0.05, 0.07, 12), x === 0 ? C.gold : C.black, [x, 0, 0]);
  blade(w, ws, wg, 1);
  blade(w, ws, wg, -1);
  const weapon = w.merge();
  const bladeGeo = ws.merge();
  const weaponGlow = wg.merge();

  // ---- sash -------------------------------------------------------------------------------
  const c = new Parts();
  c.add(box(0.56, 0.18, 0.5, 0.04), C.red, [0, 0, 0]);
  c.add(box(0.2, 0.16, 0.12, 0.04), C.redDark, [0.1, 0.0, -0.27]);
  c.add(box(0.26, 0.78, 0.03), C.red, [0.1, -0.46, -0.3], [0.08, 0, 0.02]);
  c.add(box(0.2, 0.2, 0.03), C.redDark, [0.07, -0.9, -0.31], [0.1, 0, 0.3]);
  c.add(box(0.26, 0.9, 0.03), C.red, [0.22, -0.4, 0.42], [-0.7, 0, -0.1]);
  c.add(box(0.2, 0.7, 0.03), C.redDark, [-0.02, -0.5, 0.46], [-0.9, 0.2, 0.15]);
  c.add(box(0.16, 0.5, 0.03), C.red, [0.34, -0.72, 0.74], [-1.1, 0, -0.3]);
  const cloth = c.merge();

  return {
    body,
    bodyGlow,
    legL,
    legR,
    hip: { x: HIP_X, y: HIP_Y - SAMURAI.centerHeight },
    weapon,
    blade: bladeGeo,
    weaponGlow,
    grip: new Vector3(0, 1.92 - SAMURAI.centerHeight, -0.58),
    restAngle: 0.68,
    cloth,
    clothPivot: new Vector3(0, 1.82 - SAMURAI.centerHeight, 0),
  };
}
