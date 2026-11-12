/**
 * Fixed-capacity object pool (GDD 13.4).
 *
 * When the pool is exhausted `acquire()` returns null: callers must drop the (least important)
 * effect instead of allocating without bound.
 *
 *   const pool = new ObjectPool({ create: () => new Tracer(), reset: (t) => t.hide(), capacity: 24 });
 *   const t = pool.acquire(); if (t) { ...; pool.release(t); }
 */
export interface ObjectPoolOptions<T> {
  create: () => T;
  /** Called on release (and on creation when `prewarm` is used) to return the object to a neutral state. */
  reset?: (item: T) => void;
  /** Called for every created object when the pool is disposed. */
  dispose?: (item: T) => void;
  /** Hard cap on live + free objects. */
  capacity: number;
  /** Number of objects to create up front. */
  prewarm?: number;
}

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly live = new Set<T>();
  private created = 0;
  private dropped = 0;

  constructor(private readonly options: ObjectPoolOptions<T>) {
    if (options.capacity <= 0) throw new Error('ObjectPool capacity must be > 0');
    const prewarm = Math.min(options.prewarm ?? 0, options.capacity);
    for (let i = 0; i < prewarm; i++) {
      const item = options.create();
      this.created++;
      options.reset?.(item);
      this.free.push(item);
    }
  }

  acquire(): T | null {
    let item = this.free.pop();
    if (item === undefined) {
      if (this.created >= this.options.capacity) {
        this.dropped++;
        return null;
      }
      item = this.options.create();
      this.created++;
    }
    this.live.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.live.delete(item)) return; // double release or foreign object: ignore
    this.options.reset?.(item);
    this.free.push(item);
  }

  /** Release every live object (e.g. on restart). */
  releaseAll(): void {
    for (const item of [...this.live]) this.release(item);
  }

  forEachLive(fn: (item: T) => void): void {
    for (const item of this.live) fn(item);
  }

  get liveCount(): number {
    return this.live.size;
  }

  get freeCount(): number {
    return this.free.length;
  }

  get capacity(): number {
    return this.options.capacity;
  }

  /** Number of acquire() calls refused because the pool was full. */
  get droppedCount(): number {
    return this.dropped;
  }

  dispose(): void {
    const dispose = this.options.dispose;
    if (dispose) {
      for (const item of this.live) dispose(item);
      for (const item of this.free) dispose(item);
    }
    this.live.clear();
    this.free.length = 0;
    this.created = 0;
  }
}
