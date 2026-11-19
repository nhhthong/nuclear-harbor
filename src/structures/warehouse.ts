import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three';
import { WAREHOUSE } from '@/config/warehouse';
import { STRUCTURES } from './tunables';
import { applyWeatheredPaint } from '@/world/containerModel';
import { MeshBuilder } from '@/world/meshBuilder';
import {
  WALLS,
  WAREHOUSE_LOCAL,
  openingsOf,
  alongOf,
  railingRuns,
  roofHeightAt,
  roofPlanes,
  stairFlight,
  wallPieces,
  type WallDef,
} from './warehouseLayout';

/**
 * Procedural warehouse shell (spec 29), in the spirit of containerModel.ts: everything is merged into a
 * handful of geometries, one per material (cladding, liner, concrete, steel, safety yellow, glass, skylight,
 * signage), plus two instanced meshes for the hanging lamps. No real lights: the lamps and skylights are
 * emissive only, the dark interior comes from the roof shadow and the darker liner and floor materials.
 * `buildWarehouseGeometry` is pure (no DOM); `createWarehouseMeshes` adds the materials.
 */

type V3 = readonly [number, number, number];

const F = WAREHOUSE.footprint;
const T = WAREHOUSE.wallThickness;
const EAVE = WAREHOUSE.eaveHeight;
const RIDGE = WAREHOUSE.ridgeHeight;
const M = WAREHOUSE.mezzanine;
const OFFICE = WAREHOUSE.office;
const ST = WAREHOUSE.stairs;
const W = WAREHOUSE_LOCAL;
const RIB = 0.035;
const RIDGE_X = (F.minX + F.maxX) / 2;

export interface WarehouseGeometry {
  cladding: BufferGeometry;
  liner: BufferGeometry;
  concrete: BufferGeometry;
  floor: BufferGeometry;
  /** Saw-cut slab joints, a few millimetres above the floor. */
  joints: BufferGeometry;
  steel: BufferGeometry;
  yellow: BufferGeometry;
  glass: BufferGeometry;
  skylight: BufferGeometry;
  signs: BufferGeometry;
  lampShade: BufferGeometry;
  lampLens: BufferGeometry;
  /** Lamp positions (lens centre) and scale, for the two instanced meshes. */
  lamps: Array<{ x: number; y: number; z: number; scale: number }>;
}

/** Prism of `sides` sides along an axis between two points (round sections: drum, pipes). */
function prism(b: MeshBuilder, a: V3, c: V3, r: number, sides = 8): void {
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
  const f = [d[0]! / len, d[1]! / len, d[2]! / len];
  // any perpendicular pair
  const ref = Math.abs(f[1]!) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let s = [f[1]! * ref[2]! - f[2]! * ref[1]!, f[2]! * ref[0]! - f[0]! * ref[2]!, f[0]! * ref[1]! - f[1]! * ref[0]!];
  const sl = Math.hypot(s[0]!, s[1]!, s[2]!);
  s = s.map((v) => v / sl);
  const u = [f[1]! * s[2]! - f[2]! * s[1]!, f[2]! * s[0]! - f[0]! * s[2]!, f[0]! * s[1]! - f[1]! * s[0]!];
  const p = (o: V3, ang: number): V3 => [
    o[0] + (Math.cos(ang) * s[0]! + Math.sin(ang) * u[0]!) * r,
    o[1] + (Math.cos(ang) * s[1]! + Math.sin(ang) * u[1]!) * r,
    o[2] + (Math.cos(ang) * s[2]! + Math.sin(ang) * u[2]!) * r,
  ];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    b.quad(p(a, a0), p(a, a1), p(c, a1), p(c, a0));
    b.quad(a, p(a, a1), p(a, a0), p(a, a0));
    b.quad(c, p(c, a0), p(c, a1), p(c, a1));
  }
}

