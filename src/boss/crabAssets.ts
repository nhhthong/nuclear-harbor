import { Box3, Mesh, Vector3 } from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CRAB } from './tunables';

/**
 * Optional authored look of the final boss (spec 27): the "Gunslinger Crab Mech v1.2" by vaportrash and the
 * "Light Assault Mech" dragonfly by Lagst (Sketchfab, CC-BY 4.0), built by `tools/asset-pipeline/boss_sf.py`
 * and `drone_sf.py` (credits: docs/ASSETS.md, src/ui/credits.ts). The loader lives in the boss module on
 * purpose (nothing is shared with src/enemies). When the crab fails to load the procedural TITAN-04 body is
 * used; without the dragonfly the drones are small procedural flyers.
 */

export interface LegBone {
  hip: Vector3;
  knee: Vector3;
  foot: Vector3;
}

export interface CrabAssets {
  /** The loaded scene, cloned for the boss body. */
  scene: Object3D;
  /** Muzzle (gun tips), mortar and drone bay in crab space (metres). */
  muzzleL: Vector3;
  muzzleR: Vector3;
  mortar: Vector3;
  bay: Vector3;
  /** Rest-pose leg bones (hip, knee, foot) per leg name, in crab space. */
  bones: Map<string, LegBone>;
  /** Shoulder pivot and muzzle of the arms in crab space. */
  arms: Map<string, { shoulder: Vector3; tip: Vector3 }>;
}

export interface DroneAssets {
  geometry: BufferGeometry;
  material: Material;
}

interface LoadedGltf {
  scene: Object3D;
}
export type AssetLoader = (url: string) => Promise<LoadedGltf>;

export const LEG_NAMES = ['crab_legL0', 'crab_legL1', 'crab_legL2', 'crab_legR0', 'crab_legR1', 'crab_legR2'] as const;
export const ARM_NAMES = ['crab_armL', 'crab_armR'] as const;
const EMPTIES = ['muzzle_L', 'muzzle_R', 'mortar', 'bay'] as const;

const tmpBox = new Box3();

/** Validates the crab GLB and reads the pivots. Throws if a node is missing. */
export function crabFrom(gltf: LoadedGltf): CrabAssets {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const nodes = new Map<string, Object3D>();
  root.traverse((o) => {
    if (o.name) nodes.set(o.name, o);
  });
  for (const n of ['crab_body', ...LEG_NAMES, ...ARM_NAMES, ...EMPTIES]) {
    if (!nodes.has(n)) throw new Error(`crab: missing ${n}`);
  }
  const at = (name: string): Vector3 => nodes.get(name)!.getWorldPosition(new Vector3());
  const bones = new Map<string, LegBone>();
  for (const name of LEG_NAMES) {
    const node = nodes.get(name)!;
    const hip = at(name);
    tmpBox.setFromObject(node);
    const side = hip.x >= 0 ? 1 : -1;
    const foot = new Vector3(side * Math.max(Math.abs(tmpBox.min.x), Math.abs(tmpBox.max.x)), 0.15, (tmpBox.min.z + tmpBox.max.z) / 2);
    const knee = new Vector3(hip.x + (foot.x - hip.x) * 0.55, Math.max(hip.y, tmpBox.max.y * 0.9), hip.z + (foot.z - hip.z) * 0.55);
    bones.set(name, { hip, knee, foot });
  }
  const arms = new Map<string, { shoulder: Vector3; tip: Vector3 }>();
  for (const name of ARM_NAMES) {
    const node = nodes.get(name)!;
    const shoulder = at(name);
    tmpBox.setFromObject(node);
    arms.set(name, { shoulder, tip: new Vector3((tmpBox.min.x + tmpBox.max.x) / 2, (tmpBox.min.y + tmpBox.max.y) / 2, tmpBox.min.z) });
  }
  return { scene: root, muzzleL: at('muzzle_L'), muzzleR: at('muzzle_R'), mortar: at('mortar'), bay: at('bay'), bones, arms };
}

/** First mesh of the dragonfly GLB (one node, `drone_body`). */
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

const defaultLoader: AssetLoader = (url) => new GLTFLoader().loadAsync(url);

export interface BossAssets {
  crab: CrabAssets | null;
  drone: DroneAssets | null;
}

/** Loads both GLBs; a failed one resolves to null (fallback look), never rejects. */
export async function loadBossAssets(loader: AssetLoader = defaultLoader): Promise<BossAssets> {
  const one = async <T>(url: string, make: (g: LoadedGltf) => T, what: string): Promise<T | null> => {
    try {
      return make(await loader(url));
    } catch (err) {
      console.warn(`[boss] ${what} unavailable, using the procedural fallback`, err);
      return null;
    }
  };
  const [crab, drone] = await Promise.all([one(CRAB.crabUrl, crabFrom, 'crab model'), one(CRAB.droneUrl, droneFrom, 'drone model')]);
  return { crab, drone };
}

/** Rest-pose leg bones of the crab (crab space) for when the GLB is missing: matches the model within a metre. */
export function fallbackBones(): Map<string, LegBone> {
  const m = new Map<string, LegBone>();
  const zs = [-0.9, 0.35, 0.65];
  LEG_NAMES.forEach((name, i) => {
    const side = i < 3 ? -1 : 1;
    const z = zs[i % 3] ?? 0;
    const hip = new Vector3(side * 1.05, 4.0, z);
    const foot = new Vector3(side * 5.0, 0.15, z * 2.6);
    m.set(name, { hip, knee: new Vector3(side * 3.2, 4.6, z * 1.8), foot });
  });
  return m;
}
