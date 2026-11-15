import { BufferGeometry, Matrix4, Vector3 } from 'three';
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
  steel: 0xa3a9b2,
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
  armor.add(box(0.34, 0.5, 0.36, 0.03), C.black, [x + side * 0.04, 1.3, -0.05], [0.06, 0, 0]);
  armor.add(box(0.2, 0.2, 0.1, 0.02), C.grey, [x + side * 0.03, 1.0, -0.24]);
  armor.add(sphere(0.15, 10, 8), C.steelDark, [x + side * 0.03, 0.96, -0.04]);
  armor.add(rod([x + side * 0.03, 0.96, -0.04], [x + side * 0.04, 0.3, 0.02], 0.11, 0.1, 8), C.gunmetal);
  armor.add(box(0.36, 0.7, 0.42, 0.03), C.black, [x + side * 0.05, 0.6, 0], [-0.04, 0, 0]);
  armor.add(box(0.4, 0.16, 0.46, 0.02), C.gunmetal, [x + side * 0.05, 0.92, 0]);
  armor.add(box(0.26, 0.5, 0.08, 0.02), C.grey, [x + side * 0.05, 0.6, -0.23]);
  armor.add(box(0.4, 0.2, 0.44, 0.03), C.gunmetal, [x + side * 0.05, 0.3, 0.02]);
  armor.add(box(0.38, 0.2, 0.66, 0.04), C.black, [x + side * 0.05, 0.1, -0.1]);
  armor.add(box(0.3, 0.12, 0.2, 0.02), C.grey, [x + side * 0.05, 0.08, -0.46]);
  armor.add(box(0.26, 0.24, 0.16, 0.03), C.gunmetal, [x + side * 0.05, 0.14, 0.26]);
}

function blade(p: Parts, glow: Parts, dir: 1 | -1): void {
  const x0 = dir * 1.06;
  // gold cross guard: bar, bevelled ends, collar
  p.add(box(0.1, 0.72, 0.12, 0.03), C.gold, [x0, 0, 0]);
  p.add(box(0.22, 0.16, 0.14, 0.03), C.gold, [x0 + dir * 0.02, 0, 0]);
  for (const s of [-1, 1]) p.add(box(0.2, 0.14, 0.1, 0.03), C.goldDark, [x0 - dir * 0.05, s * 0.36, 0], [0, 0, dir * s * -0.5]);
  p.add(cylX(0.06, 0.2, 10), C.wood, [x0 - dir * 0.16, 0, 0]);
  // cleaver: spine, body, bevelled edge, clipped tip
  const len = 1.75;
  const cx = x0 + dir * (0.1 + len / 2);
  p.add(box(len, 0.6, 0.05, 0.012), C.steel, [cx, 0.02, 0]);
  p.add(box(len, 0.1, 0.075, 0.02), C.steelDark, [cx, 0.3, 0]);
  p.add(box(len * 0.96, 0.1, 0.02), C.grey, [cx, -0.3, 0], [0.5, 0, 0]);
  p.add(box(0.5, 0.5, 0.05, 0.012), C.steel, [x0 + dir * (0.1 + len + 0.12), -0.07, 0], [0, 0, dir * 0.55]);
  // dark inlays and rune strip
  p.add(box(0.5, 0.12, 0.06), C.steelDark, [x0 + dir * 0.5, 0.14, 0]);
  p.add(box(0.26, 0.08, 0.06), C.steelDark, [x0 + dir * 1.0, 0.14, 0]);
  for (let i = 0; i < 6; i++) p.add(box(0.1, 0.05, 0.058), C.steelDark, [x0 + dir * (0.5 + i * 0.2), -0.08, 0], [0, 0, i % 2 ? 0.5 : -0.5]);
  glow.add(box(0.36, 0.02, 0.064), C.glow, [x0 + dir * 0.5, 0.14, 0]);
  glow.add(box(len * 0.9, 0.012, 0.03), C.glow, [cx, -0.335, 0]);
}

