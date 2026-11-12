import type { CraneSite } from '@/config/level';
import { ANCHOR, CRANE } from './tunables';
import { rotateY } from './boxes';
import type { AnchorSpec, MaterialRole, StructureBox, V3 } from './boxes';

/** A member of the shared base crane in its local, unscaled frame. */
export interface CraneLocalPart {
  name: string;
  center: V3;
  half: V3;
  grappleable: boolean;
  material: MaterialRole;
  /** Anchor registered under the member (underside centre / boom tip). */
  anchor?: { kind: 'crane' | 'beam'; at: V3 };
}

const C = CRANE;
const SIGNS = [-1, 1] as const;

/** The base model: 4 legs, 4 portal beams, 2 mid beams, boom, cabin (12 boxes). */
export function craneLocalParts(): readonly CraneLocalPart[] {
  const parts: CraneLocalPart[] = [];
  for (const x of SIGNS) {
    for (const z of SIGNS) {
      parts.push({
        name: `leg-${x > 0 ? 'e' : 'w'}${z > 0 ? 's' : 'n'}`,
        center: { x: x * C.legX, y: C.legHeight / 2, z: z * C.legZ },
        half: { x: C.legHalf, y: C.legHeight / 2, z: C.legHalf },
        grappleable: false,
        material: 'frame',
      });
    }
  }
  const portalSpan = C.legX + C.legHalf;
  const portalDepth = C.legZ + C.legHalf;
  for (const z of SIGNS) {
    parts.push({
      name: z > 0 ? 'portal-s' : 'portal-n',
      center: { x: 0, y: C.portalY, z: z * C.legZ },
      half: { x: portalSpan, y: C.portalHalf, z: C.portalHalf },
      grappleable: true,
      material: 'frame',
      anchor: { kind: 'crane', at: { x: 0, y: C.portalY - C.portalHalf - ANCHOR.surfaceOffset, z: z * C.legZ } },
    });
  }
  for (const x of SIGNS) {
    parts.push({
      name: x > 0 ? 'portal-e' : 'portal-w',
      center: { x: x * C.legX, y: C.portalY, z: 0 },
      half: { x: C.portalHalf, y: C.portalHalf, z: portalDepth },
      grappleable: true,
      material: 'frame',
    });
  }
  for (const z of SIGNS) {
    parts.push({
      name: z > 0 ? 'mid-s' : 'mid-n',
      center: { x: 0, y: C.midY, z: z * C.legZ },
      half: { x: C.legX, y: C.midHalf, z: C.midHalf },
      grappleable: true,
      material: 'frame',
      anchor: { kind: 'beam', at: { x: 0, y: C.midY - C.midHalf - ANCHOR.surfaceOffset, z: z * C.legZ } },
    });
  }
  parts.push({
    name: 'boom',
    center: { x: 0, y: C.boomY, z: (C.boomZMax + C.boomZMin) / 2 },
    half: { x: C.boomHalfWidth, y: C.boomHalfHeight, z: (C.boomZMax - C.boomZMin) / 2 },
    grappleable: true,
    material: 'accent',
    anchor: { kind: 'crane', at: { x: 0, y: C.boomY - C.boomHalfHeight - ANCHOR.surfaceOffset, z: C.boomZMax - 1 } },
  });
  parts.push({
    name: 'cabin',
    center: { x: 0, y: C.cabin.centerY, z: 0 },
    half: { x: C.cabin.x, y: C.cabin.y, z: C.cabin.z },
    grappleable: false,
    material: 'accent',
  });
  return parts;
}

/** Six boxes for the far LOD: four legs, the portal deck and the boom. */
export function craneLowParts(): readonly { center: V3; half: V3 }[] {
  const legs = craneLocalParts().filter((p) => p.name.startsWith('leg-'));
  return [
    ...legs.map((p) => ({ center: p.center, half: p.half })),
    {
      center: { x: 0, y: C.portalY, z: 0 },
      half: { x: C.legX + C.legHalf, y: C.portalHalf, z: C.legZ + C.legHalf },
    },
    {
      center: { x: 0, y: C.boomY, z: (C.boomZMax + C.boomZMin) / 2 },
      half: { x: C.boomHalfWidth, y: C.boomHalfHeight, z: (C.boomZMax - C.boomZMin) / 2 },
    },
  ];
}

export interface PlacedCrane {
  site: CraneSite;
  boxes: StructureBox[];
  anchors: AnchorSpec[];
}

function toWorld(site: CraneSite, p: V3): V3 {
  const r = rotateY(p.x * site.scale, p.z * site.scale, site.yaw);
  return { x: site.position.x + r.x, y: site.position.y + p.y * site.scale, z: site.position.z + r.z };
}

/** World-space boxes and anchors of one crane (scale and yaw of the site applied). */
export function placeCrane(site: CraneSite): PlacedCrane {
  const boxes: StructureBox[] = [];
  const anchors: AnchorSpec[] = [];
  for (const part of craneLocalParts()) {
    const id = `${site.id}/${part.name}`;
    boxes.push({
      id,
      owner: site.id,
      center: toWorld(site, part.center),
      half: { x: part.half.x * site.scale, y: part.half.y * site.scale, z: part.half.z * site.scale },
      yaw: site.yaw,
      grappleable: part.grappleable,
      material: part.material,
    });
    if (part.anchor) {
      anchors.push({
        id: `${id}/anchor`,
        kind: part.anchor.kind,
        position: toWorld(site, part.anchor.at),
        zone: site.zone,
        boxId: id,
      });
    }
  }
  return { site, boxes, anchors };
}
