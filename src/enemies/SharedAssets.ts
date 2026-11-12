import type { BufferGeometry, Material } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';

/**
 * Keyed cache of geometry and materials shared by all robots of a type (GDD 6.4, constitution I).
 * Everything is tracked once in the enemies resource scope and released with it.
 */
export class SharedAssets {
  private readonly items = new Map<string, BufferGeometry | Material>();

  constructor(private readonly res: ResourceTracker) {}

  get<T extends BufferGeometry | Material>(key: string, make: () => T): T {
    let item = this.items.get(key);
    if (item === undefined) {
      item = this.res.track(make());
      this.items.set(key, item);
    }
    return item as T;
  }

  get size(): number {
    return this.items.size;
  }
}
