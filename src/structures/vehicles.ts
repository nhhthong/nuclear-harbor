import { BoxGeometry, BufferAttribute, BufferGeometry, Color, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, type Material } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyWeatheredPaint } from '@/world/containerModel';
import { VEHICLE_SIZE, VEHICLES, type VehicleKind } from './layout';
import { STRUCTURES } from './tunables';

/** What `GLTFLoader` hands back (only the part used here). */
interface LoadedGltf {
  scene: Object3D;
}

export type VehicleLoader = (url: string) => Promise<LoadedGltf>;

/** One material's share of a vehicle model (a vehicle kind has a few of them). */
export interface VehiclePart {
  geometry: BufferGeometry;
  material: Material;
}

const defaultLoader: VehicleLoader = (url) => new GLTFLoader().loadAsync(url);

/** Car body materials end with this suffix in the GLB: they take the per-vehicle paint tint. */
const PAINT_SUFFIX = '_paint';

/** The vehicle kind a loaded node belongs to: the node itself, or its parent for multi-material meshes. */
function kindOf(o: Object3D): VehicleKind | null {
  for (let n: Object3D | null = o; n; n = n.parent) {
    if (n.name in VEHICLE_SIZE) return n.name as VehicleKind;
  }
  return null;
}

/** Float copy of an attribute (the GLB stores normals as normalized int8; transforms need floats). */
function toFloat(attr: BufferAttribute): BufferAttribute {
  if (attr.array instanceof Float32Array && !attr.normalized) return attr;
  const out = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c);
  return new BufferAttribute(out, attr.itemSize);
}

/**
 * The parts of every vehicle kind (one per material), in metres, origin at the footprint centre on the
 * ground, length along Z, front towards +Z. Materials are the loaded PBR materials.
 */
export function geometriesFrom(gltf: LoadedGltf): Map<VehicleKind, VehiclePart[]> {
  const out = new Map<VehicleKind, VehiclePart[]>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const kind = kindOf(o);
    if (!kind) return;
    const src = o.geometry as BufferGeometry;
    const geo = new BufferGeometry();
    for (const [name, attr] of Object.entries(src.attributes)) geo.setAttribute(name, toFloat(attr as BufferAttribute));
    if (src.index) geo.setIndex(src.index);
    geo.applyMatrix4(o.matrixWorld);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const material = (Array.isArray(o.material) ? o.material[0] : o.material) as Material;
    const parts = out.get(kind) ?? [];
    parts.push({ geometry: geo, material });
    out.set(kind, parts);
  });
  return out;
}

/** Plain box stand-in when the GLB cannot be loaded (the colliders exist either way). */
function fallbackParts(kind: VehicleKind, material: Material): VehiclePart[] {
  const s = VEHICLE_SIZE[kind];
  const g = new BoxGeometry(s.hx * 2, s.h, s.hz * 2);
  g.translate(0, s.h / 2, 0);
  return [{ geometry: g, material }];
}

/** Light wear on the car paint (the rest of the model keeps its own textures). */
function preparePaint(material: Material, kind: VehicleKind): void {
  if (!(material instanceof MeshStandardMaterial) || material.userData.nhPaint) return;
  material.userData.nhPaint = true;
  applyWeatheredPaint(material, { bottomY: 0, height: VEHICLE_SIZE[kind].h, wear: 0.35, key: 'vehicle-paint', local: true, detail: 2 });
}

/**
 * Builds one InstancedMesh per vehicle kind and material (a few draw calls per kind). Paint parts take
 * the per-vehicle tint; everything else keeps the model's own colours.
 * Returns the meshes; the caller adds them to the scene and tracks them for disposal.
 */
export function buildVehicleMeshes(models: Map<VehicleKind, VehiclePart[]>): InstancedMesh[] {
  const plain = new MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.3 });
  const obj = new Object3D();
  const c = new Color();
  const meshes: InstancedMesh[] = [];
  const kinds = [...new Set(VEHICLES.map((v) => v.kind))];
  for (const kind of kinds) {
    const items = VEHICLES.filter((v) => v.kind === kind);
    const parts = models.get(kind) ?? fallbackParts(kind, plain);
    parts.forEach((part, p) => {
      const paint = part.material.name.endsWith(PAINT_SUFFIX);
      if (paint) preparePaint(part.material, kind);
      const mesh = new InstancedMesh(part.geometry, part.material, items.length);
      items.forEach((v, i) => {
        obj.position.set(v.x, 0, v.z);
        obj.rotation.set(0, v.yaw, 0);
        obj.updateMatrix();
        mesh.setMatrixAt(i, obj.matrix);
        if (paint) mesh.setColorAt(i, c.setHex(v.tint));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.name = parts.length > 1 ? `vehicles-${kind}-${p}` : `vehicles-${kind}`;
      meshes.push(mesh);
    });
  }
  return meshes;
}

/** Loads the vehicle GLB; resolves to an empty map (box stand-ins) on any failure. */
export async function loadVehicleGeometries(loader: VehicleLoader = defaultLoader): Promise<Map<VehicleKind, VehiclePart[]>> {
  try {
    return geometriesFrom(await loader(STRUCTURES.vehiclesUrl));
  } catch (err) {
    console.warn('[structures] vehicle models unavailable, using boxes', err);
    return new Map();
  }
}
