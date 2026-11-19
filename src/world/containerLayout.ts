import {
  KEEP_CLEAR,
  LAND,
  YARD_RECT,
  ZONES,
  type ZoneId,
} from '@/config/level';
import { PERIMETER_WALL } from '@/config/warehouse';
import { WORLD } from '@/config/tunables';
import { structureSolids } from '@/structures/layout';
import { createRng } from './rng';
import { SHELTERS, shelterFootprint, toWorld } from './shelters';
import { WORLD_LOCAL } from './tunables';

/**
 * Pure container layout generator (GDD 7.5, 6.3). No three.js, Rapier or DOM: deterministic for a
 * given seed and unit-tested. Containers are laid out on a grid in runs (one run = containers
 * side by side with the same stack height); each run yields at most two merged collider boxes.
 */

interface ContainerInstance {
  x: number;
  /** Centre height. */
  y: number;
  z: number;
  /** Rotation around Y: 0 (length along X) or PI/2 (length along Z). */
  yaw: number;
  colorIndex: number;
  /** 1 = ground tier. */
  tier: number;
  isTop: boolean;
  zone: ZoneId;
}

export interface ColliderBox {
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  /** True for the top tier box of a run (GDD 7.5). */
  grappleable: boolean;
  zone: ZoneId;
  /** Rotation about Y (0 for grid-aligned boxes; loose boxes are set down at an angle). */
  yaw?: number;
}

interface StackTop {
  /** Top edge centre of the stack. */
  x: number;
  y: number;
  z: number;
  zone: ZoneId;
  /** Rotation of the stack (multiples of PI/2 for grid stacks). */
  yaw: number;
}

/** A straight, obstacle-free strip for Duck runs (centre line + width). */
export interface Lane {
  id: string;
  axis: 'x' | 'z';
  start: { x: number; z: number };
  end: { x: number; z: number };
  width: number;
  length: number;
}

export interface ContainerLayout {
  instances: ContainerInstance[];
  boxes: ColliderBox[];
  stackTops: StackTop[];
  lanes: Lane[];
  zoneCounts: Record<'A' | 'B' | 'D', number>;
}

export interface LayoutParams {
  seed: number;
}


const L = WORLD.container.length;
const W = WORLD.container.width;
const H = WORLD.container.height;
const PITCH = L + WORLD_LOCAL.containerGap;

function cellHalf(alongZ: boolean): { hx: number; hz: number } {
  return alongZ ? { hx: W / 2, hz: L / 2 } : { hx: L / 2, hz: W / 2 };
}

/** Distance test of an axis-aligned rectangle against every keep-clear disc. */
export function rectHitsKeepClear(cx: number, cz: number, hx: number, hz: number, margin: number): boolean {
  for (const d of KEEP_CLEAR) {
    const px = Math.max(cx - hx, Math.min(d.x, cx + hx));
    const pz = Math.max(cz - hz, Math.min(d.z, cz + hz));
    if (Math.hypot(px - d.x, pz - d.z) < d.radius + margin) return true;
  }
  return false;
}

function pickHeight(rng: () => number, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return Math.min(i + 1, WORLD.maxContainerStack);
  }
  return 1;
}


interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function rectsOverlap(a: Rect, b: Rect, margin: number): boolean {
  return a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;
}

/** Longest part of a lane centre line that stays out of keep-clear discs (sampled every 0.5 m). */
function clipLane(axis: 'x' | 'z', fixed: number, from: number, to: number, width: number, id: string): Lane | null {
  const step = 0.5;
  let best: [number, number] | null = null;
  let startAt: number | null = null;
  for (let t = from; t <= to + 1e-6; t += step) {
    const x = axis === 'x' ? t : fixed;
    const z = axis === 'x' ? fixed : t;
    const blocked = KEEP_CLEAR.some((d) => Math.hypot(x - d.x, z - d.z) < d.radius + width / 2);
    if (blocked) {
      startAt = null;
      continue;
    }
    if (startAt === null) startAt = t;
    if (!best || t - startAt > best[1] - best[0]) best = [startAt, t];
  }
  if (!best || best[1] - best[0] < WORLD_LOCAL.lane.minLength) return null;
  const [a, b] = best;
  return {
    id,
    axis,
    start: axis === 'x' ? { x: a, z: fixed } : { x: fixed, z: a },
    end: axis === 'x' ? { x: b, z: fixed } : { x: fixed, z: b },
    width,
    length: b - a,
  };
}

