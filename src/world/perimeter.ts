import { LAND } from '@/config/level';
import { PERIMETER_WALL, WAREHOUSE } from '@/config/warehouse';

/**
 * Pure layout of the 7 m perimeter wall around the outdoor L (spec 29): precast concrete panels between
 * pilasters, with a coping. It closes the land sides; the quay edge (north) stays open to the water. The
 * warehouse's own south and east walls close the inner corner, so the wall here runs:
 *   west   x = -36, the whole land depth
 *   south  z = 34, from the west wall to the dock wall
 *   dock   x = 6, from the south wall up to the warehouse (z 12), plus a stub to the warehouse corner
 *   east   x = 36, from the quay edge to the warehouse north-east corner (z -24), plus a stub to it
 * The wall stands on the land, its play-side face on the outline (inside faces at -35.4, 33.4, 6, -35.4).
 */

export interface PerimeterSegment {
  id: string;
  /** The segment runs along this axis. */
  axis: 'x' | 'z';
  /** Wall centre line (the other axis). */
  fixed: number;
  from: number;
  to: number;
  /** Normal of the face that looks into the play area. */
  nx: number;
  nz: number;
}

const T = PERIMETER_WALL.thickness;
const F = WAREHOUSE.footprint;

export const PERIMETER_SEGMENTS: readonly PerimeterSegment[] = [
  { id: 'west', axis: 'z', fixed: LAND.minX + T / 2, from: LAND.minZ, to: LAND.maxZ, nx: 1, nz: 0 },
  { id: 'south', axis: 'x', fixed: LAND.maxZ - T / 2, from: LAND.minX + T, to: 6 + T, nx: 0, nz: -1 },
  { id: 'dock', axis: 'z', fixed: 6 + T / 2, from: F.maxZ, to: LAND.maxZ - T, nx: -1, nz: 0 },
  { id: 'dock-stub', axis: 'x', fixed: F.maxZ + T / 2, from: 6 + T, to: F.minX + WAREHOUSE.wallThickness, nx: 0, nz: -1 },
  { id: 'east', axis: 'z', fixed: LAND.maxX - T / 2, from: LAND.minZ, to: F.minZ, nx: -1, nz: 0 },
  { id: 'east-stub', axis: 'x', fixed: F.minZ - T / 2, from: F.maxX - WAREHOUSE.wallThickness, to: LAND.maxX - T, nx: 0, nz: -1 },
];

export const PERIMETER_LOCAL = {
  /** Target bay length between pilasters (m); each segment is split into equal bays near this. */
  bay: 4,
  pilaster: { width: 0.5, depth: 0.25 },
  coping: { height: 0.18, overhang: 0.08 },
  /** Invisible blocker above the wall: nothing a double jump from a stack reaches gets over (m). */
  blockerTop: 15,
} as const;

export interface PerimeterBox {
  kind: 'wall' | 'blocker';
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

function segBox(s: PerimeterSegment, y0: number, y1: number, kind: PerimeterBox['kind']): PerimeterBox {
  const mid = (s.from + s.to) / 2;
  const half = (s.to - s.from) / 2;
  const cy = (y0 + y1) / 2;
  const hy = (y1 - y0) / 2;
  return s.axis === 'x'
    ? { kind, center: { x: mid, y: cy, z: s.fixed }, halfExtents: { x: half, y: hy, z: T / 2 } }
    : { kind, center: { x: s.fixed, y: cy, z: mid }, halfExtents: { x: T / 2, y: hy, z: half } };
}

/** Colliders: the wall itself (ground to 7 m) and an invisible blocker above it. */
export function perimeterBoxes(): PerimeterBox[] {
  const out: PerimeterBox[] = [];
  for (const s of PERIMETER_SEGMENTS) {
    out.push(segBox(s, 0, PERIMETER_WALL.height, 'wall'));
    out.push(segBox(s, PERIMETER_WALL.height, PERIMETER_LOCAL.blockerTop, 'blocker'));
  }
  return out;
}

export interface PanelPlacement {
  x: number;
  z: number;
  /** Rotation about Y: 0 = runs along X, PI/2 = runs along Z. */
  yaw: number;
  /** Length along the run (m). */
  length: number;
  /** Play-side normal, for the pilasters that stand proud on that face. */
  nx: number;
  nz: number;
}

/** Panels (one per bay) and pilasters (at every bay joint and both ends), for instancing. */
export function perimeterPlacements(): { panels: PanelPlacement[]; pilasters: PanelPlacement[]; copings: PanelPlacement[] } {
  const panels: PanelPlacement[] = [];
  const pilasters: PanelPlacement[] = [];
  const copings: PanelPlacement[] = [];
  for (const s of PERIMETER_SEGMENTS) {
    const len = s.to - s.from;
    const n = Math.max(1, Math.round(len / PERIMETER_LOCAL.bay));
    const bay = len / n;
    const yaw = s.axis === 'x' ? 0 : Math.PI / 2;
    const at = (t: number): { x: number; z: number } => (s.axis === 'x' ? { x: t, z: s.fixed } : { x: s.fixed, z: t });
    for (let i = 0; i < n; i++) panels.push({ ...at(s.from + (i + 0.5) * bay), yaw, length: bay, nx: s.nx, nz: s.nz });
    // short stubs get no pilasters of their own (the warehouse corner and the long wall frame them)
    if (len > 3) for (let i = 0; i <= n; i++) pilasters.push({ ...at(s.from + i * bay), yaw, length: PERIMETER_LOCAL.pilaster.width, nx: s.nx, nz: s.nz });
    copings.push({ ...at((s.from + s.to) / 2), yaw, length: len, nx: s.nx, nz: s.nz });
  }
  return { panels, pilasters, copings };
}