/** I-section member between two points: web plus two flanges (columns, rafters). */
function iBeam(b: MeshBuilder, a: V3, c: V3, depth: number, flange: number): void {
  const tw = 0.02;
  const tf = 0.025;
  b.beam(a, c, tw, depth);
  const d = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
  // offset of the flanges along the section's "up" (world Y unless vertical: then along X)
  const vertical = Math.abs(d[1]! / len) > 0.99;
  let up: number[];
  if (vertical) up = [1, 0, 0];
  else {
    const f = d.map((v) => v / len);
    const side = [-f[2]!, 0, f[0]!];
    const sl = Math.hypot(side[0]!, side[2]!) || 1;
    const sx = side[0]! / sl;
    const sz = side[2]! / sl;
    up = [0 * f[2]! - sz * f[1]!, sz * f[0]! - sx * f[2]!, sx * f[1]! - 0 * f[0]!];
  }
  for (const k of [-1, 1]) {
    const o = (depth / 2 - tf / 2) * k;
    const off = (p: V3): V3 => [p[0] + up[0]! * o, p[1] + up[1]! * o, p[2] + up[2]! * o];
    if (vertical) b.beam(off(a), off(c), flange, tf);
    else b.beam(off(a), off(c), flange, tf);
  }
}

function wallCladding(cl: MeshBuilder, liner: MeshBuilder, concrete: MeshBuilder, w: WallDef): void {
  const n: V3 = [w.nx, 0, w.nz];
  const u: V3 = [w.nz, 0, -w.nx];
  const v: V3 = [0, 1, 0];
  const sign = w.axis === 'x' ? w.nz : w.nx;
  const outerPos = w.fixed + sign * (T / 2 - RIB);
  const uPos = w.axis === 'x' ? u[0] : u[2];
  for (const p of wallPieces(w)) {
    const y0 = p.y0 < W.plinthHeight ? W.plinthHeight : p.y0;
    if (p.y0 < W.plinthHeight) {
      // concrete plinth, a little proud of the cladding on both faces
      const top = Math.min(W.plinthHeight, p.y1);
      const mid = (p.a + p.b) / 2;
      const half = (p.b - p.a) / 2;
      if (w.axis === 'x') concrete.box(mid, top / 2, w.fixed, half, top / 2, T / 2 + 0.04);
      else concrete.box(w.fixed, top / 2, mid, T / 2 + 0.04, top / 2, half);
    }
    if (p.y1 > y0 + 0.01) {
      const startAlong = uPos > 0 ? p.a : p.b;
      const origin: V3 = w.axis === 'x' ? [startAlong, y0, outerPos] : [outerPos, y0, startAlong];
      cl.corrugated(origin, u, v, n, p.b - p.a, p.y1 - y0, 0.3, RIB);
    }
    // liner: the wall body minus the ribs (inner face, jambs, sills, heads)
    const mid = (p.a + p.b) / 2;
    const half = (p.b - p.a) / 2;
    const cy = (p.y0 + p.y1) / 2;
    const hy = (p.y1 - p.y0) / 2;
    const c = w.fixed - sign * (RIB / 2);
    if (w.axis === 'x') liner.box(mid, cy, c, half, hy, (T - RIB) / 2);
    else liner.box(c, cy, mid, (T - RIB) / 2, hy, half);
  }
}

function gables(cl: MeshBuilder, liner: MeshBuilder): void {
  for (const w of WALLS.filter((x) => x.axis === 'x')) {
    for (const [z, mb] of [
      [w.fixed + w.nz * (T / 2), cl],
      [w.fixed - w.nz * (T / 2), liner],
    ] as const) {
      const a: V3 = [F.minX, EAVE, z];
      const b: V3 = [F.maxX, EAVE, z];
      const c: V3 = [RIDGE_X, RIDGE, z];
      mb.quad(a, b, c, c);
    }
  }
}

function roof(cl: MeshBuilder, sky: MeshBuilder, steel: MeshBuilder): void {
  const zLen = F.maxZ - F.minZ + 2 * W.overhang;
  for (const r of roofPlanes()) {
    const v: V3 = [(r.ridge.x - r.eave.x) / r.length, (r.ridge.y - r.eave.y) / r.length, 0];
    const west = r.side < 0;
    const u: V3 = west ? [0, 0, 1] : [0, 0, -1];
    const n: V3 = [-u[2] * v[1], u[2] * v[0], 0];
    const z0 = west ? F.minZ - W.overhang : F.maxZ + W.overhang;
    // bands up the slope: sheet, skylight strip, sheet
    const s0 = r.length * 0.38;
    const s1 = s0 + 1.4;
    const at = (s: number): V3 => [r.eave.x + v[0] * s, r.eave.y + v[1] * s, z0];
    cl.corrugated(at(0), u, v, n, zLen, s0, 0.3, 0.04);
    cl.corrugated(at(s1), u, v, n, zLen, r.length - s1, 0.3, 0.04);
    // skylight strip, broken at every frame line
    const zs = [F.minZ, ...W.frameZ.slice(1, -1), F.maxZ];
    for (let i = 0; i + 1 < zs.length; i++) {
      const za = (zs[i] as number) + 0.15;
      const zb = (zs[i + 1] as number) - 0.15;
      const p0 = at(s0);
      const p1 = at(s1);
      sky.quad([p0[0], p0[1] + 0.02, za], [p0[0], p0[1] + 0.02, zb], [p1[0], p1[1] + 0.02, zb], [p1[0], p1[1] + 0.02, za]);
    }
    // eave gutter and fascia
    steel.box(r.eave.x, r.eave.y - 0.08, (F.minZ + F.maxZ) / 2, 0.09, 0.09, zLen / 2);
  }
  // ridge cap
  steel.box(RIDGE_X, RIDGE + 0.06, (F.minZ + F.maxZ) / 2, 0.3, 0.05, zLen / 2);
}