/** Everything containers must leave alone: props, masts, crane legs, safe containers and their doors. */
function obstacleRects(): Rect[] {
  const out: Rect[] = [];
  for (const b of structureSolids()) {
    out.push({ minX: b.center.x - b.half.x - 1, maxX: b.center.x + b.half.x + 1, minZ: b.center.z - b.half.z - 1, maxZ: b.center.z + b.half.z + 1 });
  }
  for (const sh of SHELTERS) {
    const f = shelterFootprint(sh);
    const door = toWorld(sh, WORLD.container.length / 2 + 4, 0);
    out.push({
      minX: Math.min(f.minX, door.x) - 1.2,
      maxX: Math.max(f.maxX, door.x) + 1.2,
      minZ: Math.min(f.minZ, door.z) - 1.2,
      maxZ: Math.max(f.maxZ, door.z) + 1.2,
    });
  }
  return out;
}

function cellFree(cx: number, cz: number, hx: number, hz: number, blocked: readonly Rect[]): boolean {
  if (rectHitsKeepClear(cx, cz, hx, hz, WORLD_LOCAL.keepClearMargin)) return false;
  const r: Rect = { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
  return !blocked.some((b) => rectsOverlap(r, b, 0));
}

function heightAround(rng: () => number, base: number): number {
  const y = WORLD_LOCAL.yard;
  if (rng() >= y.stepChance) return base;
  const h = base + (rng() < 0.5 ? -1 : 1);
  return Math.max(1, Math.min(WORLD.maxContainerStack, h));
}

/** One stack: instances for every tier and its stack top. */
function emitStack(layout: ContainerLayout, rng: () => number, zone: ZoneId, x: number, z: number, yaw: number, height: number): void {
  const colorBase = Math.floor(rng() * WORLD_LOCAL.containerColors.length);
  for (let tier = 1; tier <= height; tier++) {
    layout.instances.push({
      x,
      y: (tier - 0.5) * H,
      z,
      yaw,
      // most stacks mix colours, some keep one line's livery colour
      colorIndex: rng() < 0.35 ? colorBase : Math.floor(rng() * WORLD_LOCAL.containerColors.length),
      tier,
      isTop: tier === height,
      zone,
    });
  }
  layout.stackTops.push({ x, y: height * H, z, zone, yaw });
  if (zone === 'A' || zone === 'B' || zone === 'D') layout.zoneCounts[zone] += height;
}

/**
 * A row of cells along X or Z starting at (x0, z0). Each cell has its own height; consecutive cells of
 * the same height share collider boxes (a lower box for the full tiers and the top tier box).
 */
function emitRow(
  layout: ContainerLayout,
  rng: () => number,
  zone: ZoneId,
  x0: number,
  z0: number,
  alongZ: boolean,
  heights: readonly number[],
): void {
  const yaw = alongZ ? Math.PI / 2 : 0;
  const { hx, hz } = cellHalf(alongZ);
  const centre = (i: number): { x: number; z: number } => (alongZ ? { x: x0, z: z0 + i * PITCH } : { x: x0 + i * PITCH, z: z0 });
  let i = 0;
  while (i < heights.length) {
    const h = heights[i] as number;
    if (h <= 0) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < heights.length && heights[j + 1] === h) j++;
    for (let k = i; k <= j; k++) {
      const c = centre(k);
      emitStack(layout, rng, zone, c.x, c.z, yaw, h);
    }
    const a = centre(i);
    const b = centre(j);
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    const halfX = hx + Math.abs(b.x - a.x) / 2;
    const halfZ = hz + Math.abs(b.z - a.z) / 2;
    if (h > 1) {
      layout.boxes.push({ center: { x: cx, y: ((h - 1) * H) / 2, z: cz }, halfExtents: { x: halfX, y: ((h - 1) * H) / 2, z: halfZ }, grappleable: false, zone });
    }
    layout.boxes.push({ center: { x: cx, y: (h - 0.5) * H, z: cz }, halfExtents: { x: halfX, y: H / 2, z: halfZ }, grappleable: true, zone });
    i = j + 1;
  }
}

type BlockStyle = 'rows' | 'columns' | 'dump';

