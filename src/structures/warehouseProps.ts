/**
 * Warehouse interior props (spec 29, stream C): WHERE things stand. Pure data, no three.js, so tests can check
 * every placement against the shared contract (`WAREHOUSE.propZones`, corridor, stairs, openings, supply spot).
 * Meshes, GLB loading and colliders live in `warehousePropMeshes.ts`.
 */
import { WAREHOUSE, type Opening, type Rect } from '@/config/warehouse';
import { createRng } from '@/world/rng';
import { WAREHOUSE_PROPS } from './warehousePropsTunables';

/** Node names of `public/assets/props/warehouse.glb` (one node per kind). */
export const WAREHOUSE_GLB_KINDS = [
  'cardboard_box',
  'wooden_crate',
  'long_crate',
  'plastic_crate',
  'barrel',
  'jerrycan',
  'propane_tank',
  'tool_cart',
  'welding_cart',
  'tool_chest',
  'bench_vice',
  'ladder',
  'office_desk',
  'drawer_cabinet',
  'stool',
  'binder',
  'trash_can',
  'extinguisher',
  'lamp',
  'wet_floor_sign',
  'cement_bag',
  'pallet_jack',
  'ibc_tank',
  'pallet',
  'computer_desk',
] as const;
export type WarehouseGlbKind = (typeof WAREHOUSE_GLB_KINDS)[number];
/** GLB kinds plus the procedural workbench. */
export type WarehousePropKind = WarehouseGlbKind | 'workbench';

/** Size of each kind as built (metres; w along x, d along z with the front facing -Z, origin at the base centre). */
export const WAREHOUSE_PROP_SIZE: Record<WarehousePropKind, { readonly w: number; readonly h: number; readonly d: number }> = {
  cardboard_box: { w: 0.39, h: 0.34, d: 0.52 },
  wooden_crate: { w: 0.82, h: 0.34, d: 0.41 },
  long_crate: { w: 0.53, h: 0.46, d: 1.16 },
  plastic_crate: { w: 0.3, h: 0.26, d: 0.41 },
  barrel: { w: 0.5, h: 0.88, d: 0.49 },
  jerrycan: { w: 0.35, h: 0.46, d: 0.17 },
  propane_tank: { w: 0.34, h: 0.55, d: 0.34 },
  tool_cart: { w: 1.27, h: 0.96, d: 0.76 },
  welding_cart: { w: 0.83, h: 1.56, d: 0.65 },
  tool_chest: { w: 0.69, h: 0.65, d: 0.41 },
  bench_vice: { w: 0.2, h: 0.28, d: 0.4 },
  ladder: { w: 0.66, h: 2.13, d: 0.18 },
  office_desk: { w: 2.0, h: 0.79, d: 0.95 },
  drawer_cabinet: { w: 1.13, h: 1.88, d: 0.49 },
  stool: { w: 0.35, h: 0.88, d: 0.36 },
  binder: { w: 0.17, h: 0.03, d: 0.2 },
  trash_can: { w: 0.78, h: 0.91, d: 0.56 },
  extinguisher: { w: 0.28, h: 0.66, d: 0.37 },
  lamp: { w: 0.56, h: 1.35, d: 0.58 },
  wet_floor_sign: { w: 0.3, h: 0.63, d: 0.36 },
  cement_bag: { w: 0.46, h: 0.18, d: 0.7 },
  pallet_jack: { w: 0.57, h: 1.25, d: 1.59 },
  ibc_tank: { w: 1.32, h: 1.16, d: 1.08 },
  pallet: { w: 1.2, h: 0.15, d: 1.2 },
  computer_desk: { w: 1.5, h: 1.05, d: 1.26 },
  workbench: { w: WAREHOUSE_PROPS.workbench.w, h: WAREHOUSE_PROPS.workbench.h, d: WAREHOUSE_PROPS.workbench.d },
};

export type PropZoneId = keyof typeof WAREHOUSE.propZones | 'ceiling';

export interface PlacedProp {
  readonly kind: WarehousePropKind;
  readonly x: number;
  /** Base of the item (world). */
  readonly y: number;
  readonly z: number;
  /** Rotation about +Y (0 = front faces -Z / north). */
  readonly yaw: number;
  /** Lean about the item's own X axis (ladder against a wall). */
  readonly tilt?: number;
  readonly zone: PropZoneId;
  /** Sits on another item (stack, bench top, rack beam): left out of the floor overlap checks. */
  readonly stacked?: boolean;
}

