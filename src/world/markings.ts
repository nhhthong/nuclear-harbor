import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';
import { BOSS_ARENA, LAND, TOWERS } from '@/config/level';
import { WAREHOUSE } from '@/config/warehouse';
import { WORLD_LOCAL } from './tunables';

/**
 * Road paint of the outdoor ground (owner request 2026-11-20): zebra crossings, parking bays, zone names,
 * lane lines, keep-clear hatching, the relay ring and the boss landing ring. The shapes are pure data in
 * world metres (`MARKINGS`); `createMarkingsTexture` paints them once into a top-down canvas that the wet
 * ground shader samples in world space (worn by the shader's paint-wear noise).
 *
 * Text reads correctly for a viewer standing south of it and looking north (yaw 0), unless `rot` is set.
 */

export type Paint = 'white' | 'yellow';

export type Marking =
  | { readonly kind: 'line'; readonly a: readonly [number, number]; readonly b: readonly [number, number]; readonly w: number; readonly paint: Paint; readonly dash?: readonly [number, number] }
  | {
      readonly kind: 'zebra';
      readonly cx: number;
      readonly cz: number;
      /** Stripes run along this axis (the traffic direction). */
      readonly along: 'x' | 'z';
      /** Stripe length along `along` (m). */
      readonly length: number;
      /** Width of the road the crossing spans, across `along` (m). */
      readonly span: number;
    }
  | { readonly kind: 'hatch'; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly paint: Paint }
  | { readonly kind: 'text'; readonly x: number; readonly z: number; readonly text: string; readonly size: number; readonly paint: Paint; readonly rot?: number }
  | { readonly kind: 'ring'; readonly x: number; readonly z: number; readonly r: number; readonly w: number; readonly paint: Paint; readonly dash?: readonly [number, number] }
  | { readonly kind: 'arrow'; readonly x: number; readonly z: number; readonly len: number; readonly paint: Paint; /** 0 = north, PI/2 = east. */ readonly dir: number };

const Y = WORLD_LOCAL.yard;
const LANE_HALF = Y.laneWidth / 2;
const AISLE_HALF = Y.aisleWidth / 2;
const AISLE_Z = Y.ewAislesZ[0] ?? -4;
const YARD_N = WAREHOUSE.footprint.minZ + 1; // just south of the container wall
const YARD_S = WAREHOUSE.footprint.maxZ - 0.5;
const LINE = 0.12;
const DASH: readonly [number, number] = [3, 3];

/** Splits [a, b] by the given gaps (each [g0, g1]), returning the pieces that remain. */
export function cutRange(a: number, b: number, gaps: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  let pieces: Array<[number, number]> = [[a, b]];
  for (const [g0, g1] of gaps) {
    pieces = pieces.flatMap(([p0, p1]): Array<[number, number]> => {
      if (g1 <= p0 || g0 >= p1) return [[p0, p1]];
      const out: Array<[number, number]> = [];
      if (g0 > p0) out.push([p0, g0]);
      if (g1 < p1) out.push([g1, p1]);
      return out;
    });
  }
  return pieces.filter(([p0, p1]) => p1 - p0 > 0.3);
}

function yardLanes(): Marking[] {
  const out: Marking[] = [];
  const aisleGap: [number, number] = [AISLE_Z - AISLE_HALF, AISLE_Z + AISLE_HALF];
  for (const x of Y.nsLanesX) {
    for (const [z0, z1] of cutRange(YARD_N, YARD_S, [aisleGap])) {
      out.push({ kind: 'line', a: [x - LANE_HALF, z0], b: [x - LANE_HALF, z1], w: LINE, paint: 'yellow' });
      out.push({ kind: 'line', a: [x + LANE_HALF, z0], b: [x + LANE_HALF, z1], w: LINE, paint: 'yellow' });
      out.push({ kind: 'line', a: [x, z0], b: [x, z1], w: 0.1, paint: 'white', dash: DASH });
    }
  }
  const laneGaps = Y.nsLanesX.map((x): [number, number] => [x - LANE_HALF, x + LANE_HALF]);
  for (const [x0, x1] of cutRange(LAND.minX + Y.edgeMargin, WAREHOUSE.footprint.minX - 0.2, laneGaps)) {
    out.push({ kind: 'line', a: [x0, AISLE_Z - AISLE_HALF], b: [x1, AISLE_Z - AISLE_HALF], w: LINE, paint: 'yellow' });
    out.push({ kind: 'line', a: [x0, AISLE_Z + AISLE_HALF], b: [x1, AISLE_Z + AISLE_HALF], w: LINE, paint: 'yellow' });
    out.push({ kind: 'line', a: [x0, AISLE_Z], b: [x1, AISLE_Z], w: 0.1, paint: 'white', dash: DASH });
  }
  return out;
}

