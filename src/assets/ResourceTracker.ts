import type { BufferGeometry, Material, Object3D, Texture } from 'three';

interface Disposable {
  dispose(): void;
}

type Trackable = Object3D | BufferGeometry | Material | Texture | Disposable;

function isObject3D(value: unknown): value is Object3D {
  return typeof value === 'object' && value !== null && (value as { isObject3D?: boolean }).isObject3D === true;
}

function isDisposable(value: unknown): value is Disposable {
  return typeof value === 'object' && value !== null && typeof (value as Disposable).dispose === 'function';
}

/**
 * Reference-counted ownership of GPU resources (GDD 13.8), after the three.js "cleanup" manual.
 *
 * Each module (or zone) gets its own scope via `ctx.resources.scope('world')`. Tracking the same
 * shared geometry/material/texture from several scopes increments one global refcount; a resource
 * is only `dispose()`d when the last scope that tracked it is disposed.
 *
 *   const res = ctx.resources.scope('enemies');
 *   const mesh = res.track(new Mesh(geo, mat));   // tracks mesh + its geometry, materials, textures
 *   ...
 *   res.dispose();                                // removes meshes from parents, disposes orphans
 *
 * Skeleton: listeners/timers/mixers can be registered with `onDispose`. T-17 extends this with
 * leak reporting.
 */
export class ResourceTracker {
  private readonly refCounts: Map<Disposable, number>;
  private readonly owned = new Set<Disposable>();
  private readonly objects = new Set<Object3D>();
  private readonly cleanups: Array<() => void> = [];
  private readonly children = new Map<string, ResourceTracker>();
  private disposed = false;

  constructor(
    readonly name = 'root',
    sharedRefCounts?: Map<Disposable, number>,
  ) {
    this.refCounts = sharedRefCounts ?? new Map();
  }

  /** Get (or create) a named child scope sharing the same refcount table. */
  scope(name: string): ResourceTracker {
    let child = this.children.get(name);
    if (!child || child.disposed) {
      child = new ResourceTracker(name, this.refCounts);
      this.children.set(name, child);
    }
    return child;
  }

  track<T extends Trackable | null | undefined>(resource: T): T {
    if (!resource) return resource;
    if (isObject3D(resource)) {
      this.objects.add(resource);
      resource.traverse((node) => {
        const mesh = node as Object3D & { geometry?: BufferGeometry; material?: Material | Material[] };
        if (mesh.geometry) this.retain(mesh.geometry);
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) this.trackMaterial(material);
        }
      });
    } else if ((resource as Material).isMaterial) {
      this.trackMaterial(resource as Material);
    } else if (isDisposable(resource)) {
      this.retain(resource);
    }
    return resource;
  }

  /** Register arbitrary teardown (event listeners, timers, AnimationMixers, workers). */
  onDispose(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** Number of distinct disposable resources this scope holds a reference to. */
  get resourceCount(): number {
    return this.owned.size;
  }

  /** Distinct live resources across all scopes sharing this table. */
  get totalLiveResources(): number {
    return this.refCounts.size;
  }

  refCountOf(resource: Disposable): number {
    return this.refCounts.get(resource) ?? 0;
  }

  stats(): Record<string, number> {
    const out: Record<string, number> = { [this.name]: this.owned.size };
    for (const [name, child] of this.children) {
      if (!child.disposed) out[`${this.name}/${name}`] = child.owned.size;
    }
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    for (const child of this.children.values()) child.dispose();
    this.children.clear();
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (error) {
        console.error(`[ResourceTracker:${this.name}] cleanup failed`, error);
      }
    }
    this.cleanups.length = 0;
    for (const object of this.objects) object.removeFromParent();
    this.objects.clear();
    for (const resource of this.owned) {
      const next = (this.refCounts.get(resource) ?? 1) - 1;
      if (next <= 0) {
        this.refCounts.delete(resource);
        resource.dispose();
      } else {
        this.refCounts.set(resource, next);
      }
    }
    this.owned.clear();
    this.disposed = true;
  }

  private trackMaterial(material: Material): void {
    this.retain(material);
    for (const value of Object.values(material)) {
      if (value && typeof value === 'object' && (value as Texture).isTexture) this.retain(value as Texture);
    }
  }

  private retain(resource: Disposable): void {
    if (this.owned.has(resource)) return;
    this.owned.add(resource);
    this.refCounts.set(resource, (this.refCounts.get(resource) ?? 0) + 1);
  }
}
