import { WAREHOUSE, type Opening, type Rect } from '@/config/warehouse';

/**
 * Pure layout of the warehouse shell (spec 29): walls with their openings, the portal frame, roof planes,
 * stair, mezzanine, railings and the glazed office. No three.js or Rapier here: the mesh builder
 * (warehouse.ts), the colliders and the tests all read these numbers. All dimensions come from the
 * shared contract `src/config/warehouse.ts`; the few local ones are below.
 *
 * Frame: a steel portal frame spanning east-west (26 m), ridge along Z at the middle, frames every 5..6.5 m
 * along Z (set so that no column lands in the roller door).
 */

const F = WAREHOUSE.footprint;
const T = WAREHOUSE.wallThickness;
const EAVE = WAREHOUSE.eaveHeight;
const RIDGE = WAREHOUSE.ridgeHeight;
const M = WAREHOUSE.mezzanine;
const OFFICE = WAREHOUSE.office;
const ST = WAREHOUSE.stairs;

export const WAREHOUSE_LOCAL = {
  /** Concrete plinth under the cladding (m). */
  plinthHeight: 1.0,
  /** Clerestory glazing band on the side walls (decorative, the wall collider stays solid). */
  clerestory: { y0: 7.3, y1: 8.3 },
  /** Roof overhang past the walls (m) and roof sheet thickness for the collider. */
  overhang: 0.45,
  roofThickness: 0.3,
  /** Column section (m) and the frame lines along Z (inner faces of the gables at the ends). */
  column: 0.3,
  frameZ: [F.minZ + T + 0.15, -18, -12, -7.2, -0.8, 5.6, F.maxZ - T - 0.15] as readonly number[],
  /** Mezzanine: deck plate thickness, edge beam depth, column x positions along the open edge. */
  deckThickness: 0.2,
  beamDepth: 0.35,
  mezzColumnsX: [9.2, 11.6, 17, 21, 25, 29, 32.8] as readonly number[],
  mezzColumnZ: M.maxZ - 0.12,
  mezzColumn: 0.25,
  /** Railings: height above the deck and bar thickness (m). */
  railHeight: 1.1,
  railThickness: 0.08,
  /** Office: wall thickness, door in its west wall (centre z, width, height). */
  officeWall: 0.1,
  officeDoor: { z: -19, width: 1.2, height: 2.2 },
  roofSlab: 0.14,
  /** Stair flight: width of the ramp collider, visual stringer section. */
  stairSlab: 0.25,
  /** Bollards outside the doors (x, z). */
  bollards: [
    [WAREHOUSE.footprint.minX - 0.6, -7.0],
    [WAREHOUSE.footprint.minX - 0.6, -1.0],
    [11.2, WAREHOUSE.footprint.minZ - 0.6],
    [16.8, WAREHOUSE.footprint.minZ - 0.6],
  ] as ReadonlyArray<readonly [number, number]>,
  bollardRadius: 0.11,
  bollardHeight: 1.1,
  /** Hanging high-bay lamps over the open floor (lens height) and the smaller ones under the mezzanine. */
  lampY: 7.4,
  lampsX: [12.5, 21, 29.5] as readonly number[],
  lampsZ: [-12, -5, 2, 9] as readonly number[],
  underLampY: 3.05,
  underLampsX: [14, 20, 26, 31] as readonly number[],
  underLampZ: -20.3,
} as const;

export interface Box {
  id: string;
  center: { x: number; y: number; z: number };
  half: { x: number; y: number; z: number };
  /** Optional rotation (unit quaternion); axis-aligned when absent. */
  rotation?: { x: number; y: number; z: number; w: number };
}

export type WallId = 'north' | 'south' | 'west' | 'east';

export interface WallDef {
  id: WallId;
  /** The wall runs along this axis... */
  axis: 'x' | 'z';
  /** ...at this coordinate of the other axis (centre of the wall thickness)... */
  fixed: number;
  /** ...from..to along `axis`. */
  from: number;
  to: number;
  /** Outward normal. */
  nx: number;
  nz: number;
}

