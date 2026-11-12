import type { GrappleAnchorKind } from '@/core/types';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export type MaterialRole = 'frame' | 'accent';

/** One structural member: becomes one static collider and one instanced mesh instance. */
export interface StructureBox {
  id: string;
  owner: string;
  center: V3;
  half: V3;
  yaw: number;
  grappleable: boolean;
  material: MaterialRole;
}

export interface AnchorSpec {
  id: string;
  kind: GrappleAnchorKind;
  position: V3;
  landing?: V3;
  zone: string;
  /** Box the anchor belongs to (its collider gets `anchorId`). */
  boxId: string;
}

/** Rotate a local XZ offset by yaw (same convention as three.js `rotation.y`). */
export function rotateY(x: number, z: number, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}

/** Axis-aligned XZ bounds of a (yawed) box. */
export function boxBoundsXZ(box: StructureBox): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const c = Math.abs(Math.cos(box.yaw));
  const s = Math.abs(Math.sin(box.yaw));
  const hx = box.half.x * c + box.half.z * s;
  const hz = box.half.x * s + box.half.z * c;
  return { minX: box.center.x - hx, maxX: box.center.x + hx, minZ: box.center.z - hz, maxZ: box.center.z + hz };
}

export function bottomY(box: StructureBox): number {
  return box.center.y - box.half.y;
}
