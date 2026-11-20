import { SAMPLE_BASE_URL } from './samples';
import { AUDIO } from './tunables';

export type SampleStatus = 'loading' | 'ready' | 'failed';

/**
 * Fetches and decodes the recorded samples (spec 32) from same-origin relative URLs. Every file is
 * independent: a missing or broken file only marks itself failed, and callers fall back to the
 * procedural recipe while a file is loading or failed. Disposable: dispose() aborts pending fetches
 * and drops the decoded buffers.
 */
export class SampleBank {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly status = new Map<string, SampleStatus>();
  private readonly pending = new Set<AbortController>();
  private disposed = false;
  private readyListeners: Array<(file: string) => void> = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    files: readonly string[],
    private readonly baseUrl: string = SAMPLE_BASE_URL,
    private readonly fetchFn: typeof fetch | undefined = typeof fetch === 'undefined' ? undefined : fetch.bind(globalThis),
  ) {
    for (const f of files) void this.load(f);
  }

  get(file: string): AudioBuffer | null {
    return this.buffers.get(file) ?? null;
  }

  isReady(file: string): boolean {
    return this.buffers.has(file);
  }

  statusOf(file: string): SampleStatus | 'unknown' {
    return this.status.get(file) ?? 'unknown';
  }

  /** Counts per status, for the test hooks. */
  summary(): Record<SampleStatus, number> {
    const out: Record<SampleStatus, number> = { loading: 0, ready: 0, failed: 0 };
    for (const s of this.status.values()) out[s] += 1;
    return out;
  }

  /** Called once per file when it becomes ready (loops start late this way). */
  onReady(fn: (file: string) => void): void {
    this.readyListeners.push(fn);
  }

  dispose(): void {
    this.disposed = true;
    for (const c of this.pending) c.abort();
    this.pending.clear();
    this.buffers.clear();
    this.readyListeners = [];
  }

  private async load(file: string): Promise<void> {
    this.status.set(file, 'loading');
    const fetchFn = this.fetchFn;
    if (!fetchFn) {
      this.status.set(file, 'failed');
      return;
    }
    const ctrl = typeof AbortController === 'undefined' ? null : new AbortController();
    if (ctrl) this.pending.add(ctrl);
    const timer = setTimeout(() => ctrl?.abort(), AUDIO.samples.fetchTimeoutMs);
    try {
      const init: RequestInit = ctrl ? { signal: ctrl.signal } : {};
      const res = await fetchFn(this.baseUrl + file, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();
      if (this.disposed) return;
      const buffer = await this.ctx.decodeAudioData(data);
      if (this.disposed) return;
      this.buffers.set(file, buffer);
      this.status.set(file, 'ready');
      for (const fn of this.readyListeners) fn(file);
    } catch {
      if (!this.disposed) this.status.set(file, 'failed');
    } finally {
      clearTimeout(timer);
      if (ctrl) this.pending.delete(ctrl);
    }
  }
}