/** Shrink-wrapped pallet load: a translucent white block (instanced unit box). */
export interface WrapBlock {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
}

export interface PropCollider {
  readonly id: string;
  readonly center: { readonly x: number; readonly y: number; readonly z: number };
  readonly half: { readonly x: number; readonly y: number; readonly z: number };
}

/** One rack row (single or back-to-back double), footprint of the steel. */
export interface RackRow extends Rect {
  readonly id: string;
  readonly sides: 1 | 2;
}

export interface WarehousePropLayout {
  readonly props: readonly PlacedProp[];
  readonly wraps: readonly WrapBlock[];
  readonly racks: readonly RackRow[];
  readonly colliders: readonly PropCollider[];
}

const Q = Math.PI / 2;
const Z = WAREHOUSE.propZones;
const R = WAREHOUSE_PROPS.racks;

/** Axis-aligned footprint of a placed item (rotation and lean included). */
export function propFootprint(p: Pick<PlacedProp, 'kind' | 'x' | 'z' | 'yaw' | 'tilt'>): Rect {
  const s = WAREHOUSE_PROP_SIZE[p.kind];
  const d = s.d + (p.tilt ? Math.abs(Math.sin(p.tilt)) * s.h * 2 : 0);
  const c = Math.abs(Math.cos(p.yaw));
  const n = Math.abs(Math.sin(p.yaw));
  const hx = (c * s.w + n * d) / 2;
  const hz = (n * s.w + c * d) / 2;
  return { minX: p.x - hx, maxX: p.x + hx, minZ: p.z - hz, maxZ: p.z + hz };
}

export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minZ < b.maxZ + margin && a.maxZ > b.minZ - margin;
}

export function rectInside(inner: Rect, outer: Rect, eps = 1e-6): boolean {
  return inner.minX >= outer.minX - eps && inner.maxX <= outer.maxX + eps && inner.minZ >= outer.minZ - eps && inner.maxZ <= outer.maxZ + eps;
}

/** 3D distance between an item's box and an opening (a vertical rectangle in its wall). */
export function distanceToOpening(r: Rect, y0: number, y1: number, o: Opening): number {
  const alongX = Math.abs(o.nz) > 0.5; // opening in a north/south wall spans x
  const ox0 = alongX ? o.x - o.width / 2 : o.x;
  const ox1 = alongX ? o.x + o.width / 2 : o.x;
  const oz0 = alongX ? o.z : o.z - o.width / 2;
  const oz1 = alongX ? o.z : o.z + o.width / 2;
  const gap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, b0 - a1, a0 - b1);
  const dx = gap(r.minX, r.maxX, ox0, ox1);
  const dz = gap(r.minZ, r.maxZ, oz0, oz1);
  const dy = gap(y0, y1, o.y - o.height / 2, o.y + o.height / 2);
  return Math.hypot(dx, dy, dz);
}

/** The stair footprint as a rect. */
export const STAIR_RECT: Rect = { minX: WAREHOUSE.stairs.minX, maxX: WAREHOUSE.stairs.maxX, minZ: WAREHOUSE.stairs.minZ, maxZ: WAREHOUSE.stairs.maxZ };

/** Rack rows from the tunables, inside `propZones.racks`. */
export function rackRows(): RackRow[] {
  const length = R.bays * R.bayLength;
  const minZ = Z.racks.minZ + R.startZ;
  return R.rows.map((row, i) => {
    const minX = Z.racks.minX + row.x;
    const depth = row.sides === 2 ? R.depth * 2 + R.flue : R.depth;
    return { id: `rack-${i}`, sides: row.sides, minX, maxX: minX + depth, minZ, maxZ: minZ + length };
  });
}

/** Centre x of each single rack (one per side) of a row. */
export function rackSides(row: RackRow): number[] {
  return row.sides === 2 ? [row.minX + R.depth / 2, row.maxX - R.depth / 2] : [row.minX + R.depth / 2];
}

/** Clear width between neighbouring rows (forklift aisles). */
export function rackAisles(rows: readonly RackRow[] = rackRows()): number[] {
  const sorted = [...rows].sort((a, b) => a.minX - b.minX);
  return sorted.slice(1).map((r, i) => r.minX - sorted[i]!.maxX);
}

