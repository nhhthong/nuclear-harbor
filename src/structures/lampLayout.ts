import { CONTROL_CENTER_FOOTPRINT, LAND, ZONES, isKeepClear, zoneAt } from '@/config/level';
import type { ZoneId } from '@/config/level';
import { GRAPPLE } from '@/config/tunables';
import { checkCoverage, groundFootprints, sampleWalkable } from './coverage';
import type { SamplePoint } from './coverage';
import type { AnchorSpec, StructureBox, V3 } from './boxes';
import { ANCHOR, LAMP } from './tunables';

export interface LampPost {
  x: number;
  z: number;
  height: number;
}

function validLamp(x: number, z: number, avoid: readonly V3[]): boolean {
  const m = LAMP.landMargin;
  if (x < LAND.minX + m || x > LAND.maxX - m || z < LAND.minZ + m || z > LAND.maxZ - m) return false;
  const zone = zoneAt(x, z);
  if (zone !== 'B' && zone !== 'D') return false;
  if (isKeepClear(x, z, LAMP.keepClearMargin)) return false;
  const c = CONTROL_CENTER_FOOTPRINT;
  const b = LAMP.buildingMargin;
  if (x > c.minX - b && x < c.maxX + b + LAMP.armLength && z > c.minZ - b && z < c.maxZ + b) return false;
  return !avoid.some((p) => Math.hypot(p.x - x, p.z - z) < LAMP.perchMargin);
}

/** World boxes (post + arm) and the anchor of one lamp post. */
export function lampParts(lamp: LampPost, index: number): { boxes: StructureBox[]; anchor: AnchorSpec } {
  const id = `lamp-${index}`;
  const h = lamp.height;
  const arm = LAMP.armLength;
  const post: StructureBox = {
    id: `${id}/post`,
    owner: id,
    center: { x: lamp.x, y: h / 2, z: lamp.z },
    half: { x: LAMP.postHalf, y: h / 2, z: LAMP.postHalf },
    yaw: 0,
    grappleable: false,
    material: 'accent',
  };
  const armBox: StructureBox = {
    id: `${id}/arm`,
    owner: id,
    center: { x: lamp.x + arm / 2, y: h - LAMP.armHalf, z: lamp.z },
    half: { x: arm / 2, y: LAMP.armHalf, z: LAMP.armHalf },
    yaw: 0,
    grappleable: true,
    material: 'accent',
  };
  const anchor: AnchorSpec = {
    id: `${id}/anchor`,
    kind: 'lamp-post',
    position: { x: lamp.x + arm - 0.2, y: h - 2 * LAMP.armHalf - ANCHOR.surfaceOffset, z: lamp.z },
    zone: zoneAt(lamp.x, lamp.z) ?? 'B',
    boxId: armBox.id,
  };
  return { boxes: [post, armBox], anchor };
}

/**
 * Lamp posts on a regular pattern in zones B and D (cell centres, spacing ~`LAMP.spacing`), then a
 * greedy fill: while a walkable sample is uncovered, add a lamp at the nearest valid candidate.
 * `fixed` are the anchors (and blocking footprints) that exist without lamps.
 */
export function lampPosts(fixed: { anchors: readonly AnchorSpec[]; boxes: readonly StructureBox[] }): LampPost[] {
  const avoid: V3[] = fixed.boxes.filter((b) => b.id.includes('perch-')).map((b) => b.center);
  const lamps: LampPost[] = [];
  const add = (x: number, z: number): void => {
    lamps.push({ x, z, height: LAMP.heights[lamps.length % LAMP.heights.length] as number });
  };

  for (const id of ['B', 'D'] as ZoneId[]) {
    const zone = ZONES[id];
    const w = zone.maxX - zone.minX;
    const d = zone.maxZ - zone.minZ;
    const nx = Math.ceil(w / LAMP.spacing);
    const nz = Math.ceil(d / LAMP.spacing);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = zone.minX + ((i + 0.5) * w) / nx;
        const z = zone.minZ + ((j + 0.5) * d) / nz;
        if (validLamp(x, z, avoid)) add(x, z);
      }
    }
  }

  const candidates: { x: number; z: number }[] = [];
  for (const id of ['B', 'D'] as ZoneId[]) {
    const zone = ZONES[id];
    for (let x = zone.minX; x <= zone.maxX; x += LAMP.candidateStep) {
      for (let z = zone.minZ; z <= zone.maxZ; z += LAMP.candidateStep) {
        if (validLamp(x, z, avoid)) candidates.push({ x, z });
      }
    }
  }

  const solids = groundFootprints(fixed.boxes);
  const samplesFor = (): SamplePoint[] => sampleWalkable(solids);
  const samples = samplesFor();
  for (let guard = 0; guard < 200; guard++) {
    const anchors = [...fixed.anchors, ...lamps.map((l, i) => lampParts(l, i).anchor)];
    const uncovered = checkCoverage(samples, anchors, GRAPPLE.maxRange).flatMap((z) => z.uncovered);
    const first = uncovered[0];
    if (!first) break;
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (const c of candidates) {
      const dist = Math.hypot(c.x - first.x, c.z - first.z);
      if (dist < bestD) {
        bestD = dist;
        best = c;
      }
    }
    if (!best) break;
    add(best.x, best.z);
  }
  return lamps;
}