function frame(steel: MeshBuilder): void {
  const c = W.column;
  const under = 0.35; // rafter centre below the roof line
  for (const z of W.frameZ) {
    const xw = F.minX + T + c / 2;
    const xe = F.maxX - T - c / 2;
    for (const x of [xw, xe]) iBeam(steel, [x, 0, z], [x, EAVE - 0.1, z], c, c * 0.8);
    const yAt = (x: number): number => roofHeightAt(x) - under;
    iBeam(steel, [xw, yAt(xw), z], [RIDGE_X, yAt(RIDGE_X), z], 0.45, 0.2);
    iBeam(steel, [RIDGE_X, yAt(RIDGE_X), z], [xe, yAt(xe), z], 0.45, 0.2);
    // haunches (knee braces) at the eaves
    steel.beam([xw, EAVE - 1.6, z], [xw + 1.6, yAt(xw + 1.6), z], 0.12, 0.12);
    steel.beam([xe, EAVE - 1.6, z], [xe - 1.6, yAt(xe - 1.6), z], 0.12, 0.12);
    // base plates
    for (const x of [xw, xe]) steel.box(x, 0.02, z, 0.25, 0.02, 0.25);
  }
  // purlins every ~1.6 m along each slope, under the roof sheet
  const halfSpan = (F.maxX - F.minX) / 2;
  for (let k = 0; k <= 8; k++) {
    const d = (k / 8) * (halfSpan - 0.4) + 0.2;
    for (const x of [F.minX + d, F.maxX - d]) {
      steel.box(x, roofHeightAt(x) - 0.1, (F.minZ + F.maxZ) / 2, 0.05, 0.08, (F.maxZ - F.minZ) / 2 - T);
    }
  }
  // eave beams along the side walls and cross bracing in the two end bays
  for (const x of [F.minX + T + c / 2, F.maxX - T - c / 2]) {
    steel.box(x, EAVE - 0.25, (F.minZ + F.maxZ) / 2, 0.1, 0.15, (F.maxZ - F.minZ) / 2 - T);
    for (const [za, zb] of [
      [W.frameZ[0] as number, W.frameZ[1] as number],
      [W.frameZ[W.frameZ.length - 2] as number, W.frameZ[W.frameZ.length - 1] as number],
    ] as Array<[number, number]>) {
      steel.beam([x, 1, za], [x, EAVE - 0.6, zb], 0.04, 0.04);
      steel.beam([x, 1, zb], [x, EAVE - 0.6, za], 0.04, 0.04);
    }
  }
}

function clerestory(glass: MeshBuilder, steel: MeshBuilder): void {
  const { y0, y1 } = W.clerestory;
  for (const w of WALLS.filter((x) => x.axis === 'z')) {
    const a = w.from + 1;
    const b = w.to - 1;
    glass.box(w.fixed, (y0 + y1) / 2, (a + b) / 2, T / 2 + 0.05, (y1 - y0) / 2, (b - a) / 2);
    for (let z = a; z <= b + 1e-6; z += (b - a) / 16) steel.box(w.fixed, (y0 + y1) / 2, z, T / 2 + 0.07, (y1 - y0) / 2 + 0.04, 0.04);
    for (const y of [y0, y1]) steel.box(w.fixed, y, (a + b) / 2, T / 2 + 0.07, 0.04, (b - a) / 2);
  }
}

