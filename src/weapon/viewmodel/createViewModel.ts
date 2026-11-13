import { Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { GlbViewModel, type LoadedModel } from './GlbViewModel';
import { GLB_VIEW } from './glbTunables';
import { ProceduralViewModel } from './ProceduralViewModel';
import type { ViewModel, ViewModelState } from './ViewModel';

/** Loads the converted model; injectable so tests can simulate failures. */
type ModelLoader = () => Promise<LoadedModel>;

export interface ViewModelOptions {
  loader?: ModelLoader;
  /** Called once with the reason when the GLB cannot be used. */
  onFallback?: (error: unknown) => void;
}

/** Default loader: same-origin GLB next to the page, parsed by the bundled GLTFLoader (no CDN). */
function defaultGlbLoader(): Promise<LoadedModel> {
  const url = new URL(GLB_VIEW.url, document.baseURI).href;
  return new GLTFLoader().loadAsync(url);
}

/**
 * Procedural placeholder first (always), swapped for the converted model only when it loads.
 * Any load/parse/build error keeps the placeholder and reports once (GDD 5.1 mandatory fallback).
 */
class SwitchableViewModel implements ViewModel {
  readonly object3d = new Group();
  readonly muzzleLocalPosition = new Vector3();
  readonly ejectionLocalPosition = new Vector3();
  /** The model currently shown (placeholder until the GLB is ready). */
  active: ViewModel;
  private disposed = false;

  constructor(
    private readonly res: ResourceTracker,
    options: ViewModelOptions,
  ) {
    this.active = new ProceduralViewModel(res);
    this.object3d.add(this.active.object3d);
    this.syncPoints();

    const loader = options.loader ?? defaultGlbLoader;
    let reported = false;
    const fail = (error: unknown): void => {
      if (reported) return;
      reported = true;
      if (options.onFallback) options.onFallback(error);
      else console.warn('[weapon] GLB view model unavailable, keeping procedural model:', error);
    };
    let pending: Promise<LoadedModel>;
    try {
      pending = loader();
    } catch (error) {
      fail(error);
      return;
    }
    pending.then(
      (model) => {
        if (this.disposed) {
          disposeLoaded(model);
          return;
        }
        try {
          const glb = new GlbViewModel(model, this.res);
          this.object3d.add(glb.object3d);
          this.active.dispose();
          this.active = glb;
          this.syncPoints();
        } catch (error) {
          disposeLoaded(model);
          fail(error);
        }
      },
      (error: unknown) => fail(error),
    );
  }

  /** Muzzle and ejection points of the active model, expressed in this wrapper's space. */
  private syncPoints(): void {
    const a = this.active;
    a.object3d.updateMatrix();
    this.muzzleLocalPosition.copy(a.muzzleLocalPosition).applyMatrix4(a.object3d.matrix);
    this.ejectionLocalPosition.copy(a.ejectionLocalPosition).applyMatrix4(a.object3d.matrix);
  }

  update(dt: number, state: ViewModelState): void {
    this.active.update(dt, state);
    this.syncPoints();
  }

  playFire(): void {
    this.active.playFire();
  }

  playReload(duration: number): void {
    this.active.playReload(duration);
  }

  dispose(): void {
    this.disposed = true;
    this.active.dispose();
    this.object3d.removeFromParent();
  }
}

function disposeLoaded(model: LoadedModel): void {
  model.scene?.traverse((node) => {
    const mesh = node as { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } | null } };
    mesh.geometry?.dispose();
    mesh.material?.map?.dispose();
    mesh.material?.dispose();
  });
}

/** True unless the page URL forces the placeholder (`?viewmodel=procedural`); the GLB is the default. */
export function wantsGlb(params: URLSearchParams): boolean {
  return params.get(GLB_VIEW.queryName) !== 'procedural';
}

/**
 * Factory used by the weapon module. The converted model is loaded lazily with automatic fallback to
 * the procedural one; `?viewmodel=procedural` skips the load entirely.
 */
export function createViewModel(res: ResourceTracker, params: URLSearchParams, options: ViewModelOptions = {}): ViewModel {
  if (!wantsGlb(params)) return new ProceduralViewModel(res);
  return new SwitchableViewModel(res, options);
}