/** Long rows across the block, in pairs split by straddle gaps; ragged ends, steps and holes. */
function fillRows(layout: ContainerLayout, rng: () => number, rect: Rect, alongZ: boolean, blocked: readonly Rect[]): void {
  const y = WORLD_LOCAL.yard;
  const across = alongZ ? rect.maxX - rect.minX : rect.maxZ - rect.minZ;
  const along = alongZ ? rect.maxZ - rect.minZ : rect.maxX - rect.minX;
  const maxCells = Math.floor((along + WORLD_LOCAL.containerGap) / PITCH);
  if (maxCells < 1) return;
  const { hx, hz } = cellHalf(alongZ);
  let offset = 0;
  let row = 0;
  while (offset + W <= across + 1e-6) {
    const base = pickHeight(rng, y.heightWeights);
    // ragged ends: start late or stop early by a cell now and then
    const skipStart = maxCells >= 3 && rng() < 0.35 ? 1 : 0;
    const skipEnd = maxCells >= 3 && rng() < 0.35 ? 1 : 0;
    const slack = along - maxCells * PITCH + WORLD_LOCAL.containerGap;
    const shift = rng() * Math.max(0, slack);
    const heights: number[] = [];
    for (let c = 0; c < maxCells; c++) {
      let h = c < skipStart || c >= maxCells - skipEnd ? 0 : heightAround(rng, base);
      if (rng() < y.holeChance) h = 0;
      heights.push(h);
    }
    const lineCoord = (alongZ ? rect.minX : rect.minZ) + offset + W / 2;
    const startCoord = (alongZ ? rect.minZ : rect.minX) + shift + L / 2;
    const x0 = alongZ ? lineCoord : startCoord;
    const z0 = alongZ ? startCoord : lineCoord;
    for (let c = 0; c < heights.length; c++) {
      const cx = alongZ ? x0 : x0 + c * PITCH;
      const cz = alongZ ? z0 + c * PITCH : z0;
      if (heights[c]! > 0 && !cellFree(cx, cz, hx, hz, blocked)) heights[c] = 0;
    }
    emitRow(layout, rng, 'A', x0, z0, alongZ, heights);
    row++;
    offset += W + (row % 2 === 0 ? y.straddleGap : y.rowGap);
  }
}

/** A loose dump: boxes set down one by one at small angles, one or two high, not overlapping. */
function fillDump(layout: ContainerLayout, rng: () => number, rect: Rect, blocked: readonly Rect[]): void {
  const y = WORLD_LOCAL.yard;
  const [lo, hi] = y.dumpCount as readonly [number, number];
  const target = lo + Math.floor(rng() * (hi - lo + 1));
  const placed: Rect[] = [];
  for (let attempt = 0; attempt < 120 && placed.length < target; attempt++) {
    const quarter = rng() < 0.5 ? 0 : Math.PI / 2;
    const yaw = quarter + (rng() - 0.5) * 2 * y.dumpYaw;
    // axis-aligned bounds of the rotated footprint
    const c = Math.abs(Math.cos(yaw));
    const sn = Math.abs(Math.sin(yaw));
    const bx = (L / 2) * c + (W / 2) * sn;
    const bz = (L / 2) * sn + (W / 2) * c;
    if (rect.maxX - rect.minX < 2 * bx || rect.maxZ - rect.minZ < 2 * bz) continue;
    const x = rect.minX + bx + rng() * (rect.maxX - rect.minX - 2 * bx);
    const z = rect.minZ + bz + rng() * (rect.maxZ - rect.minZ - 2 * bz);
    const r: Rect = { minX: x - bx, maxX: x + bx, minZ: z - bz, maxZ: z + bz };
    if (placed.some((p) => rectsOverlap(r, p, 0.4))) continue;
    if (!cellFree(x, z, bx, bz, blocked)) continue;
    placed.push(r);
    const height = rng() < 0.45 ? 2 : 1;
    emitStack(layout, rng, 'A', x, z, yaw, height);
    if (height > 1) {
      layout.boxes.push({ center: { x, y: ((height - 1) * H) / 2, z }, halfExtents: { x: L / 2, y: ((height - 1) * H) / 2, z: W / 2 }, grappleable: false, zone: 'A', yaw });
    }
    layout.boxes.push({ center: { x, y: (height - 0.5) * H, z }, halfExtents: { x: L / 2, y: H / 2, z: W / 2 }, grappleable: true, zone: 'A', yaw });
  }
}

/** Top of the invisible blocker over the yard's north wall (above anything a jump from a stack reaches). */
const NORTH_WALL_BLOCKER_TOP = 15;

