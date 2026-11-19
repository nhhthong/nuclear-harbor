import { BoxGeometry, CapsuleGeometry, Color, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The dragonfly drone look shared by the boss drones (src/boss/Drones.ts) and the regular `drone` enemy
 * (src/enemies/drone, spec 29). The GLB ("Light Assault Mech" by Lagst, Sketchfab, CC-BY 4.0, built by
 * `tools/asset-pipeline/drone_sf.py`) is fetched and parsed once per page; both modules receive the same
 * geometry and material (each tracks them in its own ResourceTracker scope, which is reference counted).
 * When the GLB is missing both use the small procedural dragonfly below. Lives in `src/assets` because two
 * feature modules need it (constitution II: feature modules never import each other).
 */

export const DRONE_ASSET_URL = 'assets/enemies/dragonfly-drone.glb';

export interface DroneAssets {
  geometry: BufferGeometry;
  material: Material;
}

interface LoadedGltf {
  scene: Object3D;
}
export type DroneAssetLoader = (url: string) => Promise<LoadedGltf>;

/** First mesh of the dragonfly GLB (one node, `drone_body`), baked into world space. Throws without a mesh. */
export function droneFrom(gltf: LoadedGltf): DroneAssets {
  let mesh: Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!mesh && o instanceof Mesh) mesh = o;
  });
  const m = mesh as Mesh | null;
  if (!m) throw new Error('drone: no mesh');
  const material = Array.isArray(m.material) ? m.material[0] : m.material;
  if (!material) throw new Error('drone: no material');
  gltf.scene.updateMatrixWorld(true);
  const geometry = m.geometry.clone();
  geometry.applyMatrix4(m.matrixWorld);
  return { geometry, material };
}

const cache = new Map<string, Promise<DroneAssets | null>>();
let loaded: DroneAssets | null = null;

const defaultLoader: DroneAssetLoader = (url) => new GLTFLoader().loadAsync(url);

/**
 * Loads the dragonfly once (cached per URL with the default loader; a custom loader, as in the tests, always
 * loads). Resolves to null when the GLB fails (procedural fallback), never rejects. `tag` prefixes the warning.
 */
export function loadDroneAsset(url: string = DRONE_ASSET_URL, loader?: DroneAssetLoader, tag = 'drone'): Promise<DroneAssets | null> {
  const run = async (): Promise<DroneAssets | null> => {
    try {
      const a = droneFrom(await (loader ?? defaultLoader)(url));
      if (!loader) loaded = a;
      return a;
    } catch (err) {
      console.warn(`[${tag}] drone model unavailable, using the procedural fallback`, err);
      return null;
    }
  };
  if (loader) return run();
  let p = cache.get(url);
  if (!p) {
    p = run();
    cache.set(url, p);
  }
  return p;
}

/** The dragonfly loaded by `loadDroneAsset` with the default loader, or null (not loaded yet, or failed). */
export function loadedDroneAsset(): DroneAssets | null {
  return loaded;
}

/** Tests: forget the cache. */
export function resetDroneAssetCache(): void {
  cache.clear();
  loaded = null;
}

/** Small procedural dragonfly (fallback when the GLB is missing): body, head, tail, four thin wings. Nose = -Z. */
export function proceduralDroneGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const body = new CapsuleGeometry(0.16, 0.7, 4, 8);
  body.rotateX(Math.PI / 2);
  parts.push(body);
  const head = new SphereGeometry(0.2, 10, 8);
  head.translate(0, 0, -0.6);
  parts.push(head);
  for (const sx of [-1, 1]) {
    for (const z of [-0.15, 0.2]) {
      const wing = new BoxGeometry(1.5, 0.02, 0.28);
      wing.translate(sx * 0.85, 0.12, z);
      parts.push(wing);
    }
  }
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error('drone geometry merge failed');
  return merged;
}

/** Material of the procedural dragonfly. */
export function proceduralDroneMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4, emissive: new Color(0x401008) });
}
