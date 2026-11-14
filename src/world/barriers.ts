import { LAND } from '@/config/level';
import { WORLD_LOCAL } from './tunables';

/**
 * Pure list of the walls that close the level: a low concrete kerb all around the quay (the visible
 * chain-link fence stands on it) plus an invisible wall above it, so neither a double jump nor a
 * container stack leads out of the map or into the sea. `blocker` boxes are colliders only.
 */

export type BarrierKind = 'parapet' | 'blocker';

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
  const edges: Array<[number, number, number, number]> = [
    [minX, maxX, minZ, minZ + t], // north (quay edge)
    [minX, maxX, maxZ - t, maxZ], // south
    [minX, minX + t, minZ + t, maxZ - t], // west
    [maxX - t, maxX, minZ + t, maxZ - t], // east
  ];
  for (const [x0, x1, z0, z1] of edges) {
    out.push(box('parapet', x0, x1, 0, h, z0, z1));
    out.push(box('blocker', x0, x1, h, top, z0, z1));
  }
  return out;
}
