import { BoxGeometry, Color, InstancedMesh, MeshBasicMaterial, Object3D, SphereGeometry } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { GameContext } from '@/core/GameContext';
import type { GrappleAnchorKind } from '@/core/types';
import type { V3 } from './boxes';
import type { SamplePoint, ZoneCoverage } from './coverage';

const KIND_COLORS: Record<GrappleAnchorKind, number> = {
  crane: 0xff9a1f,
  beam: 0xffe14d,
  'container-top': 0x4dc3ff,
  'lamp-post': 0xf2f2f2,
  perch: 0x3dff7a,
  manual: 0xc86bff,
};

const SPHERE_RADIUS = 0.6;
const MARKER_SIZE = { x: 0.6, y: 2.4, z: 0.6 };

export function coverageLine(label: string, coverage: readonly ZoneCoverage[]): string {
  const parts = coverage.map((c) => `${c.zone} ${c.total ? ((100 * c.covered) / c.total).toFixed(1) : '100.0'}% (${c.covered}/${c.total})`);
  return `${label}: ${parts.join(' | ')}`;
}

/**
 * `?anchors` view: coloured spheres on every registered anchor, red markers on samples without
 * (line-of-sight) coverage and a DOM line with the per-zone figures. Everything is tracked in
 * `res` and removed by its dispose.
 */
export function createDebugView(
  ctx: GameContext,
  res: ResourceTracker,
  anchors: readonly { kind: GrappleAnchorKind; position: V3 }[],
  geometric: readonly ZoneCoverage[],
  los: readonly ZoneCoverage[],
): void {
  const dummy = new Object3D();
  const color = new Color();

  const spheres = new InstancedMesh(
    new SphereGeometry(SPHERE_RADIUS, 10, 8),
    new MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.9 }),
    Math.max(1, anchors.length),
  );
  anchors.forEach((a, i) => {
    dummy.position.set(a.position.x, a.position.y, a.position.z);
    dummy.updateMatrix();
    spheres.setMatrixAt(i, dummy.matrix);
    spheres.setColorAt(i, color.setHex(KIND_COLORS[a.kind]));
  });
  spheres.count = anchors.length;
  spheres.renderOrder = 10;
  ctx.scene.add(res.track(spheres));

  const uncovered: SamplePoint[] = los.flatMap((z) => z.uncovered);
  if (uncovered.length > 0) {
    const markers = new InstancedMesh(
      new BoxGeometry(MARKER_SIZE.x, MARKER_SIZE.y, MARKER_SIZE.z),
      new MeshBasicMaterial({ color: 0xff2a1a, depthTest: false }),
      uncovered.length,
    );
    uncovered.forEach((s, i) => {
      dummy.position.set(s.x, MARKER_SIZE.y / 2, s.z);
      dummy.updateMatrix();
      markers.setMatrixAt(i, dummy.matrix);
    });
    markers.renderOrder = 11;
    ctx.scene.add(res.track(markers));
  }

  const line = document.createElement('div');
  line.id = 'structures-anchors-debug';
  line.style.cssText =
    'position:absolute;left:8px;bottom:8px;padding:4px 8px;background:rgba(0,0,0,.65);color:#9fe8b0;font:12px monospace;pointer-events:none;white-space:pre';
  line.textContent = `${coverageLine('Anchor range', geometric)}\n${coverageLine('Anchor LOS', los)}`;
  ctx.uiRoot.appendChild(line);
  res.onDispose(() => line.remove());
}
