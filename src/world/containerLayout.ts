import {
  CONTROL_CENTER_FOOTPRINT,
  KEEP_CLEAR,
  ZONES,
  type ZoneId,
} from '@/config/level';
import { WORLD } from '@/config/tunables';
import { createRng } from './rng';
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
}

interface StackTop {
  /** Top edge centre of the stack. */
  x: number;
  y: number;
  z: number;
  zone: ZoneId;
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

interface Run {
  zone: ZoneId;
  /** Centre of the first cell. */
  x: number;
  z: number;
  cells: number;
  alongZ: boolean;
  height: number;
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

function cellCentre(run: Run, i: number): { x: number; z: number } {
  return run.alongZ ? { x: run.x, z: run.z + i * PITCH } : { x: run.x + i * PITCH, z: run.z };
}

/** Splits a run into sub-runs of consecutive cells that stay out of the keep-clear discs. */
function trimToKeepClear(run: Run): Run[] {
  const { hx, hz } = cellHalf(run.alongZ);
  const out: Run[] = [];
  let current: Run | null = null;
  for (let i = 0; i < run.cells; i++) {
    const c = cellCentre(run, i);
    if (rectHitsKeepClear(c.x, c.z, hx, hz, WORLD_LOCAL.keepClearMargin)) {
      current = null;
      continue;
    }
    if (!current) {
      current = { ...run, x: c.x, z: c.z, cells: 0 };
      out.push(current);
    }
    current.cells++;
  }
  return out;
}

function emitRun(run: Run, layout: ContainerLayout, rng: () => number): void {
  const yaw = run.alongZ ? Math.PI / 2 : 0;
  for (let i = 0; i < run.cells; i++) {
    const c = cellCentre(run, i);
    for (let tier = 1; tier <= run.height; tier++) {
      layout.instances.push({
        x: c.x,
        y: (tier - 0.5) * H,
        z: c.z,
        yaw,
        colorIndex: Math.floor(rng() * WORLD_LOCAL.containerColors.length),
        tier,
        isTop: tier === run.height,
        zone: run.zone,
      });
    }
    layout.stackTops.push({ x: c.x, y: run.height * H, z: c.z, zone: run.zone });
    layout.zoneCounts[run.zone as 'A' | 'B' | 'D'] += run.height;
  }
  // merged boxes: span the whole run, from the first cell edge to the last cell edge
  const first = cellCentre(run, 0);
  const last = cellCentre(run, run.cells - 1);
  const { hx, hz } = cellHalf(run.alongZ);
  const cx = (first.x + last.x) / 2;
  const cz = (first.z + last.z) / 2;
  const halfX = hx + Math.abs(last.x - first.x) / 2;
  const halfZ = hz + Math.abs(last.z - first.z) / 2;
  if (run.height > 1) {
    const lowerH = (run.height - 1) * H;
    layout.boxes.push({
      center: { x: cx, y: lowerH / 2, z: cz },
      halfExtents: { x: halfX, y: lowerH / 2, z: halfZ },
      grappleable: false,
      zone: run.zone,
    });
  }
  layout.boxes.push({
    center: { x: cx, y: (run.height - 0.5) * H, z: cz },
    halfExtents: { x: halfX, y: H / 2, z: halfZ },
    grappleable: true,
    zone: run.zone,
  });
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function runRect(run: Run): Rect {
  const first = cellCentre(run, 0);
  const last = cellCentre(run, run.cells - 1);
  const { hx, hz } = cellHalf(run.alongZ);
  return {
    minX: Math.min(first.x, last.x) - hx,
    maxX: Math.max(first.x, last.x) + hx,
    minZ: Math.min(first.z, last.z) - hz,
    maxZ: Math.max(first.z, last.z) + hz,
  };
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

function generateYard(layout: ContainerLayout, rng: () => number, runs: Run[]): void {
  const y = WORLD_LOCAL.yard;
  const zone = ZONES.A;
  const blockDepth = 2 * W + y.rowGap;
  const totalZ = y.blockRows * blockDepth + (y.blockRows - 1) * y.aisleWidth;
  const zStart = (zone.minZ + zone.maxZ) / 2 - totalZ / 2;

  // segment x origins
  const segX: number[] = [];
  let x = zone.minX + y.edgeMarginX;
  const laneCentresX: number[] = [];
  y.segmentLengths.forEach((n, i) => {
    segX.push(x);
    x += n * PITCH - WORLD_LOCAL.containerGap;
    if (i < y.segmentLengths.length - 1) {
      laneCentresX.push(x + y.laneWidth / 2);
      x += y.laneWidth;
    }
  });

  const aisleCentresZ: number[] = [];
  for (let b = 0; b < y.blockRows; b++) {
    const bz = zStart + b * (blockDepth + y.aisleWidth);
    if (b < y.blockRows - 1) aisleCentresZ.push(bz + blockDepth + y.aisleWidth / 2);
    for (let r = 0; r < 2; r++) {
      const cz = bz + W / 2 + r * (W + y.rowGap);
      y.segmentLengths.forEach((n, s) => {
        const height = pickHeight(rng, y.heightWeights);
        const dropped = rng() < y.dropRunChance;
        if (dropped) return;
        const sx = segX[s] ?? 0;
        const run: Run = { zone: 'A', x: sx + L / 2, z: cz, cells: n, alongZ: false, height };
        for (const piece of trimToKeepClear(run)) {
          runs.push(piece);
          emitRun(piece, layout, rng);
        }
      });
    }
  }

  // lanes: N-S lanes between segments, E-W aisles between block rows
  laneCentresX.forEach((lx, i) => {
    const lane = clipLane('z', lx, zone.minZ + 1, zone.maxZ - 1, y.laneWidth, `yard-ns-${i}`);
    if (lane) layout.lanes.push(lane);
  });
  aisleCentresZ.forEach((lz, i) => {
    const lane = clipLane('x', lz, zone.minX + 1, zone.maxX - 1, y.aisleWidth, `yard-ew-${i}`);
    if (lane) layout.lanes.push(lane);
  });
}

function generateClusters(
  layout: ContainerLayout,
  rng: () => number,
  zoneId: 'B' | 'D',
  existing: Rect[],
  runs: Run[],
): void {
  const zone = ZONES[zoneId];
  const cfg = WORLD_LOCAL.clusters;
  const target = cfg[zoneId].count;
  const cc = CONTROL_CENTER_FOOTPRINT;
  const ccRect: Rect = { minX: cc.minX, maxX: cc.maxX, minZ: cc.minZ, maxZ: cc.maxZ };
  let placed = 0;
  for (let attempt = 0; attempt < cfg.attempts && placed < target; attempt++) {
    const alongZ = rng() < 0.5;
    const cells = 2 + Math.floor(rng() * 2);
    const rows = 1 + Math.floor(rng() * 2);
    const height = pickHeight(rng, [0.55, 0.45]);
    const x = zone.minX + cfg.edgeMargin + rng() * (zone.maxX - zone.minX - 2 * cfg.edgeMargin);
    const z = zone.minZ + cfg.edgeMargin + rng() * (zone.maxZ - zone.minZ - 2 * cfg.edgeMargin);
    const candidate: Run[] = [];
    for (let r = 0; r < rows; r++) {
      const off = r * (W + WORLD_LOCAL.yard.rowGap);
      candidate.push({
        zone: zoneId,
        x: alongZ ? x + off : x,
        z: alongZ ? z : z + off,
        cells: cells,
        alongZ,
        height,
      });
    }
    const rects = candidate.map(runRect);
    const bounds: Rect = {
      minX: Math.min(...rects.map((r) => r.minX)),
      maxX: Math.max(...rects.map((r) => r.maxX)),
      minZ: Math.min(...rects.map((r) => r.minZ)),
      maxZ: Math.max(...rects.map((r) => r.maxZ)),
    };
    if (bounds.maxX > zone.maxX - cfg.edgeMargin || bounds.maxZ > zone.maxZ - cfg.edgeMargin) continue;
    if (candidate.some((run) => trimToKeepClear(run).length !== 1 || trimToKeepClear(run)[0]?.cells !== run.cells)) continue;
    if (rectHitsKeepClear((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2, (bounds.maxX - bounds.minX) / 2 + 3, (bounds.maxZ - bounds.minZ) / 2 + 3, 0)) continue;
    if (existing.some((e) => rectsOverlap(bounds, e, cfg.margin))) continue;
    if (rectsOverlap(bounds, ccRect, cfg.margin + 1)) continue;
    existing.push(bounds);
    for (const run of candidate) {
      runs.push(run);
      emitRun(run, layout, rng);
    }
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
  const runs: Run[] = [];
  generateYard(layout, rng, runs);
  const taken: Rect[] = [];
  generateClusters(layout, rng, 'B', taken, runs);
  generateClusters(layout, rng, 'D', taken, runs);
  return layout;
}

