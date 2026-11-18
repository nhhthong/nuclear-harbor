import { BufferGeometry, Mesh, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SamuraiModel } from './model';
import { SAMURAI } from './tunables';

/**
 * Optional authored look for the cyber samurai: the "Cyberpunk Samurai Robot" body (Sketchfab, CC-BY 4.0,
 * byhoangtran) holding a naginata (OpenGameArt, CC0, Bioxx), built by tools/asset-pipeline/samurai.py.
 * The GLB carries the parts already split at the hips and knees plus empties at the pivots, so the
 * procedural rig (`Samurai.ts`: legs swing at the hips and knees, the upper body leans, the weapon turns
 * about its grip) drives it unchanged. Until it loads, or if it fails, samurai use the procedural model.
 */
export interface SamuraiSkin {
  /**
   * Geometry in the same frames as `buildSamuraiModel()` (body around the centre, legs around their pivots),
   * except the weapon, which points forward: the rig pitches and yaws it instead of turning it about Z.
   */
  model: SamuraiModel;
  bodyMaterial: Material;
  weaponMaterial: Material;
}

interface LoadedGltf {
  scene: Object3D;
}
export type SkinLoader = (url: string) => Promise<LoadedGltf>;

const PARTS = ['samurai_body', 'samurai_thighL', 'samurai_thighR', 'samurai_shinL', 'samurai_shinR', 'samurai_naginata'] as const;
const JOINTS = ['joint_hipL', 'joint_hipR', 'joint_kneeL', 'joint_kneeR', 'joint_grip'] as const;

let current: SamuraiSkin | null = null;

export function samuraiSkin(): SamuraiSkin | null {
  return current;
}

export function setSamuraiSkin(skin: SamuraiSkin | null): void {
  current = skin;
}

/** Turns the loaded GLB into rig-ready geometry. Throws if a part or joint is missing. */
export function skinFrom(gltf: LoadedGltf): SamuraiSkin {
  gltf.scene.updateMatrixWorld(true);
  const meshes = new Map<string, Mesh>();
  const joints = new Map<string, Vector3>();
  gltf.scene.traverse((o) => {
    if ((PARTS as readonly string[]).includes(o.name) && o instanceof Mesh) meshes.set(o.name, o);
    // multi-primitive nodes load as a group of meshes named "<node>_N"
    else if (o instanceof Mesh && o.parent && (PARTS as readonly string[]).includes(o.parent.name) && !meshes.has(o.parent.name)) meshes.set(o.parent.name, o);
    if ((JOINTS as readonly string[]).includes(o.name)) joints.set(o.name, o.getWorldPosition(new Vector3()));
  });
  for (const p of PARTS) if (!meshes.has(p)) throw new Error(`samurai skin: missing ${p}`);
  for (const j of JOINTS) if (!joints.has(j)) throw new Error(`samurai skin: missing ${j}`);
  const hipL = joints.get('joint_hipL')!;
  const hipR = joints.get('joint_hipR')!;
  const kneeL = joints.get('joint_kneeL')!;
  const kneeR = joints.get('joint_kneeR')!;
  const grip = joints.get('joint_grip')!;
  const hipY = (hipL.y + hipR.y) / 2;
  const hipZ = (hipL.z + hipR.z) / 2;
  const kneeY = (kneeL.y + kneeR.y) / 2;
  const kneeZ = (kneeL.z + kneeR.z) / 2 - hipZ;
  const c = SAMURAI.centerHeight;
  const take = (name: string, dy: number, dz: number, world = true): BufferGeometry => {
    const m = meshes.get(name)!;
    const g = (m.geometry as BufferGeometry).clone();
    if (world) g.applyMatrix4(m.matrixWorld);
    g.translate(0, dy, dz);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const empty = new BufferGeometry();
  const model: SamuraiModel = {
    body: take('samurai_body', -c, -hipZ),
    bodyGlow: empty,
    thighL: take('samurai_thighL', -hipY, -hipZ),
    thighR: take('samurai_thighR', -hipY, -hipZ),
    shinL: take('samurai_shinL', -kneeY, -hipZ - kneeZ),
    shinR: take('samurai_shinR', -kneeY, -hipZ - kneeZ),
    hip: { x: Math.abs(hipR.x), y: hipY - c },
    knee: { y: kneeY - hipY, z: kneeZ },
    thighLength: hipY - kneeY,
    shinLength: kneeY,
    // the naginata is authored along +X around its grip; the robot holds it like its original katana:
    // straight out in front along the wrist (-Z), tip a little down. Samurai.ts swings it about X/Y.
    weapon: take('samurai_naginata', 0, 0, false).rotateY(Math.PI / 2).rotateX(-SAMURAI.skinWeaponDroop),
    blade: empty,
    weaponGlow: empty,
    grip: new Vector3(grip.x, grip.y - c, grip.z - hipZ),
    restAngle: SAMURAI.skinRestAngle,
    cloth: empty,
    clothPivot: new Vector3(0, 0, 0),
  };
  const mat = (name: string): Material => {
    const m = meshes.get(name)!.material;
    return (Array.isArray(m) ? m[0] : m) as Material;
  };
  return { model, bodyMaterial: mat('samurai_body'), weaponMaterial: mat('samurai_naginata') };
}

const defaultLoader: SkinLoader = (url) => new GLTFLoader().loadAsync(url);

/** Loads and installs the skin; resolves to null (procedural look) on any failure. */
export async function loadSamuraiSkin(loader: SkinLoader = defaultLoader): Promise<SamuraiSkin | null> {
  try {
    const skin = skinFrom(await loader(SAMURAI.skinUrl));
    setSamuraiSkin(skin);
    return skin;
  } catch (err) {
    console.warn('[enemies] samurai skin unavailable, using the procedural model', err);
    return null;
  }
}
