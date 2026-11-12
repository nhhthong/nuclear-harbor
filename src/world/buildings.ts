import { CONTROL_CENTER_FOOTPRINT, WAREHOUSE_FOOTPRINT } from '@/config/level';
import { rectHitsKeepClear } from './containerLayout';
import { WORLD_LOCAL } from './tunables';

/** Pure box lists for the warehouse and control center (GDD 7.1 zones C and D). */

export type BuildingBoxKind = 'wall' | 'roof' | 'shelf' | 'control' | 'controlUpper';

export interface BuildingBox {
  kind: BuildingBoxKind;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

export interface WarehouseLayout {
  boxes: BuildingBox[];
  /** Clear corridor strip inside the warehouse (centre line from west to east). */
  corridor: { minX: number; maxX: number; minZ: number; maxZ: number; length: number; width: number };
  doors: ReadonlyArray<{ side: 'south' | 'north'; x: number; z: number; width: number; height: number }>;
}

function box(kind: BuildingBoxKind, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): BuildingBox {
  return {
    kind,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    halfExtents: { x: (maxX - minX) / 2, y: (maxY - minY) / 2, z: (maxZ - minZ) / 2 },
  };
}

const DOOR_HEIGHT = 5;

export function buildWarehouse(): WarehouseLayout {
  const f = WAREHOUSE_FOOTPRINT;
  const cfg = WORLD_LOCAL.warehouse;
  const t = cfg.wallThickness;
  const boxes: BuildingBox[] = [];
  const dx0 = cfg.doorX - cfg.doorWidth / 2;
  const dx1 = cfg.doorX + cfg.doorWidth / 2;

  // west and east walls (full length)
  boxes.push(box('wall', f.minX, f.minX + t, 0, f.height, f.minZ, f.maxZ));
  boxes.push(box('wall', f.maxX - t, f.maxX, 0, f.height, f.minZ, f.maxZ));
  // north (z = minZ) and south (z = maxZ) walls with a door gap each
  for (const [z0, z1] of [
    [f.minZ, f.minZ + t],
    [f.maxZ - t, f.maxZ],
  ] as const) {
    boxes.push(box('wall', f.minX + t, dx0, 0, f.height, z0, z1));
    boxes.push(box('wall', dx1, f.maxX - t, 0, f.height, z0, z1));
    boxes.push(box('wall', dx0, dx1, DOOR_HEIGHT, f.height, z0, z1)); // lintel
  }
  boxes.push(box('roof', f.minX, f.maxX, f.height, f.height + cfg.roofThickness, f.minZ, f.maxZ));

  // shelving rows with gaps; a central aisle stays open for the door-to-door path
  const s = cfg.shelf;
  for (const rowZ of cfg.shelfRowsZ) {
    for (let x0 = f.minX + t + 1; x0 + s.segmentLength <= f.maxX - t; x0 += s.pitch) {
      const x1 = x0 + s.segmentLength;
      if (x1 > -s.centralAisleHalfWidth && x0 < s.centralAisleHalfWidth) continue;
      const cx = (x0 + x1) / 2;
      if (rectHitsKeepClear(cx, rowZ, s.segmentLength / 2, s.depth / 2, 1)) continue;
      boxes.push(box('shelf', x0, x1, 0, s.height, rowZ - s.depth / 2, rowZ + s.depth / 2));
    }
  }

  const c = cfg.corridor;
  return {
    boxes,
    corridor: {
      minX: c.minX,
      maxX: c.maxX,
      minZ: c.z - c.width / 2,
      maxZ: c.z + c.width / 2,
      length: c.maxX - c.minX,
      width: c.width,
    },
    doors: [
      { side: 'south', x: cfg.doorX, z: f.maxZ, width: cfg.doorWidth, height: DOOR_HEIGHT },
      { side: 'north', x: cfg.doorX, z: f.minZ, width: cfg.doorWidth, height: DOOR_HEIGHT },
    ],
  };
}

export function buildControlCenter(): BuildingBox[] {
  const f = CONTROL_CENTER_FOOTPRINT;
  const inset = WORLD_LOCAL.controlCenter.upperInset;
  return [
    box('control', f.minX, f.maxX, 0, f.height, f.minZ, f.maxZ),
    box('controlUpper', f.minX + inset, f.maxX - inset, f.height, f.height + WORLD_LOCAL.controlCenter.upperHeight, f.minZ + inset, f.maxZ - inset),
  ];
}