export const WALLS: readonly WallDef[] = [
  { id: 'north', axis: 'x', fixed: F.minZ + T / 2, from: F.minX, to: F.maxX, nx: 0, nz: -1 },
  { id: 'south', axis: 'x', fixed: F.maxZ - T / 2, from: F.minX, to: F.maxX, nx: 0, nz: 1 },
  { id: 'west', axis: 'z', fixed: F.minX + T / 2, from: F.minZ + T, to: F.maxZ - T, nx: -1, nz: 0 },
  { id: 'east', axis: 'z', fixed: F.maxX - T / 2, from: F.minZ + T, to: F.maxZ - T, nx: 1, nz: 0 },
];

/** Openings cut in a wall (matched by outward normal and position on the outer face). */
export function openingsOf(wall: WallDef): Opening[] {
  return WAREHOUSE.openings.filter((o) => {
    if (Math.abs(o.nx - wall.nx) > 1e-6 || Math.abs(o.nz - wall.nz) > 1e-6) return false;
    const across = wall.axis === 'x' ? o.z : o.x;
    return Math.abs(across - wall.fixed) <= T;
  });
}

/** Along-wall coordinate of an opening's centre. */
export function alongOf(wall: WallDef, o: Opening): number {
  return wall.axis === 'x' ? o.x : o.z;
}

/** One solid rectangle of a wall: along-range a..b, height y0..y1. */
export interface WallPiece {
  wall: WallDef;
  a: number;
  b: number;
  y0: number;
  y1: number;
}

/**
 * The wall split into solid rectangles around its openings, from the ground to `top` (the eave): full
 * height pieces between openings, a sill piece below and a lintel piece above each opening.
 */
export function wallPieces(wall: WallDef, top: number = EAVE): WallPiece[] {
  const ops = openingsOf(wall)
    .map((o) => ({ lo: alongOf(wall, o) - o.width / 2, hi: alongOf(wall, o) + o.width / 2, y0: o.y - o.height / 2, y1: o.y + o.height / 2 }))
    .sort((p, q) => p.lo - q.lo);
  const out: WallPiece[] = [];
  let cursor = wall.from;
  for (const o of ops) {
    if (o.lo > cursor + 1e-6) out.push({ wall, a: cursor, b: o.lo, y0: 0, y1: top });
    if (o.y0 > 0.01) out.push({ wall, a: o.lo, b: o.hi, y0: 0, y1: o.y0 });
    if (o.y1 < top - 0.01) out.push({ wall, a: o.lo, b: o.hi, y0: o.y1, y1: top });
    cursor = Math.max(cursor, o.hi);
  }
  if (wall.to > cursor + 1e-6) out.push({ wall, a: cursor, b: wall.to, y0: 0, y1: top });
  return out;
}

function pieceBox(p: WallPiece, thickness = T): Box {
  const w = p.wall;
  const mid = (p.a + p.b) / 2;
  const half = (p.b - p.a) / 2;
  const cy = (p.y0 + p.y1) / 2;
  const hy = (p.y1 - p.y0) / 2;
  return w.axis === 'x'
    ? { id: `wall-${w.id}@${mid.toFixed(2)},${cy.toFixed(2)}`, center: { x: mid, y: cy, z: w.fixed }, half: { x: half, y: hy, z: thickness / 2 } }
    : { id: `wall-${w.id}@${mid.toFixed(2)},${cy.toFixed(2)}`, center: { x: w.fixed, y: cy, z: mid }, half: { x: thickness / 2, y: hy, z: half } };
}

/** Height of the roof's top surface at x (pitched, ridge along Z at the middle). */
export function roofHeightAt(x: number): number {
  const ridgeX = (F.minX + F.maxX) / 2;
  const halfSpan = (F.maxX - F.minX) / 2;
  return EAVE + (RIDGE - EAVE) * (1 - Math.min(1, Math.abs(x - ridgeX) / halfSpan));
}