/** A parking row: `n` bays of width `w` side by side along x, from `x0`, between z0 and z1 (back line at `back`). */
function bays(x0: number, n: number, w: number, z0: number, z1: number, back: number, firstNo: number): Marking[] {
  const out: Marking[] = [];
  for (let i = 0; i <= n; i++) out.push({ kind: 'line', a: [x0 + i * w, z0], b: [x0 + i * w, z1], w: LINE, paint: 'white' });
  out.push({ kind: 'line', a: [x0, back], b: [x0 + n * w, back], w: LINE, paint: 'white' });
  const front = back === z0 ? z1 : z0;
  for (let i = 0; i < n; i++) {
    const no = String(firstNo + i).padStart(2, '0');
    out.push({ kind: 'text', x: x0 + (i + 0.5) * w, z: front + (back < front ? -0.55 : 0.55), text: no, size: 0.5, paint: 'white' });
  }
  return out;
}

/** An outlined box (truck or pickup bay). */
function box(minX: number, maxX: number, minZ: number, maxZ: number, paint: Paint): Marking[] {
  return [
    { kind: 'line', a: [minX, minZ], b: [maxX, minZ], w: LINE, paint },
    { kind: 'line', a: [maxX, minZ], b: [maxX, maxZ], w: LINE, paint },
    { kind: 'line', a: [maxX, maxZ], b: [minX, maxZ], w: LINE, paint },
    { kind: 'line', a: [minX, maxZ], b: [minX, minZ], w: LINE, paint },
  ];
}

const tower = TOWERS[0]?.position ?? { x: 0, y: 0, z: -34 };
const backDoor = WAREHOUSE.openings.find((o) => o.id === 'north-back') ?? WAREHOUSE.openings[0]!;
const roller = WAREHOUSE.openings.find((o) => o.id === 'west-roller') ?? WAREHOUSE.openings[0]!;
const QUAY_LANE_Z = -46.5;