class Builder {
  readonly props: PlacedProp[] = [];
  readonly wraps: WrapBlock[] = [];
  readonly colliders: PropCollider[] = [];

  constructor(readonly rng: () => number) {}

  jitter(amount: number): number {
    return (this.rng() - 0.5) * 2 * amount;
  }

  put(kind: WarehousePropKind, x: number, z: number, yaw: number, zone: PropZoneId, extra: Partial<PlacedProp> = {}): PlacedProp {
    const y = extra.y ?? (zone === 'office' ? WAREHOUSE.mezzanine.floorY : 0);
    const p: PlacedProp = { kind, x, z, yaw, zone, ...extra, y };
    this.props.push(p);
    return p;
  }

  /** Axis-aligned collider around a footprint from `y0` to `y1`. */
  solid(id: string, r: Rect, y0: number, y1: number): void {
    this.colliders.push({
      id,
      center: { x: (r.minX + r.maxX) / 2, y: (y0 + y1) / 2, z: (r.minZ + r.maxZ) / 2 },
      half: { x: (r.maxX - r.minX) / 2, y: (y1 - y0) / 2, z: (r.maxZ - r.minZ) / 2 },
    });
  }

  /** `n` items of one kind stacked straight up; optional collider around the stack. */
  stack(kind: WarehousePropKind, x: number, z: number, yaw: number, n: number, zone: PropZoneId, collide: boolean, y0?: number): number {
    const h = WAREHOUSE_PROP_SIZE[kind].h;
    const base = y0 ?? (zone === 'office' ? WAREHOUSE.mezzanine.floorY : 0);
    for (let i = 0; i < n; i++) this.put(kind, x, z, yaw + (i > 0 ? this.jitter(0.04) : 0), zone, { y: base + i * h, stacked: i > 0 });
    if (collide) this.solid(`${kind}@${x.toFixed(1)},${z.toFixed(1)}`, propFootprint({ kind, x, z, yaw }), base, base + n * h);
    return base + n * h;
  }

  /**
   * One pallet with a load on top, centred at (x, z) with its base at y. Returns the top of the load.
   * `maxLoad` caps the load height above the pallet.
   */
  palletLoad(x: number, y: number, z: number, zone: PropZoneId, load: 'wrap' | 'boxes' | 'crates' | 'long' | 'empty' | 'bags', maxLoad: number, stacked: boolean): number {
    this.put('pallet', x, z, 0, zone, { y, stacked });
    const top = y + WAREHOUSE_PROP_SIZE.pallet.h;
    if (load === 'empty') return top;
    if (load === 'wrap') {
      const [lo, hi] = R.wrapHeight;
      const h = Math.min(maxLoad, lo + this.rng() * (hi - lo));
      this.wraps.push({ x, y: top, z, w: 1.12, h, d: 1.12 });
      return top + h;
    }
    const kind: WarehouseGlbKind = load === 'boxes' ? 'cardboard_box' : load === 'crates' ? 'wooden_crate' : load === 'long' ? 'long_crate' : 'cement_bag';
    const s = WAREHOUSE_PROP_SIZE[kind];
    const nx = Math.max(1, Math.floor(1.2 / s.w));
    const nz = Math.max(1, Math.floor(1.2 / s.d));
    const layers = Math.max(1, Math.min(load === 'bags' ? 4 : 2, Math.floor(maxLoad / s.h)));
    for (let l = 0; l < layers; l++) {
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          // the top layer of boxes is sometimes incomplete
          if (l === layers - 1 && layers > 1 && load === 'boxes' && this.rng() < 0.25) continue;
          const px = x + (i - (nx - 1) / 2) * s.w;
          const pz = z + (j - (nz - 1) / 2) * s.d;
          this.put(kind, px, pz, this.jitter(0.03), zone, { y: top + l * s.h, stacked: true });
        }
      }
    }
    return top + layers * s.h;
  }
}