/** Builds every samurai geometry once. */
export function buildSamuraiModel(): SamuraiModel {
  const down = new Matrix4().makeTranslation(0, -SAMURAI.centerHeight, 0);

  // ---- body -----------------------------------------------------------------------------
  const b = new Parts();
  const g = new Parts();
  // pelvis and armour skirt
  b.add(box(0.66, 0.3, 0.44, 0.04), C.gunmetal, [0, 1.68, 0]);
  b.add(box(0.5, 0.56, 0.07, 0.02), C.black, [0, 1.36, -0.27], [0.14, 0, 0]);
  b.add(box(0.5, 0.5, 0.07, 0.02), C.black, [0, 1.4, 0.26], [-0.14, 0, 0]);
  for (const s of [-1, 1]) {
    b.add(box(0.07, 0.6, 0.44, 0.02), C.black, [s * 0.4, 1.36, 0], [0, 0, s * 0.16]);
    b.add(box(0.075, 0.1, 0.46, 0.02), C.gunmetal, [s * 0.44, 1.12, 0], [0, 0, s * 0.16]);
  }
  // waist, chest, collar
  b.add(box(0.48, 0.32, 0.38, 0.04), C.steelDark, [0, 1.96, 0]);
  b.add(box(1.0, 0.52, 0.6, 0.05), C.black, [0, 2.34, 0]);
  b.add(box(0.7, 0.3, 0.1, 0.03), C.gunmetal, [0, 2.38, -0.3], [-0.12, 0, 0]);
  for (let i = 0; i < 3; i++) b.add(box(0.46, 0.04, 0.05), C.grey, [0, 2.28 + i * 0.085, -0.345]);
  b.add(box(0.56, 0.14, 0.5, 0.03), C.gunmetal, [0, 2.63, 0.02]);
  b.add(box(0.6, 0.6, 0.26, 0.04), C.gunmetal, [0, 2.3, 0.38]);
  for (const s of [-1, 1]) b.add(cylX(0.07, 0.12, 8), C.steelDark, [s * 0.2, 2.4, 0.52], [0, Math.PI / 2, 0]);
  // head: helmet, face mask, gold crest
  b.add(box(0.32, 0.3, 0.36, 0.05), C.black, [0, 2.84, -0.02]);
  b.add(box(0.36, 0.1, 0.4, 0.03), C.gunmetal, [0, 2.96, 0]);
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
    b.add(box(0.54, 0.42, 0.6, 0.04), C.black, [s * 0.78, 2.5, 0], [0, 0, s * -0.18]);
    b.add(box(0.5, 0.1, 0.64, 0.03), C.gunmetal, [s * 0.8, 2.72, 0], [0, 0, s * -0.18]);
    b.add(box(0.3, 0.3, 0.5, 0.03), C.gunmetal, [s * 1.0, 2.3, 0], [0, 0, s * -0.4]);
    b.add(rod([s * 0.95, 2.2, 0.1], [s * 1.2, 1.9, 0.2], 0.07, 0.005, 5), C.black);
    g.add(box(0.26, 0.04, 0.02), C.glow, [s * 0.8, 2.6, -0.305], [0, 0, s * -0.18]);
    g.add(box(0.04, 0.2, 0.02), C.glow, [s * 1.0, 2.44, -0.3], [0, 0, s * -0.4]);
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
    b.add(box(0.2, 0.2, 0.22, 0.04), C.gunmetal, hand);
    b.add(box(0.22, 0.1, 0.24, 0.02), C.black, [hand[0], hand[1] + 0.06, hand[2]]);
    g.add(box(0.03, 0.1, 0.02), C.glow, [hand[0] + s * 0.06, hand[1] + 0.2, hand[2] + 0.1]);
  }
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
  w.add(cylX(0.04, 2.3, 10), C.wood, [0, 0, 0]);
  for (const x of [-0.5, 0, 0.5]) w.add(cylX(0.048, 0.1, 10), C.black, [x, 0, 0]);
  blade(w, wg, 1);
  blade(w, wg, -1);
  const weapon = w.merge();
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
    weaponGlow,
    grip: new Vector3(0, 1.92 - SAMURAI.centerHeight, -0.58),
    restAngle: 0.68,
    cloth,
    clothPivot: new Vector3(0, 1.82 - SAMURAI.centerHeight, 0),
  };
}
