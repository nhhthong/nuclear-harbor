import { BoxGeometry, BufferGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRESSING, DRESSING_SIZE, type Dressing, type DressingKind } from './layout';
import { STRUCTURES } from './tunables';

interface LoadedGltf {
  scene: Object3D;
}
export type DressingLoader = (url: string) => Promise<LoadedGltf>;
const defaultLoader: DressingLoader = (url) => new GLTFLoader().loadAsync(url);

export interface DressingModel {
  geometry: BufferGeometry;
  material: Material;
}

/** One geometry + material per clutter kind, in metres, origin at the footprint centre on the ground. */
export function dressingModelsFrom(gltf: LoadedGltf): Map<DressingKind, DressingModel> {
  const out = new Map<DressingKind, DressingModel>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    // a node with one material is the mesh itself; three names primitives of multi-material nodes "<name>_N"
    const kind = (o.name in DRESSING_SIZE ? o.name : o.parent?.name) as DressingKind | undefined;
    if (!kind || !(kind in DRESSING_SIZE) || out.has(kind)) return;
    const geometry = (o.geometry as BufferGeometry).clone();
    geometry.applyMatrix4(o.matrixWorld);
    geometry.computeBoundingSphere();
    out.set(kind, { geometry, material: Array.isArray(o.material) ? (o.material[0] as Material) : (o.material as Material) });
  });
  return out;
}

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const p = new Vector3();
const one = new Vector3(1, 1, 1);

/** Instance matrices of one placement (a tyre stack yields one matrix per tyre, each turned a little). */
export function dressingMatrices(d: Dressing): Matrix4[] {
  const stacked = d.kind === 'tyre' || d.kind === 'pallet';
  const count = stacked ? Math.max(1, d.stack ?? 1) : 1;
  const h = DRESSING_SIZE[d.kind].h;
  const out: Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    q.setFromAxisAngle(UP, d.yaw + (d.jitter ?? 0) + i * (d.kind === 'tyre' ? 0.9 : 0.05));
    p.set(d.x + (i % 2) * 0.03, i * h, d.z - (i % 3) * 0.02);
    out.push(new Matrix4().compose(p, q, one));
  }
  return out;
}

function fallback(kind: DressingKind): DressingModel {
  const s = DRESSING_SIZE[kind];
  const g = new BoxGeometry(s.hx * 2, s.h, s.hz * 2);
  g.translate(0, s.h / 2, 0);
  return { geometry: g, material: new MeshStandardMaterial({ color: 0x777b80, roughness: 0.7 }) };
}

/** One InstancedMesh per clutter kind; box stand-ins for kinds the GLB did not provide. */
export function buildDressingMeshes(models: Map<DressingKind, DressingModel>): InstancedMesh[] {
  const byKind = new Map<DressingKind, Matrix4[]>();
  for (const d of DRESSING) byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), ...dressingMatrices(d)]);
  const meshes: InstancedMesh[] = [];
  for (const [kind, mats] of byKind) {
    const m = models.get(kind) ?? fallback(kind);
    const mesh = new InstancedMesh(m.geometry, m.material, mats.length);
    mats.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.name = `dressing-${kind}`;
    meshes.push(mesh);
  }
  return meshes;
}

/** Loads both clutter GLBs; a file that fails leaves its kinds as box stand-ins. */
export async function loadDressingModels(loader: DressingLoader = defaultLoader): Promise<Map<DressingKind, DressingModel>> {
  const out = new Map<DressingKind, DressingModel>();
  for (const url of [STRUCTURES.dressingUrl, STRUCTURES.terminalUrl]) {
    try {
      for (const [k, m] of dressingModelsFrom(await loader(url))) out.set(k, m);
    } catch (err) {
      console.warn('[structures] clutter models unavailable, using boxes', url, err);
    }
  }
  return out;
}
