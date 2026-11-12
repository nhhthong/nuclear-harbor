import { CRANE_SITES } from '@/config/level';
import type { AnchorSpec, StructureBox } from './boxes';
import { placeCrane } from './craneLayout';
import type { PlacedCrane } from './craneLayout';
import { lampParts, lampPosts } from './lampLayout';
import type { LampPost } from './lampLayout';
import { bossPerches, towerPlatform } from './perchLayout';
import type { PlacedPerch } from './perchLayout';

export interface StructureLayout {
  cranes: PlacedCrane[];
  perches: PlacedPerch[];
  platform: PlacedPerch;
  lamps: LampPost[];
  /** Crane boxes excluded: instanced separately per crane (LOD). */
  staticBoxes: StructureBox[];
  allBoxes: StructureBox[];
  anchors: AnchorSpec[];
}

/** Whole level layout of T-04, pure data (no three.js, no physics). */
export function buildLayout(): StructureLayout {
  const cranes = CRANE_SITES.map(placeCrane);
  const perches = bossPerches();
  const platform = towerPlatform();
  const fixedBoxes = [...cranes.flatMap((c) => c.boxes), ...perches.flatMap((p) => p.boxes), ...platform.boxes];
  const fixedAnchors = [...cranes.flatMap((c) => c.anchors), ...perches.flatMap((p) => p.anchors), ...platform.anchors];
  const lamps = lampPosts({ anchors: fixedAnchors, boxes: fixedBoxes });
  const lampBits = lamps.map(lampParts);
  const lampBoxes = lampBits.flatMap((l) => l.boxes);
  const staticBoxes = [...perches.flatMap((p) => p.boxes), ...platform.boxes, ...lampBoxes];
  return {
    cranes,
    perches,
    platform,
    lamps,
    staticBoxes,
    allBoxes: [...fixedBoxes, ...lampBoxes],
    anchors: [...fixedAnchors, ...lampBits.map((l) => l.anchor)],
  };
}