/** The two roof planes: centre line, slope angle and size, shared by the mesh and the colliders. */
export interface RoofPlane {
  side: -1 | 1;
  /** Eave edge (outer, with overhang) and ridge edge, on the X/Y plane. */
  eave: { x: number; y: number };
  ridge: { x: number; y: number };
  /** Rotation about Z of the plane's +X axis (rad). */
  angle: number;
  length: number;
}

export function roofPlanes(): RoofPlane[] {
  const ridgeX = (F.minX + F.maxX) / 2;
  const halfSpan = (F.maxX - F.minX) / 2;
  const slope = (RIDGE - EAVE) / halfSpan;
  const o = WAREHOUSE_LOCAL.overhang;
  return ([-1, 1] as const).map((side) => {
    const eave = { x: ridgeX + side * (halfSpan + o), y: EAVE - o * slope };
    const ridge = { x: ridgeX, y: RIDGE };
    const angle = side < 0 ? Math.atan2(RIDGE - eave.y, ridgeX - eave.x) : -Math.atan2(RIDGE - eave.y, eave.x - ridgeX);
    return { side, eave, ridge, angle, length: Math.hypot(ridge.x - eave.x, ridge.y - eave.y) };
  });
}

const quatZ = (a: number) => ({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) });
const quatX = (a: number) => ({ x: Math.sin(a / 2), y: 0, z: 0, w: Math.cos(a / 2) });

/** Stair geometry derived from the contract: number of risers, run, slope. */
export function stairFlight(): { risers: number; treads: number; run: number; slopeDeg: number; length: number } {
  const risers = Math.round(M.floorY / ST.riser);
  const treads = risers - 1;
  const run = ST.bottomZ - ST.topZ;
  return { risers, treads, run, slopeDeg: (Math.atan2(M.floorY, run) * 180) / Math.PI, length: Math.hypot(run, M.floorY) };
}

/**
 * Ramp collider under the steps: a slab whose top face runs along the nosings, from the floor at the stair
 * foot (z = bottomZ) to the deck edge (z = topZ, y = floorY). The character controller walks it like a slope.
 */
export function stairRamp(): Box {
  const run = ST.bottomZ - ST.topZ;
  const angle = Math.atan2(M.floorY, run);
  const len = Math.hypot(run, M.floorY);
  const extra = 0.4; // continues under the floor at the foot
  const t = WAREHOUSE_LOCAL.stairSlab;
  // top line from the deck edge (topZ, floorY) down to (bottomZ, 0) and `extra` beyond, along (0, -sin, cos)
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const topY = M.floorY;
  const endY = -extra * sin;
  const endZ = ST.bottomZ + extra * cos;
  const midY = (topY + endY) / 2;
  const midZ = (ST.topZ + endZ) / 2;
  // slab centre half a thickness below the top line, along the up normal (0, cos, sin)
  return {
    id: 'stair-ramp',
    center: { x: (ST.minX + ST.maxX) / 2, y: midY - (t / 2) * cos, z: midZ - (t / 2) * sin },
    half: { x: (ST.maxX - ST.minX) / 2, y: t / 2, z: (len + extra) / 2 },
    rotation: quatX(angle),
  };
}

/** Height of the stair's walking surface at z (0 outside the flight). */
export function stairHeightAt(z: number): number {
  if (z > ST.bottomZ || z < ST.topZ) return 0;
  return ((ST.bottomZ - z) / (ST.bottomZ - ST.topZ)) * M.floorY;
}

/** Railing runs on the mezzanine (x0,z0 -> x1,z1 at deck level): open edge and west end, stair top left open. */
export function railingRuns(): Array<{ id: string; x0: number; z0: number; x1: number; z1: number }> {
  return [
    { id: 'rail-edge', x0: ST.maxX, z0: M.maxZ, x1: OFFICE.minX, z1: M.maxZ },
    { id: 'rail-stub', x0: M.minX, z0: M.maxZ, x1: ST.minX, z1: M.maxZ },
    { id: 'rail-west', x0: M.minX, z0: M.minZ, x1: M.minX, z1: M.maxZ },
  ];
}