/**
 * North wall of the yard (spec 29): one row of containers along z = -24, two high, from the warehouse west
 * wall to the perimeter wall, with one continuous collider (no gap anywhere, even between the boxes) and an
 * invisible blocker above it. The only way from the yard to the relay court is through the warehouse.
 */
function generateNorthWall(layout: ContainerLayout, rng: () => number): Rect {
  const tiers = WORLD_LOCAL.yard.northWallTiers;
  const east = YARD_RECT.maxX;
  const west = LAND.minX + PERIMETER_WALL.thickness;
  const z = YARD_RECT.minZ + W / 2;
  // whole cells only; the last few centimetres are covered by the continuous collider
  const cells = Math.max(1, Math.round((east - west + WORLD_LOCAL.containerGap) / PITCH));
  const heights = Array.from({ length: cells }, () => tiers);
  // first cell flush with the warehouse wall, the row runs west; the last cell may tuck into the perimeter wall
  const x0 = east - L / 2 - (cells - 1) * PITCH;
  for (let c = 0; c < cells; c++) emitStack(layout, rng, 'A', x0 + c * PITCH, z, 0, heights[c] as number);
  const minX = LAND.minX;
  const cx = (minX + east) / 2;
  const hx = (east - minX) / 2;
  if (tiers > 1) {
    layout.boxes.push({ center: { x: cx, y: ((tiers - 1) * H) / 2, z }, halfExtents: { x: hx, y: ((tiers - 1) * H) / 2, z: W / 2 }, grappleable: false, zone: 'A' });
  }
  layout.boxes.push({ center: { x: cx, y: (tiers - 0.5) * H, z }, halfExtents: { x: hx, y: H / 2, z: W / 2 }, grappleable: true, zone: 'A' });
  const top = tiers * H;
  layout.boxes.push({
    center: { x: cx, y: (top + NORTH_WALL_BLOCKER_TOP) / 2, z },
    halfExtents: { x: hx, y: (NORTH_WALL_BLOCKER_TOP - top) / 2, z: W / 2 },
    grappleable: false,
    zone: 'A',
  });
  return { minX, maxX: east, minZ: YARD_RECT.minZ, maxZ: YARD_RECT.minZ + W };
}

function generateYard(layout: ContainerLayout, rng: () => number, blocked: readonly Rect[], northWall: Rect): void {
  const y = WORLD_LOCAL.yard;
  // the west leg of the L, south of the north wall
  const zone: Rect = { minX: YARD_RECT.minX, maxX: YARD_RECT.maxX, minZ: northWall.maxZ, maxZ: YARD_RECT.maxZ };
  const xs = [...y.nsLanesX].sort((a, b) => a - b);
  const zs = [...y.ewAislesZ].sort((a, b) => a - b);
  // block edges: zone borders (minus margins) and lane / aisle edges
  const colEdges: Array<[number, number]> = [];
  let left = zone.minX + y.edgeMargin;
  for (const lx of xs) {
    colEdges.push([left, lx - y.laneWidth / 2]);
    left = lx + y.laneWidth / 2;
  }
  colEdges.push([left, zone.maxX - y.edgeMargin]);
  const rowEdges: Array<[number, number]> = [];
  let top = zone.minZ + 1.2;
  for (const az of zs) {
    rowEdges.push([top, az - y.aisleWidth / 2]);
    top = az + y.aisleWidth / 2;
  }
  rowEdges.push([top, zone.maxZ - 1.2]);

  // every block gets its own style; the dealer makes sure each style appears
  const blocks: Rect[] = [];
  for (const [minZ, maxZ] of rowEdges) {
    for (const [minX, maxX] of colEdges) {
      // strips narrower than a container (along the warehouse wall) stay open ground
      if (maxX - minX >= W && maxZ - minZ >= W) blocks.push({ minX, maxX, minZ, maxZ });
    }
  }
  const styles: BlockStyle[] = blocks.map((_, i) => (['rows', 'columns', 'dump'] as const)[i % 3] as BlockStyle);
  for (let i = styles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [styles[i], styles[j]] = [styles[j] as BlockStyle, styles[i] as BlockStyle];
  }
  blocks.forEach((rect, i) => {
    const style = styles[i] as BlockStyle;
    const deep = rect.maxZ - rect.minZ;
    if (style === 'dump') fillDump(layout, rng, rect, blocked);
    // short columns need a block deeper than one container
    else if (style === 'columns' && deep >= L + 0.4) fillRows(layout, rng, rect, true, blocked);
    else fillRows(layout, rng, rect, false, blocked);
  });

  // lanes: N-S lanes between the columns, E-W aisles between the block rows
  xs.forEach((lx, i) => {
    const lane = clipLane('z', lx, zone.minZ + 1, zone.maxZ - 1, y.laneWidth, `yard-ns-${i}`);
    if (lane) layout.lanes.push(lane);
  });
  zs.forEach((lz, i) => {
    const lane = clipLane('x', lz, zone.minX + 1, zone.maxX - 1, y.aisleWidth, `yard-ew-${i}`);
    if (lane) layout.lanes.push(lane);
  });
}

