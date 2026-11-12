import type { RecipeId } from './recipes';

/**
 * Fixed-capacity delayed spawns for staged effects (boss defeat). Typed arrays only:
 * `schedule` returns false when full, `advance` calls back for every entry that came due.
 */
export class SpawnScheduler {
  private readonly time: Float32Array;
  private readonly data: Float32Array; // x, y, z, scale
  private readonly ids: Array<RecipeId | null>;
  count = 0;
  dropped = 0;

  constructor(readonly capacity: number) {
    this.time = new Float32Array(capacity);
    this.data = new Float32Array(capacity * 4);
    this.ids = new Array<RecipeId | null>(capacity).fill(null);
  }

  schedule(delay: number, id: RecipeId, x: number, y: number, z: number, scale: number): boolean {
    if (this.count >= this.capacity) {
      this.dropped++;
      return false;
    }
    const i = this.count++;
    this.time[i] = delay;
    this.ids[i] = id;
    this.data[i * 4] = x;
    this.data[i * 4 + 1] = y;
    this.data[i * 4 + 2] = z;
    this.data[i * 4 + 3] = scale;
    return true;
  }

  advance(dt: number, fire: (id: RecipeId, x: number, y: number, z: number, scale: number) => void): void {
    let i = 0;
    while (i < this.count) {
      const t = (this.time[i] as number) - dt;
      if (t > 0) {
        this.time[i] = t;
        i++;
        continue;
      }
      const id = this.ids[i] as RecipeId;
      const d = i * 4;
      const x = this.data[d] as number;
      const y = this.data[d + 1] as number;
      const z = this.data[d + 2] as number;
      const s = this.data[d + 3] as number;
      const last = --this.count;
      if (i !== last) {
        this.time[i] = this.time[last] as number;
        this.ids[i] = this.ids[last] as RecipeId;
        for (let k = 0; k < 4; k++) this.data[d + k] = this.data[last * 4 + k] as number;
      }
      this.ids[last] = null;
      fire(id, x, y, z, s);
    }
  }

  clear(): void {
    this.count = 0;
    this.ids.fill(null);
  }
}