/** Office walls (on the mezzanine) as pieces: west wall with the door gap, south (glass) and east walls. */
export function officeBoxes(): Box[] {
  const L = WAREHOUSE_LOCAL;
  const y0 = M.floorY;
  const h = OFFICE.height;
  const t = L.officeWall;
  const d = L.officeDoor;
  const out: Box[] = [];
  const zA = OFFICE.minZ;
  const zB = OFFICE.maxZ;
  const dz0 = d.z - d.width / 2;
  const dz1 = d.z + d.width / 2;
  const wx = OFFICE.minX + t / 2;
  out.push({ id: 'office-west-n', center: { x: wx, y: y0 + h / 2, z: (zA + dz0) / 2 }, half: { x: t / 2, y: h / 2, z: (dz0 - zA) / 2 } });
  out.push({ id: 'office-west-s', center: { x: wx, y: y0 + h / 2, z: (dz1 + zB) / 2 }, half: { x: t / 2, y: h / 2, z: (zB - dz1) / 2 } });
  out.push({ id: 'office-door-head', center: { x: wx, y: y0 + (d.height + h) / 2, z: d.z }, half: { x: t / 2, y: (h - d.height) / 2, z: d.width / 2 } });
  out.push({ id: 'office-south', center: { x: (OFFICE.minX + OFFICE.maxX) / 2, y: y0 + h / 2, z: zB - t / 2 }, half: { x: (OFFICE.maxX - OFFICE.minX) / 2, y: h / 2, z: t / 2 } });
  out.push({ id: 'office-east', center: { x: OFFICE.maxX - t / 2, y: y0 + h / 2, z: (zA + zB) / 2 }, half: { x: t / 2, y: h / 2, z: (zB - zA) / 2 } });
  out.push({
    id: 'office-roof',
    center: { x: (OFFICE.minX + OFFICE.maxX) / 2, y: y0 + h + L.roofSlab / 2, z: (zA + zB) / 2 },
    half: { x: (OFFICE.maxX - OFFICE.minX) / 2, y: L.roofSlab / 2, z: (zB - zA) / 2 },
  });
  return out;
}

/** Column centres of the portal frame (both side walls, every frame line). */
export function frameColumns(): Array<{ x: number; z: number }> {
  const c = WAREHOUSE_LOCAL.column;
  const out: Array<{ x: number; z: number }> = [];
  for (const z of WAREHOUSE_LOCAL.frameZ) {
    out.push({ x: F.minX + T + c / 2, z });
    out.push({ x: F.maxX - T - c / 2, z });
  }
  return out;
}

/**
 * Every static collider of the shell: walls with real gaps at the openings, gable fill under the roof,
 * the two roof planes, an invisible parapet on the yard-side eave (no climbing onto the roof from a stack),
 * frame columns, mezzanine deck and columns, stair ramp, railings, office walls and roof, door bollards.
 */
