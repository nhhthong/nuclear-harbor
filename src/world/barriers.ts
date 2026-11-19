import { LAND } from '@/config/level';
import { WORLD_LOCAL } from './tunables';

/**
 * Pure list of the walls that close the level: a low concrete kerb along the quay edge plus an invisible
 * wall above it, and invisible walls on the land sides (behind the perimeter wall), so neither a double jump nor a
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
  edges.forEach(([x0, x1, z0, z1], i) => {
    // spec 29: the 7 m perimeter wall (perimeter.ts) replaces the visible kerb on the land sides; only the
    // quay edge keeps its kerb, the other sides keep an invisible wall from the ground up
    if (i === 0) {
      out.push(box('parapet', x0, x1, 0, h, z0, z1));
      out.push(box('blocker', x0, x1, h, top, z0, z1));
    } else {
      out.push(box('blocker', x0, x1, 0, top, z0, z1));
    }
  });
  return out;
}