function buildRacks(b: Builder, rows: readonly RackRow[]): void {
  const levels = [0, ...R.beamLevels];
  const slotSpan = R.bayLength / R.slotsPerBay;
  for (const row of rows) {
    for (const sx of rackSides(row)) {
      for (let bay = 0; bay < R.bays; bay++) {
        for (let li = 0; li < levels.length; li++) {
          const y = levels[li]!;
          const next = li + 1 < levels.length ? levels[li + 1]! - R.beamHeight : R.uprightHeight;
          const maxLoad = next - y - WAREHOUSE_PROP_SIZE.pallet.h - 0.08;
          for (let s = 0; s < R.slotsPerBay; s++) {
            const z = row.minZ + bay * R.bayLength + (s + 0.5) * slotSpan;
            const r = b.rng();
            let load: 'wrap' | 'boxes' | 'crates' | 'long' | 'empty' | null = 'wrap';
            if (r < R.emptyChance) load = b.rng() < 0.4 ? 'empty' : null; // null: no pallet at all
            else if (r < R.emptyChance + R.boxesChance) load = 'boxes';
            else if (r < R.emptyChance + R.boxesChance + R.cratesChance) load = 'crates';
            else if (r < R.emptyChance + R.boxesChance + R.cratesChance + R.longCratesChance) load = 'long';
            if (load) b.palletLoad(sx, y, z, 'racks', load, maxLoad, true);
          }
        }
      }
      // one long collider per side, steel and loads included
      b.solid(`${row.id}@${sx.toFixed(2)}`, { minX: sx - 0.6, maxX: sx + 0.6, minZ: row.minZ - 0.05, maxZ: row.maxZ + 0.05 }, 0, R.uprightHeight);
    }
  }
}

function buildRackZoneFloor(b: Builder, rows: readonly RackRow[]): void {
  const [a, m, c] = rows;
  const southEnd = (row: RackRow): number => row.maxZ + 0.8;
  if (a) {
    const [s0, s1] = rackSides(a);
    b.stack('pallet', s0!, southEnd(a), 0, 6, 'racks', true);
    if (s1 !== undefined) b.stack('pallet', s1, southEnd(a), 0.05, 3, 'racks', true);
  }
  if (m) {
    const [s0] = rackSides(m);
    b.stack('pallet', s0!, southEnd(m), -0.04, 4, 'racks', true);
    const bx = m.maxX - 0.3;
    const bz = southEnd(m);
    for (const [dx, dz] of [
      [0, -0.3],
      [0, 0.25],
      [-0.52, -0.05],
      [-0.5, 0.48],
    ] as const) {
      const p = b.put('barrel', bx + dx, bz + dz, b.jitter(0.6), 'racks');
      b.solid(`barrel@${p.x.toFixed(1)},${p.z.toFixed(1)}`, propFootprint(p), 0, WAREHOUSE_PROP_SIZE.barrel.h);
    }
  }
  if (c) {
    const cx = (c.minX + c.maxX) / 2;
    b.stack('ibc_tank', cx, c.maxZ + 0.75, 0, 2, 'racks', true);
    b.stack('ibc_tank', cx, c.maxZ + 1.95, 0, 1, 'racks', true);
    // drums at the north end of the single row
    for (const [dx, dz] of [
      [-0.2, -1.0],
      [0.35, -1.25],
      [-0.25, -1.55],
    ] as const) {
      const p = b.put('barrel', cx + dx, c.minZ + dz, b.jitter(0.6), 'racks');
      b.solid(`barrel@${p.x.toFixed(1)},${p.z.toFixed(1)}`, propFootprint(p), 0, WAREHOUSE_PROP_SIZE.barrel.h);
    }
  }
  if (a && m) {
    // pallet jack parked in the south cross aisle, between the first two rows
    b.put('pallet_jack', (a.maxX + m.minX) / 2, Math.min(Z.racks.maxZ - 0.9, a.maxZ + 2.6), Q + b.jitter(0.12), 'racks');
  }
}