function generateClusters(
  layout: ContainerLayout,
  rng: () => number,
  zoneId: 'B' | 'D',
  existing: Rect[],
  blocked: readonly Rect[],
): void {
  const zone = ZONES[zoneId];
  const cfg = WORLD_LOCAL.clusters;
  const target = cfg[zoneId].count;
  let placed = 0;
  for (let attempt = 0; attempt < cfg.attempts && placed < target; attempt++) {
    const alongZ = rng() < 0.5;
    // the quay gets bigger staging blocks than the court
    const cells = 1 + Math.floor(rng() * (zoneId === 'D' ? 4 : 3));
    const rows = 1 + Math.floor(rng() * 2);
    const base = pickHeight(rng, [0.5, 0.35, 0.15]);
    const x = zone.minX + cfg.edgeMargin + rng() * (zone.maxX - zone.minX - 2 * cfg.edgeMargin);
    const z = zone.minZ + cfg.edgeMargin + rng() * (zone.maxZ - zone.minZ - 2 * cfg.edgeMargin);
    const { hx, hz } = cellHalf(alongZ);
    const rowsDef: Array<{ x0: number; z0: number; heights: number[] }> = [];
    let ok = true;
    for (let r = 0; r < rows && ok; r++) {
      const off = r * (W + WORLD_LOCAL.yard.rowGap);
      const x0 = alongZ ? x + off : x;
      const z0 = alongZ ? z : z + off;
      const heights: number[] = [];
      for (let c = 0; c < cells; c++) {
        const cx = alongZ ? x0 : x0 + c * PITCH;
        const cz = alongZ ? z0 + c * PITCH : z0;
        if (!cellFree(cx, cz, hx, hz, blocked)) ok = false;
        heights.push(heightAround(rng, base));
      }
      rowsDef.push({ x0, z0, heights });
    }
    if (!ok) continue;
    const firstRow = rowsDef[0];
    const lastRow = rowsDef[rowsDef.length - 1];
    if (!firstRow || !lastRow) continue;
    const endX = alongZ ? lastRow.x0 : firstRow.x0 + (cells - 1) * PITCH;
    const endZ = alongZ ? firstRow.z0 + (cells - 1) * PITCH : lastRow.z0;
    const bounds: Rect = { minX: firstRow.x0 - hx, maxX: endX + hx, minZ: firstRow.z0 - hz, maxZ: endZ + hz };
    if (bounds.maxX > zone.maxX - cfg.edgeMargin || bounds.maxZ > zone.maxZ - cfg.edgeMargin) continue;
    if (bounds.minZ < zone.minZ + 1 || bounds.maxZ > zone.maxZ - 1) continue;
    if (rectHitsKeepClear((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, (bounds.maxX - bounds.minX) / 2 + 2, (bounds.maxZ - bounds.minZ) / 2 + 2, 0)) continue;
    if (existing.some((e) => rectsOverlap(bounds, e, cfg.margin))) continue;
    existing.push(bounds);
    for (const row of rowsDef) emitRow(layout, rng, zoneId, row.x0, row.z0, alongZ, row.heights);
    placed++;
  }
}

export function generateContainerLayout(params: Partial<LayoutParams> = {}): ContainerLayout {
  const rng = createRng(params.seed ?? WORLD_LOCAL.seed);
  const layout: ContainerLayout = {
    instances: [],
    boxes: [],
    stackTops: [],
    lanes: [],
    zoneCounts: { A: 0, B: 0, D: 0 },
  };
  const blocked = obstacleRects();
  const northWall = generateNorthWall(layout, rng);
  generateYard(layout, rng, blocked, northWall);
  const taken: Rect[] = [];
  const clusterBlocked = [...blocked, ...WORLD_LOCAL.clusters.reserved];
  generateClusters(layout, rng, 'B', taken, clusterBlocked);
  generateClusters(layout, rng, 'D', taken, clusterBlocked);
  return layout;
}