function openingsDetail(steel: MeshBuilder, yellow: MeshBuilder): void {
  for (const w of WALLS) {
    for (const o of openingsOf(w)) {
      const c = alongOf(w, o);
      const lo = c - o.width / 2;
      const hi = c + o.width / 2;
      const y0 = o.y - o.height / 2;
      const y1 = o.y + o.height / 2;
      const d = T / 2 + 0.06;
      const put = (along: number, y: number, ha: number, hy: number, hn: number, shift = 0): void => {
        const n = w.fixed + (w.axis === 'x' ? w.nz : w.nx) * shift;
        if (w.axis === 'x') steel.box(along, y, n, ha, hy, hn);
        else steel.box(n, y, along, hn, hy, ha);
      };
      // frame: jambs and head (sill for windows, projecting)
      put(lo + 0.05, (y0 + y1) / 2, 0.05, (y1 - y0) / 2, d);
      put(hi - 0.05, (y0 + y1) / 2, 0.05, (y1 - y0) / 2, d);
      put(c, y1 + 0.05, o.width / 2 + 0.05, 0.05, d);
      if (o.kind === 'window') {
        put(c, y0 - 0.04, o.width / 2 + 0.1, 0.04, d + 0.08, 0.08);
        put(c, (y0 + y1) / 2, 0.025, (y1 - y0) / 2, 0.03); // mullion
      }
      if (o.kind === 'roller-door') {
        // drum housing inside above the opening, guide rails, outer hood
        const xin = F.minX + T + 0.45;
        steel.box(xin, y1 + 0.45, c, 0.42, 0.42, o.width / 2 + 0.3);
        for (const s of [-1, 1]) {
          steel.box(F.minX + T + 0.07, (y1 + 0.3) / 2, c + s * (o.width / 2 + 0.08), 0.07, (y1 + 0.3) / 2, 0.06);
          steel.box(xin, y1 + 0.45, c + s * (o.width / 2 + 0.31), 0.44, 0.44, 0.02);
        }
        prism(steel, [xin, y1 + 0.45, c - o.width / 2 - 0.25], [xin, y1 + 0.45, c + o.width / 2 + 0.25], 0.36, 10);
        put(c, y1 + 0.3, o.width / 2 + 0.2, 0.25, 0.12, T / 2 + 0.12);
        // yellow-black edge marks on the jambs
        for (const s of [lo + 0.12, hi - 0.12]) {
          for (let k = 0; k < 4; k++) {
            const y = 0.15 + k * 0.5;
            if (w.axis === 'x') yellow.box(s, y, w.fixed, 0.03, 0.12, T / 2 + 0.07);
            else yellow.box(w.fixed, y, s, T / 2 + 0.07, 0.12, 0.03);
          }
        }
      }
    }
  }
}

function downpipes(steel: MeshBuilder): void {
  for (const x of [F.minX - 0.09, F.maxX + 0.09]) {
    for (const z of [F.minZ + 0.6, F.maxZ - 0.6, -12]) {
      steel.box(x, EAVE / 2, z, 0.06, EAVE / 2, 0.06);
      steel.box(x, 0.15, z, 0.2, 0.06, 0.06);
    }
  }
}

function mezzanine(steel: MeshBuilder, yellow: MeshBuilder): void {
  const top = M.floorY;
  const dt = W.deckThickness;
  // chequer plate deck and its edge, joists back to the wall
  steel.box((M.minX + M.maxX) / 2, top - dt / 2, (M.minZ + M.maxZ) / 2, (M.maxX - M.minX) / 2, dt / 2, (M.maxZ - M.minZ) / 2);
  steel.box((M.minX + M.maxX) / 2, top - dt - W.beamDepth / 2, M.maxZ - 0.12, (M.maxX - M.minX) / 2, W.beamDepth / 2, 0.1);
  for (let x = M.minX + 0.3; x <= M.maxX - 0.2; x += 1.5) steel.box(x, top - dt - 0.14, (M.minZ + M.maxZ) / 2, 0.05, 0.14, (M.maxZ - M.minZ) / 2 - 0.1);
  for (const x of W.mezzColumnsX) {
    const h = top - dt - W.beamDepth;
    steel.box(x, h / 2, W.mezzColumnZ, W.mezzColumn / 2, h / 2, W.mezzColumn / 2);
    steel.box(x, 0.02, W.mezzColumnZ, 0.2, 0.02, 0.2);
  }
  // railings: posts, top and mid rails, toe boards
  for (const r of railingRuns()) {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) {
      const x = r.x0 + ((r.x1 - r.x0) * i) / n;
      const z = r.z0 + ((r.z1 - r.z0) * i) / n;
      yellow.box(x, top + W.railHeight / 2, z, 0.03, W.railHeight / 2, 0.03);
    }
    for (const y of [top + W.railHeight, top + W.railHeight * 0.5]) yellow.beam([r.x0, y, r.z0], [r.x1, y, r.z1], 0.05, 0.05);
    yellow.beam([r.x0, top + 0.075, r.z0], [r.x1, top + 0.075, r.z1], 0.02, 0.15);
  }
}