export function warehouseColliders(): Box[] {
  const L = WAREHOUSE_LOCAL;
  const out: Box[] = [];
  for (const w of WALLS) for (const p of wallPieces(w)) out.push(pieceBox(p));
  // gable fill between the eave and the roof (stepped): north and south walls
  const ridgeX = (F.minX + F.maxX) / 2;
  const quarter = (F.maxX - F.minX) / 4;
  for (const w of WALLS.filter((v) => v.axis === 'x')) {
    out.push({ id: `gable-${w.id}-1`, center: { x: ridgeX, y: EAVE + (RIDGE - EAVE) / 4, z: w.fixed }, half: { x: (F.maxX - F.minX) / 2, y: (RIDGE - EAVE) / 4, z: T / 2 } });
    out.push({ id: `gable-${w.id}-2`, center: { x: ridgeX, y: EAVE + ((RIDGE - EAVE) * 3) / 4, z: w.fixed }, half: { x: quarter, y: (RIDGE - EAVE) / 4, z: T / 2 } });
  }
  // roof planes (top face on the roof line)
  for (const r of roofPlanes()) {
    const t = L.roofThickness;
    const nx = -Math.sin(r.angle);
    const ny = Math.cos(r.angle);
    out.push({
      id: `roof-${r.side < 0 ? 'west' : 'east'}`,
      center: { x: (r.eave.x + r.ridge.x) / 2 - (nx * t) / 2, y: (r.eave.y + r.ridge.y) / 2 - (ny * t) / 2, z: (F.minZ + F.maxZ) / 2 },
      half: { x: r.length / 2 + 0.05, y: t / 2, z: (F.maxZ - F.minZ) / 2 + L.overhang },
      rotation: quatZ(r.angle),
    });
  }
  // invisible parapet over the west eave (the yard side): from the eave to 6 m above it
  out.push({ id: 'roof-parapet-west', center: { x: F.minX - 0.3, y: EAVE + 3, z: (F.minZ + F.maxZ) / 2 }, half: { x: 0.6, y: 3, z: (F.maxZ - F.minZ) / 2 + 0.6 } });
  // frame columns
  for (const c of frameColumns()) out.push({ id: `column@${c.x.toFixed(1)},${c.z.toFixed(1)}`, center: { x: c.x, y: EAVE / 2, z: c.z }, half: { x: L.column / 2, y: EAVE / 2, z: L.column / 2 } });
  // mezzanine deck (plate + edge beam) and columns
  const deckY = M.floorY - L.deckThickness / 2;
  out.push({ id: 'mezz-deck', center: { x: (M.minX + M.maxX) / 2, y: deckY, z: (M.minZ + M.maxZ) / 2 }, half: { x: (M.maxX - M.minX) / 2, y: L.deckThickness / 2, z: (M.maxZ - M.minZ) / 2 } });
  for (const x of L.mezzColumnsX) {
    const h = (M.floorY - L.deckThickness) / 2;
    out.push({ id: `mezz-column@${x}`, center: { x, y: h, z: L.mezzColumnZ }, half: { x: L.mezzColumn / 2, y: h, z: L.mezzColumn / 2 } });
  }
  out.push(stairRamp());
  for (const r of railingRuns()) {
    const hy = L.railHeight / 2;
    const ht = L.railThickness / 2;
    out.push({
      id: r.id,
      center: { x: (r.x0 + r.x1) / 2, y: M.floorY + hy, z: (r.z0 + r.z1) / 2 },
      half: { x: Math.max(ht, Math.abs(r.x1 - r.x0) / 2), y: hy, z: Math.max(ht, Math.abs(r.z1 - r.z0) / 2) },
    });
  }
  out.push(...officeBoxes());
  for (const [x, z] of L.bollards) {
    out.push({ id: `bollard@${x},${z}`, center: { x, y: L.bollardHeight / 2, z }, half: { x: L.bollardRadius, y: L.bollardHeight / 2, z: L.bollardRadius } });
  }
  return out;
}

/** World-space axis-aligned bounds of a box (rotated boxes included). */
export function boxBounds(b: Box): Rect & { minY: number; maxY: number } {
  const q = b.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  const out = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const v = [sx * b.half.x, sy * b.half.y, sz * b.half.z] as const;
    // v' = v + 2w (q x v) + 2 q x (q x v)
    const cx = q.y * v[2] - q.z * v[1];
    const cy = q.z * v[0] - q.x * v[2];
    const cz = q.x * v[1] - q.y * v[0];
    const x = v[0] + 2 * (q.w * cx + (q.y * cz - q.z * cy));
    const y = v[1] + 2 * (q.w * cy + (q.z * cx - q.x * cz));
    const z = v[2] + 2 * (q.w * cz + (q.x * cy - q.y * cx));
    out.minX = Math.min(out.minX, b.center.x + x);
    out.maxX = Math.max(out.maxX, b.center.x + x);
    out.minY = Math.min(out.minY, b.center.y + y);
    out.maxY = Math.max(out.maxY, b.center.y + y);
    out.minZ = Math.min(out.minZ, b.center.z + z);
    out.maxZ = Math.max(out.maxZ, b.center.z + z);
  }
  return out;
}
