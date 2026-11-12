import { BOSS_ARENA, TOWERS } from '@/config/level';
import { BOSS } from '@/config/tunables';
import { ANCHOR, PERCH, PLATFORM } from './tunables';
import type { AnchorSpec, StructureBox } from './boxes';

export interface PlacedPerch {
  id: string;
  /** Height of the standing surface (slab top). */
  topY: number;
  boxes: StructureBox[];
  anchors: AnchorSpec[];
}

/** Mast at the slab edge on the side of `inward` (snapped to an axis) plus its perch anchor. */
function mastWithAnchor(opts: {
  id: string;
  owner: string;
  x: number;
  z: number;
  topY: number;
  halfWidth: number;
  inward: { x: number; z: number };
  zone: string;
}): { box: StructureBox; anchor: AnchorSpec } {
  const { id, owner, x, z, topY, halfWidth, inward, zone } = opts;
  const alongX = Math.abs(inward.x) >= Math.abs(inward.z);
  const sx = alongX ? Math.sign(inward.x) || 1 : 0;
  const sz = alongX ? 0 : Math.sign(inward.z) || 1;
  // The mast and the anchor face the approach side (`inward`, towards the arena): the anchor sits
  // 0.05 m outside the mast's outer face and inside the slab edge, so a ray from the ground reaches
  // it without crossing the slab.
  const edge = halfWidth - 2 * PERCH.mastHalf;
  const box: StructureBox = {
    id: `${id}/mast`,
    owner,
    center: { x: x + sx * edge, y: topY + PERCH.mastHalfHeight, z: z + sz * edge },
    half: { x: PERCH.mastHalf, y: PERCH.mastHalfHeight, z: PERCH.mastHalf },
    yaw: 0,
    grappleable: true,
    material: 'frame',
  };
  const anchor: AnchorSpec = {
    id: `${id}/anchor`,
    kind: 'perch',
    position: {
      x: x + sx * (halfWidth - ANCHOR.perchAnchorInset),
      y: topY + ANCHOR.perchAnchorHeight,
      z: z + sz * (halfWidth - ANCHOR.perchAnchorInset),
    },
    landing: { x, y: topY, z },
    zone,
    boxId: box.id,
  };
  return { box, anchor };
}

/** Free-standing perch tower: slab >= 4x4 m on a central column, mast at the arena-facing edge. */
export function perchTower(opts: {
  id: string;
  x: number;
  z: number;
  topY: number;
  inward: { x: number; z: number };
  zone: string;
}): PlacedPerch {
  const { id, x, z, topY, inward, zone } = opts;
  const hw = PERCH.halfWidth;
  const t = PERCH.slabHalfThickness;
  const slab: StructureBox = {
    id: `${id}/slab`,
    owner: id,
    center: { x, y: topY - t, z },
    half: { x: hw, y: t, z: hw },
    yaw: 0,
    grappleable: true,
    material: 'frame',
  };
  const columnH = (topY - 2 * t) / 2;
  const column: StructureBox = {
    id: `${id}/column`,
    owner: id,
    center: { x, y: columnH, z },
    half: { x: PERCH.columnHalf, y: columnH, z: PERCH.columnHalf },
    yaw: 0,
    grappleable: false,
    material: 'accent',
  };
  const { box, anchor } = mastWithAnchor({ id, owner: id, x, z, topY, halfWidth: hw, inward, zone });
  return { id, topY, boxes: [slab, column, box], anchors: [anchor] };
}

/** Boss-arena perches: six towers on a ring outside the arena, heights cycling through BOSS.perchHeights. */
export function bossPerches(): PlacedPerch[] {
  const { center } = BOSS_ARENA;
  return PERCH.ringAnglesDeg.map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = center.x + Math.cos(a) * PERCH.ringRadius;
    const z = center.z + Math.sin(a) * PERCH.ringRadius;
    const topY = BOSS.perchHeights[i % BOSS.perchHeights.length] as number;
    return perchTower({
      id: `perch-${topY}-${i}`,
      x,
      z,
      topY,
      inward: { x: center.x - x, z: center.z - z },
      zone: 'D',
    });
  });
}

/** Tower-3 gantry platform: 8 x 8 m slab, top at `TOWERS[2].position.y`, four legs, two opposite perches. */
export function towerPlatform(): PlacedPerch {
  const tower = TOWERS[2];
  if (!tower) throw new Error('TOWERS[2] missing');
  const { x, y: topY, z } = tower.position;
  const hw = PLATFORM.halfWidth;
  const t = PLATFORM.slabHalfThickness;
  const id = 'tower3-platform';
  const boxes: StructureBox[] = [
    {
      id: `${id}/slab`,
      owner: id,
      center: { x, y: topY - t, z },
      half: { x: hw, y: t, z: hw },
      yaw: 0,
      grappleable: true,
      material: 'frame',
    },
  ];
  const legH = (topY - 2 * t) / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      boxes.push({
        id: `${id}/leg-${sx > 0 ? 'e' : 'w'}${sz > 0 ? 's' : 'n'}`,
        owner: id,
        center: { x: x + sx * PLATFORM.legOffset, y: legH, z: z + sz * PLATFORM.legOffset },
        half: { x: PLATFORM.legHalf, y: legH, z: PLATFORM.legHalf },
        yaw: 0,
        grappleable: false,
        material: 'accent',
      });
    }
  }
  const anchors: AnchorSpec[] = [];
  for (const dir of [1, -1]) {
    const side = dir > 0 ? 'e' : 'w';
    const m = mastWithAnchor({
      id: `${id}-${side}`,
      owner: id,
      x,
      z,
      topY,
      halfWidth: hw,
      inward: { x: dir, z: 0 },
      zone: tower.zone,
    });
    boxes.push(m.box);
    anchors.push(m.anchor);
  }
  return { id, topY, boxes, anchors };
}
