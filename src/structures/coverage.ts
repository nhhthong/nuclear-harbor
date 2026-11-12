import { CONTROL_CENTER_FOOTPRINT, ZONES, isOnLand } from '@/config/level';
import type { ZoneId } from '@/config/level';
import { PLAYER } from '@/config/tunables';
import { boxBoundsXZ, bottomY } from './boxes';
import type { StructureBox, V3 } from './boxes';
import { COVERAGE } from './tunables';

export interface SamplePoint {
  zone: ZoneId;
  x: number;
  y: number;
  z: number;
}

export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ZoneCoverage {
  zone: ZoneId;
  covered: number;
  total: number;
  uncovered: SamplePoint[];
}

/** XZ footprints of members that touch the ground (they block walking). */
export function groundFootprints(boxes: readonly StructureBox[]): Footprint[] {
  return boxes.filter((b) => bottomY(b) < 1).map((b) => boxBoundsXZ(b));
}

function inside(f: Footprint, x: number, z: number, margin: number): boolean {
  return x > f.minX - margin && x < f.maxX + margin && z > f.minZ - margin && z < f.maxZ + margin;
}

/**
 * Walkable sample points (GDD 7.4): `COVERAGE.gridStep` metre grid over each zone, at eye height,
 * on land, outside the control center and outside `solids`.
 */
export function sampleWalkable(
  solids: readonly Footprint[] = [],
  zones: readonly string[] = COVERAGE.zones,
  step: number = COVERAGE.gridStep,
): SamplePoint[] {
  const samples: SamplePoint[] = [];
  for (const id of zones) {
    const zone = ZONES[id as ZoneId];
    for (let x = zone.minX; x <= zone.maxX + 1e-9; x += step) {
      for (let z = zone.minZ; z <= zone.maxZ + 1e-9; z += step) {
        if (!isOnLand(x, z)) continue;
        if (inside(CONTROL_CENTER_FOOTPRINT, x, z, 0)) continue;
        if (solids.some((f) => inside(f, x, z, COVERAGE.solidMargin))) continue;
        samples.push({ zone: zone.id, x, y: PLAYER.eyeHeight, z });
      }
    }
  }
  return samples;
}

/**
 * Pure coverage rule: a sample is covered when some anchor is within `range` (3D distance) and,
 * when `hasLineOfSight` is given, the straight line from the sample (eye) to the anchor is clear.
 */
export function checkCoverage(
  samples: readonly SamplePoint[],
  anchors: readonly { position: V3 }[],
  range: number,
  hasLineOfSight?: (from: V3, to: V3) => boolean,
): ZoneCoverage[] {
  const rangeSq = range * range;
  const byZone = new Map<ZoneId, ZoneCoverage>();
  for (const s of samples) {
    let entry = byZone.get(s.zone);
    if (!entry) {
      entry = { zone: s.zone, covered: 0, total: 0, uncovered: [] };
      byZone.set(s.zone, entry);
    }
    entry.total++;
    const hit = anchors.some((a) => {
      const dx = a.position.x - s.x;
      const dy = a.position.y - s.y;
      const dz = a.position.z - s.z;
      if (dx * dx + dy * dy + dz * dz > rangeSq) return false;
      return hasLineOfSight ? hasLineOfSight(s, a.position) : true;
    });
    if (hit) entry.covered++;
    else entry.uncovered.push(s);
  }
  return [...byZone.values()];
}
