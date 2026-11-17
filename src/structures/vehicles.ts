import { BoxGeometry, BufferGeometry, Color, InstancedMesh, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyWeatheredPaint } from '@/world/containerModel';
import { VEHICLE_SIZE, VEHICLES, type VehicleKind } from './layout';
import { STRUCTURES } from './tunables';

/** What `GLTFLoader` hands back (only the part used here). */
interface LoadedGltf {
  scene: Object3D;
}

export type VehicleLoader = (url: string) => Promise<LoadedGltf>;

const defaultLoader: VehicleLoader = (url) => new GLTFLoader().loadAsync(url);

/** One mesh per vehicle kind, in metres, origin at the footprint centre on the ground, length along Z. */
export function geometriesFrom(gltf: LoadedGltf): Map<VehicleKind, BufferGeometry> {
  const out = new Map<VehicleKind, BufferGeometry>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh) || !(o.name in VEHICLE_SIZE)) return;
    const geo = (o.geometry as BufferGeometry).clone();
    geo.applyMatrix4(o.matrixWorld);
    // flat shading ignores normals for lighting, but the weathering shader needs valid ones
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    geo.computeBoundingSphere();
    out.set(o.name as VehicleKind, geo);
  });
  return out;
}

/** Plain box stand-in when the GLB cannot be loaded (the colliders exist either way). */
function fallbackGeometry(kind: VehicleKind): BufferGeometry {
  const s = VEHICLE_SIZE[kind];
  const g = new BoxGeometry(s.hx * 2, s.h, s.hz * 2);
  g.translate(0, s.h / 2, 0);
  return g;
}

/**
 * Builds one InstancedMesh per vehicle kind (one draw call each) with per-instance paint tints.
 * Returns the meshes; the caller adds them to the scene and tracks them for disposal.
 */
export function buildVehicleMeshes(geos: Map<VehicleKind, BufferGeometry>): InstancedMesh[] {
  const material = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.55, metalness: 0.3 });
  applyWeatheredPaint(material, { bottomY: 0, height: 3.2, wear: 0.7, key: 'vehicle', local: true, detail: 2 });
  const plain = new MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.3 });
  const obj = new Object3D();
  const c = new Color();
  const meshes: InstancedMesh[] = [];
  const kinds = [...new Set(VEHICLES.map((v) => v.kind))];
  for (const kind of kinds) {
    const items = VEHICLES.filter((v) => v.kind === kind);
    const loaded = geos.get(kind);
    const mesh = new InstancedMesh(loaded ?? fallbackGeometry(kind), loaded ? material : plain, items.length);
    items.forEach((v, i) => {
      obj.position.set(v.x, 0, v.z);
      obj.rotation.set(0, v.yaw, 0);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
      mesh.setColorAt(i, c.setHex(v.tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = `vehicles-${kind}`;
    meshes.push(mesh);
  }
  return meshes;
}

/** Loads the vehicle GLB; resolves to an empty map (box stand-ins) on any failure. */
export async function loadVehicleGeometries(loader: VehicleLoader = defaultLoader): Promise<Map<VehicleKind, BufferGeometry>> {
  try {
    return geometriesFrom(await loader(STRUCTURES.vehiclesUrl));
  } catch (err) {
    console.warn('[structures] vehicle models unavailable, using boxes', err);
    return new Map();
  }
}
