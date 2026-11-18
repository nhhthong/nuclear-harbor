import { AnimationClip, Group, Mesh, SkinnedMesh, type Material, type Object3D, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { STRIKER } from './army/tunables';
import { BIPED } from './biped/tunables';
import { ClipPlayer } from './clipPlayer';
import { SPOT } from './spot/tunables';

/**
 * Authored robot models (spec 26): GLBs built by tools/asset-pipeline/enemies_sf.py from Sketchfab models (CC-BY 4.0,
 * credits in docs/ASSETS.md). One parsed scene per kind is shared by every robot of the kind: each robot clones the
 * node tree with `SkeletonUtils.clone` (own bones and skeleton, shared geometry and materials) and drives it with
 * its own `AnimationMixer`. Until the GLB has loaded, or if it fails, robots use their procedural models.
 */
export type AuthoredKind = 'biped' | 'striker' | 'spot';

export interface AuthoredSource {
  scene: Object3D;
  animations: AnimationClip[];
}

export interface AuthoredModel {
  scene: Object3D;
  /** Clips by name; clips named with `mergePrefix` are combined into one called `mergeInto`. */
  clips: ReadonlyMap<string, AnimationClip>;
}

export type AuthoredLoader = (url: string) => Promise<AuthoredSource>;

interface Entry {
  url: string;
  /** The Spot GLB keeps one walk clip per leg skeleton: they are played together as one `walk` clip. */
  merge?: { prefix: string; into: string };
}

export const AUTHORED: Readonly<Record<AuthoredKind, Entry>> = {
  biped: { url: BIPED.skin.url },
  striker: { url: STRIKER.skin.url },
  spot: { url: SPOT.skin.url, merge: { prefix: 'GLTF_created_', into: 'walk' } },
};

const KINDS = Object.keys(AUTHORED) as AuthoredKind[];
const models = new Map<AuthoredKind, AuthoredModel>();

export function authoredModel(kind: AuthoredKind): AuthoredModel | null {
  return models.get(kind) ?? null;
}

export function setAuthoredModel(kind: AuthoredKind, model: AuthoredModel | null): void {
  if (model) models.set(kind, model);
  else models.delete(kind);
}

/** Collects the clips by name and merges the ones that share a prefix. Throws when the model has no scene or no clip. */
export function buildAuthored(src: AuthoredSource, merge?: Entry['merge']): AuthoredModel {
  if (!src.scene) throw new Error('authored model without a scene');
  const clips = new Map<string, AnimationClip>();
  const merged: AnimationClip[] = [];
  for (const clip of src.animations) {
    if (merge && clip.name.startsWith(merge.prefix)) merged.push(clip);
    else clips.set(clip.name, clip);
  }
  if (merge && merged.length > 0) {
    const tracks = merged.flatMap((c) => c.tracks);
    clips.set(merge.into, new AnimationClip(merge.into, -1, tracks));
  }
  if (clips.size === 0) throw new Error('authored model without animation clips');
  return { scene: src.scene, clips };
}

const defaultLoader: AuthoredLoader = (url) => new GLTFLoader().loadAsync(url);

/** Loads and installs one model; resolves to null (procedural look) on any failure. */
export async function loadAuthored(kind: AuthoredKind, loader: AuthoredLoader = defaultLoader): Promise<AuthoredModel | null> {
  const entry = AUTHORED[kind];
  try {
    const model = buildAuthored(await loader(entry.url), entry.merge);
    models.set(kind, model);
    return model;
  } catch (err) {
    console.warn(`[enemies] ${kind} model unavailable, using the procedural one`, err);
    return null;
  }
}

/** Loads every authored model in parallel; never rejects. */
export function loadAllAuthored(loader?: AuthoredLoader): Promise<Array<AuthoredModel | null>> {
  return Promise.all(KINDS.map((k) => loadAuthored(k, loader)));
}

/** One robot's copy of an authored model. */
export interface AuthoredInstance {
  /** Node tree with the feet at its origin; add it to the robot's visual group. */
  root: Group;
  player: ClipPlayer;
  meshes: SkinnedMesh[];
  dispose(): void;
}

/** Clones `model` with its own skeleton and mixer; geometry and materials stay shared. */
export function instantiate(model: AuthoredModel, opts: { castShadow?: boolean } = {}): AuthoredInstance {
  const root = new Group();
  const copy = clone(model.scene);
  root.add(copy);
  const meshes: SkinnedMesh[] = [];
  copy.traverse((o) => {
    if (o instanceof Mesh) {
      // animated limbs leave the rest-pose bounds: the robot's own range check decides what is drawn
      o.frustumCulled = false;
      o.castShadow = opts.castShadow ?? true;
      if (o instanceof SkinnedMesh) meshes.push(o);
    }
  });
  const player = new ClipPlayer(copy, model.clips);
  return {
    root,
    player,
    meshes,
    dispose() {
      player.dispose();
      for (const m of meshes) m.skeleton.dispose();
      root.removeFromParent();
    },
  };
}

function disposeMaterial(m: Material): void {
  for (const value of Object.values(m)) {
    if (value && typeof value === 'object' && (value as Texture).isTexture) (value as Texture).dispose();
  }
  m.dispose();
}

/** Releases the geometry, materials and textures of every loaded model and forgets them. */
export function disposeAuthored(): void {
  for (const model of models.values()) {
    model.scene.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) disposeMaterial(m);
      }
    });
  }
  models.clear();
}