function buildWorkshop(b: Builder): void {
  const w = Z.workshop;
  const bench = WAREHOUSE_PROPS.workbench;
  const bx = w.minX + bench.d / 2;
  const bz = w.minZ + 3.4;
  const yaw = -Q; // front faces east, pegboard against the west wall
  b.put('workbench', bx, bz, yaw, 'workshop');
  b.solid('workbench', propFootprint({ kind: 'workbench', x: bx, z: bz, yaw }), 0, bench.h);
  b.put('bench_vice', bx + 0.18, bz - 0.75, yaw, 'workshop', { y: bench.h, stacked: true });
  b.put('tool_chest', bx + 0.05, bz + 0.55, yaw + b.jitter(0.08), 'workshop', { y: bench.h, stacked: true });
  // jerrycans by the bench
  for (let i = 0; i < 3; i++) b.put('jerrycan', w.minX + 0.2, bz + 1.5 + i * 0.4, -Q + b.jitter(0.2), 'workshop');
  // carts along the south edge, backs to the wall
  const cart = b.put('tool_cart', w.minX + 2.2, w.maxZ - WAREHOUSE_PROP_SIZE.tool_cart.d / 2, 0, 'workshop');
  b.solid('tool_cart', propFootprint(cart), 0, WAREHOUSE_PROP_SIZE.tool_cart.h);
  const weld = b.put('welding_cart', w.minX + 3.9, w.maxZ - WAREHOUSE_PROP_SIZE.welding_cart.d / 2 - 0.05, b.jitter(0.15), 'workshop');
  b.solid('welding_cart', propFootprint(weld), 0, WAREHOUSE_PROP_SIZE.welding_cart.h);
  // ladder leaning on the south wall
  const tilt = 0.14;
  const lean = Math.sin(tilt) * WAREHOUSE_PROP_SIZE.ladder.h;
  b.put('ladder', w.minX + 5.4, w.maxZ - WAREHOUSE_PROP_SIZE.ladder.d / 2 - lean, 0, 'workshop', { tilt });
  // propane tanks in the south-east corner
  for (const [dx, dz] of [
    [-0.25, -0.25],
    [-0.65, -0.3],
    [-0.3, -0.68],
  ] as const) {
    b.put('propane_tank', w.maxX + dx, w.maxZ + dz - 0.95, b.jitter(Math.PI), 'workshop');
  }
}

function buildFloorStacks(b: Builder): void {
  const f = Z.floorStacks;
  const minX = f.minX + 0.55; // keep clear of the roller door
  // long crates, two high, along x
  b.stack('long_crate', minX + WAREHOUSE_PROP_SIZE.long_crate.d / 2, f.minZ + 0.95, Q, 2, 'floorStacks', true);
  // small crates, three high
  b.stack('wooden_crate', f.maxX - 0.5, f.minZ + 1.75, 0, 3, 'floorStacks', true);
  // pallet of boxes against the north edge of the zone
  const px = f.maxX - 0.65;
  const pz = f.maxZ - 0.65;
  const top = b.palletLoad(px, 0, pz, 'floorStacks', 'boxes', 0.7, false);
  b.solid('boxes-pallet', propFootprint({ kind: 'pallet', x: px, z: pz, yaw: 0 }), 0, top);
  // a couple of loose cartons
  b.put('cardboard_box', minX + 0.3, f.maxZ - 0.6, 0.3 + b.jitter(0.2), 'floorStacks');
  b.put('cardboard_box', minX + 0.3, f.maxZ - 0.6, 0.1 + b.jitter(0.2), 'floorStacks', { y: WAREHOUSE_PROP_SIZE.cardboard_box.h, stacked: true });
}

function buildUnderMezzanine(b: Builder): void {
  const u = Z.underMezzanine;
  const back = u.minZ; // north wall side
  // two IBC tanks
  const ibcZ = back + WAREHOUSE_PROP_SIZE.ibc_tank.d / 2;
  b.stack('ibc_tank', u.minX + 3.2, ibcZ, 0, 1, 'underMezzanine', true);
  b.stack('ibc_tank', u.minX + 4.6, ibcZ, 0, 1, 'underMezzanine', true);
  // plastic crate stacks
  for (let i = 0; i < 5; i++) {
    const n = 2 + Math.floor(b.rng() * 4);
    b.stack('plastic_crate', u.minX + 5.8 + (i % 3) * 0.34, back + 0.25 + Math.floor(i / 3) * 0.45, b.jitter(0.08), n, 'underMezzanine', false);
  }
  // cement bags on a pallet
  const cx = u.minX + 8.4;
  const cz = back + 0.7;
  const top = b.palletLoad(cx, 0, cz, 'underMezzanine', 'bags', 0.75, false);
  b.solid('cement-pallet', propFootprint({ kind: 'pallet', x: cx, z: cz, yaw: 0 }), 0, top);
  // drums
  for (const [dx, dz] of [
    [0, 0.3],
    [0.52, 0.3],
    [1.04, 0.32],
    [0.25, 0.78],
    [0.8, 0.8],
  ] as const) {
    const p = b.put('barrel', u.minX + 10.5 + dx, back + dz, b.jitter(0.6), 'underMezzanine');
    b.solid(`barrel@${p.x.toFixed(1)},${p.z.toFixed(1)}`, propFootprint(p), 0, WAREHOUSE_PROP_SIZE.barrel.h);
  }
  // empty pallets in the north-east corner, crates in front
  b.stack('pallet', u.maxX - 0.65, back + 0.65, 0, 7, 'underMezzanine', true);
  b.stack('long_crate', u.maxX - 0.4, back + 2.4, 0, 2, 'underMezzanine', true);
  // wet floor sign out in the open
  b.put('wet_floor_sign', u.minX + 7.2, u.maxZ - 0.6, 0.4 + b.jitter(0.3), 'underMezzanine');
}