function stair(steel: MeshBuilder, yellow: MeshBuilder): void {
  const { treads } = stairFlight();
  const width = ST.maxX - ST.minX;
  const cx = (ST.minX + ST.maxX) / 2;
  // stringers along the nosing line, just below it
  for (const x of [ST.minX + 0.04, ST.maxX - 0.04]) steel.beam([x, -0.05, ST.bottomZ + 0.1], [x, M.floorY - 0.12, ST.topZ], 0.08, 0.3);
  // open treads: tread i has its nosing at z = bottomZ - i * tread, height i * riser
  for (let i = 1; i <= treads; i++) {
    const zn = ST.bottomZ - i * ST.tread;
    steel.box(cx, i * ST.riser - 0.02, zn - ST.tread / 2, width / 2 - 0.08, 0.02, ST.tread / 2);
    yellow.box(cx, i * ST.riser - 0.005, zn - 0.025, width / 2 - 0.09, 0.008, 0.025);
  }
  // handrails on both sides: posts every 4 treads and a sloped rail 0.9 m above the nosings
  const h = 0.9;
  for (const x of [ST.minX + 0.02, ST.maxX - 0.02]) {
    for (let i = 0; i <= treads + 1; i += 4) {
      const z = ST.bottomZ - i * ST.tread;
      const y = Math.min(M.floorY, i * ST.riser);
      yellow.box(x, y + h / 2, z, 0.025, h / 2, 0.025);
    }
    yellow.beam([x, h, ST.bottomZ], [x, M.floorY + h, ST.topZ], 0.045, 0.045);
  }
}

function office(steel: MeshBuilder, glass: MeshBuilder): void {
  const y0 = M.floorY;
  const h = OFFICE.height;
  const kick = 0.9;
  const t = W.officeWall;
  const d = W.officeDoor;
  const wx = OFFICE.minX + t / 2;
  const sz = OFFICE.maxZ - t / 2;
  const ex = OFFICE.maxX - t / 2;
  // posts
  const postsSouth = [OFFICE.minX + t / 2, 27, 29, 31, OFFICE.maxX - t / 2];
  for (const x of postsSouth) steel.box(x, y0 + h / 2, sz, 0.05, h / 2, 0.05);
  const postsWest = [OFFICE.minZ + 0.05, -21.5, d.z - d.width / 2 - 0.04, d.z + d.width / 2 + 0.04];
  for (const z of postsWest) steel.box(wx, y0 + h / 2, z, 0.05, h / 2, 0.05);
  // south wall: kick panel and glass
  steel.box((OFFICE.minX + OFFICE.maxX) / 2, y0 + kick / 2, sz, (OFFICE.maxX - OFFICE.minX) / 2, kick / 2, t / 2);
  glass.box((OFFICE.minX + OFFICE.maxX) / 2, y0 + (kick + h) / 2, sz, (OFFICE.maxX - OFFICE.minX) / 2 - 0.05, (h - kick) / 2, 0.015);
  steel.box((OFFICE.minX + OFFICE.maxX) / 2, y0 + kick, sz, (OFFICE.maxX - OFFICE.minX) / 2, 0.03, 0.06);
  // west wall: two glazed parts around the door, door head
  const dz0 = d.z - d.width / 2;
  const dz1 = d.z + d.width / 2;
  for (const [za, zb] of [
    [OFFICE.minZ, dz0],
    [dz1, OFFICE.maxZ],
  ] as const) {
    steel.box(wx, y0 + kick / 2, (za + zb) / 2, t / 2, kick / 2, (zb - za) / 2);
    glass.box(wx, y0 + (kick + h) / 2, (za + zb) / 2, 0.015, (h - kick) / 2, (zb - za) / 2 - 0.05);
    steel.box(wx, y0 + kick, (za + zb) / 2, 0.06, 0.03, (zb - za) / 2);
  }
  steel.box(wx, y0 + (d.height + h) / 2, d.z, t / 2, (h - d.height) / 2, d.width / 2);
  // door leaf, swung open against the inside of the west wall
  glass.box(wx + 0.62, y0 + d.height / 2, dz1 + 0.05, 0.55, d.height / 2 - 0.05, 0.015);
  steel.box(wx + 0.62, y0 + d.height / 2, dz1 + 0.05, 0.6, 0.03, 0.03);
  // east wall (closes the gap to the building wall), solid
  steel.box(ex, y0 + h / 2, (OFFICE.minZ + OFFICE.maxZ) / 2, t / 2, h / 2, (OFFICE.maxZ - OFFICE.minZ) / 2);
  // flat roof and fascia
  steel.box((OFFICE.minX + OFFICE.maxX) / 2, y0 + h + W.roofSlab / 2, (OFFICE.minZ + OFFICE.maxZ) / 2, (OFFICE.maxX - OFFICE.minX) / 2 + 0.05, W.roofSlab / 2, (OFFICE.maxZ - OFFICE.minZ) / 2 + 0.05);
  steel.box((OFFICE.minX + OFFICE.maxX) / 2, y0 + h + 0.2, OFFICE.maxZ + 0.04, (OFFICE.maxX - OFFICE.minX) / 2 + 0.05, 0.2, 0.03);
}

