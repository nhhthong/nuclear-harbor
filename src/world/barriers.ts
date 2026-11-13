import { LAND, WAREHOUSE_FOOTPRINT, ZONES } from '@/config/level';
import { WORLD_LOCAL } from './tunables';

/**
 * Pure list of the walls that close the level (owner request: "block some points"):
 *  - `perimeter`: a low parapet all around the land plus an invisible wall above it, so neither a
 *    double jump nor a container stack leads out of the map or into the sea;
 *  - `blast`: tall concrete walls that seal the passages beside the warehouse (the only way out of
 *    the spawn forecourt is through the warehouse and past tower 1) and split the yard / crane zone
 *    from the dock so the dock is entered through two gates.
 * Visible boxes are rendered; `blocker` boxes are colliders only.
 */

export type BarrierKind = 'parapet' | 'blast' | 'blocker';

export interface BarrierBox {
  kind: BarrierKind;
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}

function box(kind: BarrierKind, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): BarrierBox {
  return {
    kind,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    halfExtents: { x: (maxX - minX) / 2, y: (maxY - minY) / 2, z: (maxZ - minZ) / 2 },
  };
}

export function buildBarriers(): BarrierBox[] {
  const b = WORLD_LOCAL.barriers;
  const out: BarrierBox[] = [];
  const { minX, maxX, minZ, maxZ } = LAND;
  const t = b.parapetThickness;
  const h = b.parapetHeight;
  const top = b.blockerHeight;

  // perimeter: visible parapet + invisible wall on each land edge
  const edges: Array<[number, number, number, number]> = [
    [minX, maxX, minZ, minZ + t], // north (dock edge)
    [minX, maxX, maxZ - t, maxZ], // south
    [minX, minX + t, minZ + t, maxZ - t], // west
    [maxX - t, maxX, minZ + t, maxZ - t], // east
  ];
  for (const [x0, x1, z0, z1] of edges) {
    out.push(box('parapet', x0, x1, 0, h, z0, z1));
    out.push(box('blocker', x0, x1, h, top, z0, z1));
  }

  // blast walls beside the warehouse: seal the forecourt (z = south wall line)
  const w = WAREHOUSE_FOOTPRINT;
  const bt = b.blastThickness;
  const bh = b.blastHeight;
  const blast = (x0: number, x1: number, z0: number, z1: number): void => {
    out.push(box('blast', x0, x1, 0, bh, z0, z1));
    out.push(box('blocker', x0, x1, bh, top, z0, z1));
  };
  blast(minX + t, w.minX, w.maxZ - bt, w.maxZ);
  blast(w.maxX, maxX - t, w.maxZ - bt, w.maxZ);

  // yard / crane zone <-> dock: wall on the zone border with two gates
  const z = ZONES.D.maxZ;
  for (const [x0, x1] of b.dockWallSpans) blast(x0, x1, z - bt / 2, z + bt / 2);
  return out;
}
