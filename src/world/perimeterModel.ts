import { InstancedMesh, MeshStandardMaterial, Object3D, type BufferGeometry, type Material } from 'three';
import { PERIMETER_WALL } from '@/config/warehouse';
import { applyWeatheredPaint } from './containerModel';
import { MeshBuilder } from './meshBuilder';
import { PERIMETER_LOCAL, perimeterPlacements, type PanelPlacement } from './perimeter';

/**
 * Meshes of the 7 m perimeter wall: three instanced meshes (precast panels, pilasters, coping) sharing one
 * weathered concrete material. Panels are modelled 4 m long and stretched per bay (only along the run, so
 * the horizontal joints keep their size).
 */

const H = PERIMETER_WALL.height;
const T = PERIMETER_WALL.thickness;
const UNIT = 4;

function panelGeometry(): BufferGeometry {
  const b = new MeshBuilder();
  b.box(0, H / 2, 0, UNIT / 2 - 0.02, H / 2, T / 2);
  // horizontal panel joints and a drip line near the top, on both faces
  for (const y of [H / 3, (2 * H) / 3]) b.box(0, y, 0, UNIT / 2 - 0.02, 0.03, T / 2 + 0.015);
  b.box(0, H - 0.5, 0, UNIT / 2 - 0.02, 0.05, T / 2 + 0.03);
  // a low kerb at the foot
  b.box(0, 0.15, 0, UNIT / 2, 0.15, T / 2 + 0.06);
  return b.build();
}

function pilasterGeometry(): BufferGeometry {
  const { width, depth } = PERIMETER_LOCAL.pilaster;
  const b = new MeshBuilder();
  b.box(0, (H + 0.2) / 2, 0, width / 2, (H + 0.2) / 2, T / 2 + depth);
  b.box(0, 0.25, 0, width / 2 + 0.06, 0.25, T / 2 + depth + 0.06);
  return b.build();
}

function copingGeometry(): BufferGeometry {
  const { height, overhang } = PERIMETER_LOCAL.coping;
  return new MeshBuilder().box(0, H + height / 2, 0, 0.5, height / 2, T / 2 + overhang).build();
}

function instances(geo: BufferGeometry, mat: Material, list: readonly PanelPlacement[], stretch: (p: PanelPlacement) => number, name: string): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, list.length);
  const o = new Object3D();
  list.forEach((p, i) => {
    o.position.set(p.x, 0, p.z);
    o.rotation.set(0, p.yaw, 0);
    o.scale.set(stretch(p), 1, 1);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function createPerimeterMeshes(): { meshes: InstancedMesh[]; material: MeshStandardMaterial } {
  const material = new MeshStandardMaterial({ color: 0x8a8c88, roughness: 0.82, metalness: 0 });
  applyWeatheredPaint(material, { bottomY: 0, height: H, wear: 0.3, key: 'perimeter-wall' });
  const { panels, pilasters, copings } = perimeterPlacements();
  return {
    material,
    meshes: [
      instances(panelGeometry(), material, panels, (p) => p.length / UNIT, 'perimeter-panels'),
      instances(pilasterGeometry(), material, pilasters, () => 1, 'perimeter-pilasters'),
      instances(copingGeometry(), material, copings, (p) => p.length, 'perimeter-coping'),
    ],
  };
}
