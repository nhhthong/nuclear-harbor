/**
 * Fixed-size ring buffer of frame times (milliseconds). `push` never allocates; the percentile
 * helper uses a preallocated scratch array.
 */
export class FrameStats {
  private readonly samples: Float64Array;
  private readonly scratch: Float64Array;
  private head = 0;
  private filled = 0;

  constructor(readonly capacity = 240) {
    this.samples = new Float64Array(capacity);
    this.scratch = new Float64Array(capacity);
  }

  get count(): number {
    return this.filled;
  }

  push(frameMs: number): void {
    this.samples[this.head] = frameMs;
    this.head = (this.head + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled++;
  }

  reset(): void {
    this.head = 0;
    this.filled = 0;
  }

  get avgMs(): number {
    if (this.filled === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.filled; i++) sum += this.samples[i] ?? 0;
    return sum / this.filled;
  }

  get maxMs(): number {
    let max = 0;
    for (let i = 0; i < this.filled; i++) max = Math.max(max, this.samples[i] ?? 0);
    return max;
  }

  get fps(): number {
    const avg = this.avgMs;
    return avg > 0 ? 1000 / avg : 0;
  }

  /** FPS of the slowest 1% of frames (at least one frame). */
  get onePercentLowFps(): number {
    if (this.filled === 0) return 0;
    const n = this.filled;
    for (let i = 0; i < n; i++) this.scratch[i] = this.samples[i] ?? 0;
    const view = this.scratch.subarray(0, n);
    view.sort();
    const k = Math.max(1, Math.ceil(n * 0.01));
    let sum = 0;
    for (let i = n - k; i < n; i++) sum += view[i] ?? 0;
    const avgWorst = sum / k;
    return avgWorst > 0 ? 1000 / avgWorst : 0;
  }
}