function buildOffice(b: Builder): void {
  const o = Z.office;
  const y = WAREHOUSE.mezzanine.floorY;
  // the office door is not in the contract: keep a 1.5 m band along the west and south edges free
  const minX = o.minX + 1.5;
  const maxZ = o.maxZ - 1.3;
  const desk = b.put('office_desk', minX + 2.2, maxZ - 1.9, Math.PI, 'office');
  b.solid('office_desk', propFootprint(desk), y, y + WAREHOUSE_PROP_SIZE.office_desk.h);
  b.put('stool', desk.x + 0.1, desk.z + 0.85, b.jitter(0.5), 'office');
  b.put('binder', desk.x - 0.45, desk.z - 0.1, 0.2 + b.jitter(0.2), 'office', { y: y + WAREHOUSE_PROP_SIZE.office_desk.h, stacked: true });
  b.put('binder', desk.x - 0.43, desk.z - 0.1, 0.1 + b.jitter(0.2), 'office', { y: y + WAREHOUSE_PROP_SIZE.office_desk.h + 0.03, stacked: true });
  b.put('binder', desk.x + 0.6, desk.z - 0.2, -0.4 + b.jitter(0.2), 'office', { y: y + WAREHOUSE_PROP_SIZE.office_desk.h, stacked: true });
  const pc = b.put('computer_desk', o.maxX - WAREHOUSE_PROP_SIZE.computer_desk.d / 2, maxZ - 1.0, Q, 'office');
  b.solid('computer_desk', propFootprint(pc), y, y + WAREHOUSE_PROP_SIZE.computer_desk.h);
  const cab = WAREHOUSE_PROP_SIZE.drawer_cabinet;
  const c1 = b.put('drawer_cabinet', o.maxX - cab.w / 2, o.minZ + cab.d / 2, Math.PI, 'office');
  b.solid('cabinet-n', propFootprint(c1), y, y + cab.h);
  const c2 = b.put('drawer_cabinet', o.maxX - cab.d / 2, o.minZ + cab.d + 0.2 + cab.w / 2, Q, 'office');
  b.solid('cabinet-e', propFootprint(c2), y, y + cab.h);
  b.put('trash_can', minX + 0.5, maxZ - 0.35, b.jitter(0.4), 'office');
  b.put('extinguisher', o.maxX - 0.2, maxZ - 0.25, Q, 'office');
}

function buildLamps(b: Builder): void {
  const L = WAREHOUSE_PROPS.lamps;
  for (const row of L.rows) for (const z of row.z) b.put('lamp', row.x, z, 0, 'ceiling', { y: L.y });
}

/** Every interior prop, deterministic for a seed. */
export function layoutWarehouseProps(seed: number = WAREHOUSE_PROPS.seed): WarehousePropLayout {
  const b = new Builder(createRng(seed));
  const racks = rackRows();
  buildRacks(b, racks);
  buildRackZoneFloor(b, racks);
  buildWorkshop(b);
  buildFloorStacks(b);
  buildUnderMezzanine(b);
  buildOffice(b);
  buildLamps(b);
  return { props: b.props, wraps: b.wraps, racks, colliders: b.colliders };
}

/** Bounds of the hanging lamps (inside the walls, under the eaves). */
export function ceilingRect(): Rect {
  const f = WAREHOUSE.footprint;
  const t = WAREHOUSE.wallThickness + 0.5;
  return { minX: f.minX + t, maxX: f.maxX - t, minZ: f.minZ + t, maxZ: f.maxZ - t };
}