function bollards(yellow: MeshBuilder): void {
  for (const [x, z] of W.bollards) prism(yellow, [x, 0, z], [x, W.bollardHeight, z], W.bollardRadius, 8);
}

/**
 * Interior floor: one quad 1.5 cm above the reflective asphalt (the sky reflection stays outside), with
 * UVs in world metres / `tile` so the concrete maps repeat at a real scale, plus thin saw-cut joints.
 */
function floorSlab(floor: MeshBuilder, joints: MeshBuilder): void {
  const { tile, jointSpacing: js, jointWidth: jw } = STRUCTURES.warehouseFloor;
  const x0 = F.minX + T;
  const x1 = F.maxX - T;
  const z0 = F.minZ + T;
  const z1 = F.maxZ - T;
  const y = 0.03;
  floor.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / tile, -z1 / tile, x1 / tile, -z0 / tile]);
  const yj = y + 0.002;
  for (let x = F.minX + js; x < x1 - 0.5; x += js) joints.quad([x - jw / 2, yj, z1], [x + jw / 2, yj, z1], [x + jw / 2, yj, z0], [x - jw / 2, yj, z0]);
  for (let z = F.minZ + js; z < z1 - 0.5; z += js) joints.quad([x0, yj, z + jw / 2], [x1, yj, z + jw / 2], [x1, yj, z - jw / 2], [x0, yj, z - jw / 2]);
}

/** Loads the CC0 concrete maps into `mat` when a DOM exists; the flat colour stays as the fallback. */
function loadFloorMaps(mat: MeshStandardMaterial): void {
  if (typeof document === 'undefined') return;
  const cfg = STRUCTURES.warehouseFloor;
  const loader = new TextureLoader();
  // maps arrive after the resource tracker saw the material: free them with it
  mat.addEventListener('dispose', () => {
    for (const t of new Set([mat.map, mat.normalMap, mat.roughnessMap, mat.aoMap])) t?.dispose();
  });
  const prep = (url: string, srgb: boolean, apply: (t: ReturnType<TextureLoader['load']>) => void): void => {
    loader.load(
      url,
      (t) => {
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.anisotropy = 8;
        if (srgb) t.colorSpace = SRGBColorSpace;
        apply(t);
        mat.needsUpdate = true;
      },
      undefined,
      () => {
        /* keep the flat fallback colour */
      },
    );
  };
  prep(cfg.diffuseUrl, true, (t) => {
    mat.map = t;
    mat.color.setHex(0xe4e4de); // light grey sealed concrete: the shaded interior darkens it enough
  });
  prep(cfg.normalUrl, false, (t) => {
    mat.normalMap = t;
    mat.normalScale = new Vector2(cfg.normalScale, cfg.normalScale);
  });
  prep(cfg.armUrl, false, (t) => {
    mat.roughnessMap = t;
    mat.roughness = 1;
    mat.aoMap = t;
    mat.aoMapIntensity = 0.5;
  });
}

/** Corridor edge lines on the floor (safety yellow), roller door to back door. */
function floorLines(yellow: MeshBuilder): void {
  const y = 0.034;
  const line = (x0: number, z0: number, x1: number, z1: number): void => {
    yellow.box((x0 + x1) / 2, y, (z0 + z1) / 2, Math.max(0.05, Math.abs(x1 - x0) / 2), 0.004, Math.max(0.05, Math.abs(z1 - z0) / 2));
  };
  const xi = F.minX + T + 0.1;
  line(xi, -2, 16, -2);
  line(xi, -6, 12, -6);
  line(12, -6, 12, M.maxZ);
  line(16, -2, 16, M.maxZ);
}