export const MARKINGS: readonly Marking[] = [
  // ---- container yard: lane edges, centre dashes, crossings at the gate and on the aisle ----
  ...yardLanes(),
  ...Y.nsLanesX.map((x): Marking => ({ kind: 'zebra', cx: x, cz: YARD_S - 2, along: 'z', length: 3, span: Y.laneWidth })),
  { kind: 'zebra', cx: -6.5, cz: AISLE_Z, along: 'x', length: 3, span: Y.aisleWidth },
  ...Y.nsLanesX.map((x): Marking => ({ kind: 'arrow', x, z: 4, len: 3.2, paint: 'white', dir: 0 })),
  { kind: 'arrow', x: -26, z: AISLE_Z, len: 3.2, paint: 'white', dir: Math.PI / 2 },
  { kind: 'text', x: -15, z: -14, text: 'YARD  A', size: 1.1, paint: 'white' },
  { kind: 'text', x: 2, z: -14, text: 'SLOW', size: 1.2, paint: 'white' },
  { kind: 'text', x: -2.5, z: AISLE_Z + 0.05, text: 'BAY 3', size: 1.0, paint: 'white', rot: Math.PI / 2 },
  // keep the roller-door apron clear
  { kind: 'hatch', minX: roller.x - 2.6, maxX: roller.x - 0.15, minZ: roller.z - roller.width / 2, maxZ: roller.z + roller.width / 2, paint: 'yellow' },

  // ---- gate apron: staff car parks, gate text ----
  ...bays(-32.5, 4, 3, 16.6, 22.0, 16.6, 1),
  { kind: 'text', x: -26.5, z: 23.6, text: 'STAFF PARKING', size: 0.7, paint: 'white' },
  ...bays(-3.9, 3, 3, 14.4, 19.8, 19.8, 5),
  { kind: 'text', x: -15, z: 24.5, text: 'GATE  C', size: 1.3, paint: 'white' },
  { kind: 'text', x: -15, z: 23.0, text: 'ZONE', size: 0.6, paint: 'white' },
  { kind: 'line', a: [LAND.minX + 1, 13.2], b: [-18.5, 13.2], w: 0.35, paint: 'white' },

  // ---- relay court: crossing at the back door, relay ring, pickup bay, zone name ----
  { kind: 'zebra', cx: backDoor.x, cz: backDoor.z - 3.6, along: 'x', length: 4, span: 5 },
  { kind: 'ring', x: tower.x, z: tower.z, r: 5.2, w: 0.22, paint: 'yellow', dash: [1.2, 0.8] },
  { kind: 'text', x: tower.x, z: tower.z + 6.6, text: 'RELAY', size: 0.9, paint: 'yellow' },
  ...box(-33.6, -26.4, -40.6, -37.8, 'white'),
  { kind: 'text', x: -20, z: -27.2, text: 'COURT  B', size: 1.3, paint: 'white' },

  // ---- quay: service lane, crossing, truck bay, boss landing ring, zone name ----
  ...cutRange(LAND.minX + 1, LAND.maxX - 1, [[-34, -20]]).map(([x0, x1]): Marking => ({ kind: 'line', a: [x0, QUAY_LANE_Z], b: [x1, QUAY_LANE_Z], w: 0.12, paint: 'white', dash: DASH })),
  { kind: 'zebra', cx: backDoor.x, cz: QUAY_LANE_Z, along: 'x', length: 4, span: 6 },
  ...box(-34, -20, -44.8, -41.2, 'yellow'),
  { kind: 'text', x: -27, z: -41.9, text: 'TRUCK', size: 0.6, paint: 'yellow' },
  { kind: 'ring', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z, r: BOSS_ARENA.radius - 0.8, w: 0.4, paint: 'yellow', dash: [2.2, 1.4] },
  { kind: 'ring', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z, r: 4, w: 0.3, paint: 'white' },
  { kind: 'text', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z + 1.1, text: 'H', size: 3.2, paint: 'white' },
  { kind: 'text', x: 6, z: -50, text: 'QUAY  D', size: 1.3, paint: 'white' },
];

/** Every point a marking paints, for tests (corners of lines/boxes, centres of text/rings). */
export function markingPoints(m: Marking): Array<[number, number]> {
  switch (m.kind) {
    case 'line':
      return [m.a as [number, number], m.b as [number, number]];
    case 'zebra': {
      const hx = m.along === 'x' ? m.length / 2 : m.span / 2;
      const hz = m.along === 'x' ? m.span / 2 : m.length / 2;
      return [
        [m.cx - hx, m.cz - hz],
        [m.cx + hx, m.cz + hz],
      ];
    }
    case 'hatch':
      return [
        [m.minX, m.minZ],
        [m.maxX, m.maxZ],
      ];
    case 'ring':
      return [
        [m.x - m.r, m.z - m.r],
        [m.x + m.r, m.z + m.r],
      ];
    default:
      return [[m.x, m.z]];
  }
}

const COLOURS: Record<Paint, string> = { white: '#f2f2ee', yellow: '#ffc21a' };

