import { WAREHOUSE, type Opening, type Rect } from '@/config/warehouse';
import type { V3 } from './steering';

/**
 * Pure warehouse geometry for the drone (spec 29): which side of the walls a point is on, which openings a drone
 * may use and the three waypoints through one (approach point outside, centre, inside point).
 */

export function insideRect(r: Rect, x: number, z: number, margin = 0): boolean {
  return x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin;
}

/** Inside the warehouse: within the footprint and below the ridge (a drone above the roof is outside). */
export function insideWarehouse(p: V3): boolean {
  return insideRect(WAREHOUSE.footprint, p.x, p.z) && p.y < WAREHOUSE.ridgeHeight;
}

export interface OpeningPoints {
  approach: V3;
  centre: V3;
  inside: V3;
}

export function openingPoints(o: Opening, cfg: { approach: number; inside: number }): OpeningPoints {
  return {
    approach: { x: o.x + o.nx * cfg.approach, y: o.y, z: o.z + o.nz * cfg.approach },
    centre: { x: o.x, y: o.y, z: o.z },
    inside: { x: o.x - o.nx * cfg.inside, y: o.y, z: o.z - o.nz * cfg.inside },
  };
}

/**
 * Openings a drone may fly through: `flyable`, and the inside point is not in the glazed office (the window over
 * the office would trap the drone in it).
 */
export function usableOpenings(cfg: { approach: number; inside: number }, openings: readonly Opening[] = WAREHOUSE.openings): Opening[] {
  return openings.filter((o) => {
    if (!o.flyable) return false;
    const p = openingPoints(o, cfg).inside;
    return !insideRect(WAREHOUSE.office, p.x, p.z);
  });
}

const dist = (a: V3, b: V3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * The opening of the shortest route from `from` to `to` across the wall: drone to the first point of the opening
 * plus the last point of the opening to the target. `fromInside` says which side the drone is on.
 */
export function chooseOpening(
  from: V3,
  to: V3,
  fromInside: boolean,
  cfg: { approach: number; inside: number },
  openings: readonly Opening[] = usableOpenings(cfg),
): Opening | null {
  let best: Opening | null = null;
  let bestD = Infinity;
  for (const o of openings) {
    const p = openingPoints(o, cfg);
    const d = fromInside ? dist(from, p.inside) + dist(p.approach, to) : dist(from, p.approach) + dist(p.inside, to);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

/** Waypoints through `o` in flight order: outside -> approach, centre, inside; inside -> the reverse. */
export function openingRoute(o: Opening, fromInside: boolean, cfg: { approach: number; inside: number }): V3[] {
  const p = openingPoints(o, cfg);
  return fromInside ? [p.inside, p.centre, p.approach] : [p.approach, p.centre, p.inside];
}