function signs(b: MeshBuilder): void {
  // atlas: top half "BAY 3", bottom half "EXIT / COURT"
  const x = F.minX - 0.04;
  const y = 6.3;
  b.quad([x, y - 0.55, -6.2], [x, y - 0.55, -1.8], [x, y + 0.55, -1.8], [x, y + 0.55, -6.2], [0, 0.5, 1, 1]);
  const z = F.minZ - 0.04;
  b.quad([15.2, 5.25, z], [12.8, 5.25, z], [12.8, 5.75, z], [15.2, 5.75, z], [0, 0, 1, 0.5]);
}

function lampGeometry(): { shade: BufferGeometry; lens: BufferGeometry } {
  const shade = new MeshBuilder();
  const sides = 10;
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const p = (a: number, r: number, y: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
    shade.quad(p(a1, 0.45, 0), p(a0, 0.45, 0), p(a0, 0.16, 0.38), p(a1, 0.16, 0.38));
    shade.quad(p(a0, 0.45, 0.001), p(a1, 0.45, 0.001), p(a1, 0.16, 0.381), p(a0, 0.16, 0.381));
  }
  shade.box(0, 0.5, 0, 0.14, 0.12, 0.14);
  const lens = new MeshBuilder();
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    lens.quad([0, 0.02, 0], [Math.cos(a0) * 0.4, 0.02, Math.sin(a0) * 0.4], [Math.cos(a1) * 0.4, 0.02, Math.sin(a1) * 0.4], [Math.cos(a1) * 0.4, 0.02, Math.sin(a1) * 0.4]);
  }
  return { shade: shade.build(), lens: lens.build() };
}

function lampPlacements(steel: MeshBuilder): WarehouseGeometry['lamps'] {
  const out: WarehouseGeometry['lamps'] = [];
  for (const x of W.lampsX) {
    for (const z of W.lampsZ) {
      out.push({ x, y: W.lampY, z, scale: 1 });
      steel.box(x, (W.lampY + 0.6 + roofHeightAt(x) - 0.3) / 2, z, 0.012, (roofHeightAt(x) - 0.3 - W.lampY - 0.6) / 2, 0.012);
    }
  }
  for (const x of W.underLampsX) out.push({ x, y: W.underLampY, z: W.underLampZ, scale: 0.55 });
  return out;
}

/** Pure: every geometry of the shell (no materials, no DOM). */
export function buildWarehouseGeometry(): WarehouseGeometry {
  const cl = new MeshBuilder();
  const liner = new MeshBuilder();
  const concrete = new MeshBuilder();
  const steel = new MeshBuilder();
  const yellow = new MeshBuilder();
  const glass = new MeshBuilder();
  const sky = new MeshBuilder();
  const sign = new MeshBuilder();
  for (const w of WALLS) wallCladding(cl, liner, concrete, w);
  gables(cl, liner);
  roof(cl, sky, steel);
  frame(steel);
  clerestory(glass, steel);
  openingsDetail(steel, yellow);
  downpipes(steel);
  mezzanine(steel, yellow);
  stair(steel, yellow);
  office(steel, glass);
  bollards(yellow);
  floorLines(yellow);
  signs(sign);
  const lamps = lampPlacements(steel);
  // interior floor slab: just above the wet asphalt, which keeps its sky reflection outside only
  const floor = new MeshBuilder();
  const joints = new MeshBuilder();
  floorSlab(floor, joints);
  const lamp = lampGeometry();
  return {
    cladding: cl.build(),
    liner: liner.build(),
    concrete: concrete.build(),
    floor: floor.build(),
    joints: joints.build(),
    steel: steel.build(),
    yellow: yellow.build(),
    glass: glass.build(),
    skylight: sky.build(),
    signs: sign.build(),
    lampShade: lamp.shade,
    lampLens: lamp.lens,
    lamps,
  };
}

function createSignTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    // top half: bay sign (white on blue), bottom half: exit sign (white on green)
    g.fillStyle = '#1f3d63';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#e8ecef';
    g.font = 'bold 64px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('BAY 3', 256, 52);
    g.font = 'bold 26px sans-serif';
    g.fillText('HARBOUR LOGISTICS', 256, 104);
    g.fillStyle = '#1d6b3a';
    g.fillRect(0, 128, 512, 128);
    g.fillStyle = '#e8ecef';
    g.font = 'bold 60px sans-serif';
    g.fillText('EXIT  >>  COURT', 256, 192);
  }
  return new CanvasTexture(canvas);
}

/** Materials and meshes of the shell, positioned in world space. The caller tracks and adds them. */
export function createWarehouseMeshes(geo: WarehouseGeometry = buildWarehouseGeometry()): { meshes: Object3D[]; materials: Material[] } {
  const cladding = new MeshStandardMaterial({ color: 0x6f7b78, roughness: 0.5, metalness: 0.55, side: DoubleSide });
  applyWeatheredPaint(cladding, { bottomY: 0, height: RIDGE, wear: 0.6, key: 'warehouse-cladding' });
  const liner = new MeshStandardMaterial({ color: 0x3a3f43, roughness: 0.7, metalness: 0.35, side: DoubleSide });
  const concrete = new MeshStandardMaterial({ color: 0x77786f, roughness: 0.85, metalness: 0 });
  applyWeatheredPaint(concrete, { bottomY: 0, height: W.plinthHeight, wear: 0.25, key: 'warehouse-plinth' });
  // the floor sits 1.5 cm over the reflective asphalt: polygon offset keeps it on top at any distance
  const floor = new MeshStandardMaterial({ color: 0x5c5d59, roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  loadFloorMaps(floor);
  const jointMat = new MeshStandardMaterial({ color: 0x2e302e, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const steel = new MeshStandardMaterial({ color: 0x2c3236, roughness: 0.55, metalness: 0.7 });
  applyWeatheredPaint(steel, { bottomY: 0, height: RIDGE, wear: 0.35, key: 'warehouse-steel' });
  const yellow = new MeshStandardMaterial({ color: 0xd9a514, roughness: 0.5, metalness: 0.3 });
  applyWeatheredPaint(yellow, { bottomY: 0, height: 5, wear: 0.5, key: 'warehouse-yellow' });
  const glass = new MeshStandardMaterial({ color: 0x8fa3ad, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.32, depthWrite: false });
  const skylight = new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide });
  skylight.color.setRGB(0.62, 0.68, 0.74); // overcast daylight through the roof lights: glow, no light
  const signMat = new MeshStandardMaterial({ map: createSignTexture(), roughness: 0.6, metalness: 0.1 });
  const shadeMat = new MeshStandardMaterial({ color: 0x1d2124, roughness: 0.5, metalness: 0.8, side: DoubleSide });
  const lensMat = new MeshBasicMaterial({ color: 0xffffff });
  lensMat.color.setRGB(3.0, 2.6, 1.9);

  const meshes: Object3D[] = [];
  const mesh = (g: BufferGeometry, m: Material, name: string, cast = true, receive = true): Mesh => {
    const x = new Mesh(g, m);
    x.name = `warehouse-${name}`;
    x.castShadow = cast;
    x.receiveShadow = receive;
    meshes.push(x);
    return x;
  };
  mesh(geo.cladding, cladding, 'cladding');
  mesh(geo.liner, liner, 'liner');
  mesh(geo.concrete, concrete, 'plinth');
  mesh(geo.floor, floor, 'floor', false, true);
  mesh(geo.joints, jointMat, 'floor-joints', false, true);
  mesh(geo.steel, steel, 'steel');
  mesh(geo.yellow, yellow, 'yellow');
  mesh(geo.glass, glass, 'glass', false, false);
  mesh(geo.skylight, skylight, 'skylights', false, false);
  mesh(geo.signs, signMat, 'signs', false, true);

  const o = new Object3D();
  const instanced = (g: BufferGeometry, m: Material, name: string, cast: boolean): void => {
    const im = new InstancedMesh(g, m, geo.lamps.length);
    geo.lamps.forEach((l, i) => {
      o.position.set(l.x, l.y, l.z);
      o.scale.setScalar(l.scale);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = cast;
    im.name = `warehouse-${name}`;
    meshes.push(im);
  };
  instanced(geo.lampShade, shadeMat, 'lamp-shades', true);
  instanced(geo.lampLens, lensMat, 'lamp-lenses', false);
  return { meshes, materials: [cladding, liner, concrete, floor, jointMat, steel, yellow, glass, skylight, signMat, shadeMat, lensMat] };
}
