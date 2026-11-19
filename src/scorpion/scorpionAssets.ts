import { Box3, Mesh, Vector3 } from 'three';
import type { Material, MeshStandardMaterial, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Optional authored look of the STINGER-7 semi-boss (spec 28): "Scorpion Robot" by Mirandanimator (Sketchfab,
 * CC-BY 4.0), split and recoloured by `tools/asset-pipeline/scorpion_sf.py` (credits: docs/ASSETS.md,
 * src/ui/credits.ts). The loader lives in the scorpion module on purpose. When the GLB fails to load, the
 * procedural model in `ScorpionModel.ts` is used (same gameplay, same hit zones).
 *
 * The source is a four-legged scorpion without pincers: the game's claw pose has no joint here and is mapped
 * to the front legs (see `scorpionPose.ts`).
 */

export const SCORPION_GLB_URL = 'assets/enemies/scorpion.glb';

export const LEG_NODES = ['sc_legL0', 'sc_legL1', 'sc_legR0', 'sc_legR1'] as const;
export const TAIL_NODES = ['sc_tail0', 'sc_tail1', 'sc_tail2', 'sc_tail3'] as const;
export const NODE_BODY = 'sc_body';
export const NODE_HEAD = 'sc_head';
export const NODE_NOZZLE = 'sc_nozzle';
export const MATERIAL_GLOW = 'sc_glow';
export const MATERIAL_ARMOR = 'sc_armor';

/** A hit volume in the model frame (metres, feet at y = 0, the head towards -Z). */
export interface ColliderBox {
  zone: 'body' | 'critical';
  center: Vector3;
  half: Vector3;
}

export interface AuthoredScorpion {
  /** The loaded scene (nodes `sc_*`), cloned for each scorpion. */
  scene: Object3D;
  /** Hit volumes at the rest pose. */
  colliders: ColliderBox[];
  /** Eye drum and stinger mouth at the rest pose (model frame). */
  head: Vector3;
  nozzle: Vector3;
}

interface LoadedGltf {
  scene: Object3D;
}
export type AssetLoader = (url: string) => Promise<LoadedGltf>;

/** Share of a mesh's bounding box that becomes a hit volume (the boxes are generous around thin parts). */
const SHRINK = { body: 0.85, leg: 0.7, tail: 0.8 } as const;
/** Head sensors (critical): half extents around the eye drum. */
const HEAD_HALF = new Vector3(0.45, 0.42, 0.4);

const tmp = new Box3();
const part = new Box3();
const JOINTS: ReadonlySet<string> = new Set([NODE_BODY, ...LEG_NODES, ...TAIL_NODES]);

/** Bounding box (model frame) of the meshes a joint node owns: its own and its unnamed children, not the next joint of the chain. */
function meshBox(node: Object3D, out: Box3): Box3 {
  out.makeEmpty();
  const walk = (o: Object3D): void => {
    if (o !== node && JOINTS.has(o.name)) return;
    const m = o as Mesh;
    if (m.isMesh) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      out.union(part.copy(m.geometry.boundingBox as Box3).applyMatrix4(o.matrixWorld));
    }
    for (const c of o.children) walk(c);
  };
  walk(node);
  if (out.isEmpty()) throw new Error(`scorpion: ${node.name} has no mesh`);
  return out;
}

function boxOf(zone: ColliderBox['zone'], node: Object3D, shrink: number): ColliderBox {
  const b = meshBox(node, tmp);
  const center = b.getCenter(new Vector3());
  const half = b.getSize(new Vector3()).multiplyScalar(0.5 * shrink);
  return { zone, center, half };
}

/** The glow and armour materials of a scene by name (shared between the meshes). */
export function glowMaterialsOf(root: Object3D): Set<MeshStandardMaterial> {
  const out = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat.name === MATERIAL_GLOW) out.add(mat as MeshStandardMaterial);
    }
  });
  return out;
}

/** Validates the scorpion GLB and reads the hit volumes. Throws if a node or the glow material is missing. */
export function scorpionFrom(gltf: LoadedGltf): AuthoredScorpion {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const nodes = new Map<string, Object3D>();
  root.traverse((o) => {
    if (o.name) nodes.set(o.name, o);
  });
  for (const n of [NODE_BODY, NODE_HEAD, NODE_NOZZLE, ...LEG_NODES, ...TAIL_NODES]) {
    if (!nodes.has(n)) throw new Error(`scorpion: missing ${n}`);
  }
  if (glowMaterialsOf(root).size === 0) throw new Error(`scorpion: material ${MATERIAL_GLOW} missing`);
  const at = (name: string): Vector3 => (nodes.get(name) as Object3D).getWorldPosition(new Vector3());
  const head = at(NODE_HEAD);
  const colliders: ColliderBox[] = [];
  colliders.push(boxOf('body', nodes.get(NODE_BODY) as Object3D, SHRINK.body));
  colliders.push({ zone: 'critical', center: head.clone(), half: HEAD_HALF.clone() });
  for (const n of LEG_NODES) colliders.push(boxOf('body', nodes.get(n) as Object3D, SHRINK.leg));
  TAIL_NODES.forEach((n, i) => colliders.push(boxOf(i === TAIL_NODES.length - 1 ? 'critical' : 'body', nodes.get(n) as Object3D, SHRINK.tail)));
  return { scene: root, colliders, head, nozzle: at(NODE_NOZZLE) };
}

const defaultLoader: AssetLoader = (url) => new GLTFLoader().loadAsync(url);

/** Loads the scorpion GLB; a failure resolves to null (procedural fallback look), never rejects. */
export async function loadScorpionModel(loader: AssetLoader = defaultLoader, url: string = SCORPION_GLB_URL): Promise<AuthoredScorpion | null> {
  try {
    return scorpionFrom(await loader(url));
  } catch (err) {
    console.warn('[scorpion] authored model unavailable, using the procedural fallback', err);
    return null;
  }
}

/** Disposes every geometry and material of a loaded template (module scope teardown). */
export function disposeScene(root: Object3D): void {
  const seen = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!seen.has(mat)) {
        seen.add(mat);
        mat.dispose();
      }
    }
  });
}