/** Paints `MARKINGS` into a top-down canvas: x -> east, canvas y -> south (+z), `ppm` pixels per metre. */
export function paintMarkings(g: CanvasRenderingContext2D, ppm: number, list: readonly Marking[] = MARKINGS): void {
  const px = (x: number): number => (x - LAND.minX) * ppm;
  const pz = (z: number): number => (z - LAND.minZ) * ppm;
  g.lineCap = 'butt';
  for (const m of list) {
    if (m.kind !== 'zebra') {
      g.strokeStyle = COLOURS[m.paint];
      g.fillStyle = COLOURS[m.paint];
    }
    switch (m.kind) {
      case 'line':
        g.lineWidth = m.w * ppm;
        g.setLineDash(m.dash ? [m.dash[0] * ppm, m.dash[1] * ppm] : []);
        g.beginPath();
        g.moveTo(px(m.a[0]), pz(m.a[1]));
        g.lineTo(px(m.b[0]), pz(m.b[1]));
        g.stroke();
        break;
      case 'zebra': {
        g.fillStyle = COLOURS.white;
        const stripe = 0.5;
        const n = Math.floor(m.span / (stripe * 2)) + 1;
        const start = -((n - 1) * stripe * 2) / 2;
        for (let i = 0; i < n; i++) {
          const o = start + i * stripe * 2;
          if (m.along === 'z') g.fillRect(px(m.cx + o - stripe / 2), pz(m.cz - m.length / 2), stripe * ppm, m.length * ppm);
          else g.fillRect(px(m.cx - m.length / 2), pz(m.cz + o - stripe / 2), m.length * ppm, stripe * ppm);
        }
        break;
      }
      case 'hatch': {
        g.setLineDash([]);
        g.lineWidth = 0.12 * ppm;
        g.strokeRect(px(m.minX), pz(m.minZ), (m.maxX - m.minX) * ppm, (m.maxZ - m.minZ) * ppm);
        g.save();
        g.beginPath();
        g.rect(px(m.minX), pz(m.minZ), (m.maxX - m.minX) * ppm, (m.maxZ - m.minZ) * ppm);
        g.clip();
        g.lineWidth = 0.22 * ppm;
        const span = m.maxX - m.minX + m.maxZ - m.minZ;
        for (let d = -span; d < span; d += 0.8) {
          g.beginPath();
          g.moveTo(px(m.minX + d), pz(m.minZ));
          g.lineTo(px(m.minX + d + (m.maxZ - m.minZ)), pz(m.maxZ));
          g.stroke();
        }
        g.restore();
        break;
      }
      case 'text':
        g.save();
        g.translate(px(m.x), pz(m.z));
        if (m.rot) g.rotate(m.rot);
        g.font = `bold ${Math.round(m.size * ppm)}px "Arial Narrow", Arial, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(m.text, 0, 0);
        g.restore();
        break;
      case 'ring':
        g.lineWidth = m.w * ppm;
        g.setLineDash(m.dash ? [m.dash[0] * ppm, m.dash[1] * ppm] : []);
        g.beginPath();
        g.arc(px(m.x), pz(m.z), m.r * ppm, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'arrow': {
        // shaft plus head, drawn pointing north then rotated (canvas rotation is clockwise = towards east)
        g.save();
        g.translate(px(m.x), pz(m.z));
        g.rotate(m.dir);
        const L = m.len * ppm;
        const s = 0.18 * ppm;
        g.setLineDash([]);
        g.beginPath();
        g.moveTo(-s, L / 2);
        g.lineTo(-s, -L / 6);
        g.lineTo(-3 * s, -L / 6);
        g.lineTo(0, -L / 2);
        g.lineTo(3 * s, -L / 6);
        g.lineTo(s, -L / 6);
        g.lineTo(s, L / 2);
        g.closePath();
        g.fill();
        g.restore();
        break;
      }
    }
  }
  g.setLineDash([]);
}

/** The road paint as a texture covering the whole land rectangle (no DOM: returns null). */
export function createMarkingsTexture(ppm = WORLD_LOCAL.groundTextures.markingsPxPerM): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((LAND.maxX - LAND.minX) * ppm);
  canvas.height = Math.round((LAND.maxZ - LAND.minZ) * ppm);
  const g = canvas.getContext('2d');
  if (!g) return null;
  paintMarkings(g, ppm);
  const tex = new CanvasTexture(canvas);
  tex.flipY = false; // canvas row 0 is LAND.minZ, sampled at v = 0
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  return tex;
}
