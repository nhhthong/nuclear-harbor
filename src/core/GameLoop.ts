import { SIM } from '@/config/tunables';

export interface GameLoopCallbacks {
  /** Fixed-step simulation (physics, AI, gameplay timers). `dt` is always 1 / fixedHz. */
  fixedUpdate(dt: number): void;
  /** Once per rendered frame, before render. `alpha` (0..1) = progress towards the next fixed step. */
  update(dt: number, alpha: number): void;
  render(): void;
  /** Once per rendered frame after render (input edge reset, stats). */
  endFrame?(frameDt: number): void;
}

export interface GameLoopOptions {
  fixedHz?: number;
  maxFrameDelta?: number;
  maxSubSteps?: number;
}

/**
 * Fixed-timestep accumulator (GDD 13.7: render loop independent from logic tick).
 *
 * `tick(nowMs)` is public and free of browser APIs so the stepping logic is unit-testable;
 * `start()` / `stop()` drive it from requestAnimationFrame.
 */
export class GameLoop {
  readonly fixedDt: number;
  private readonly maxFrameDelta: number;
  private readonly maxSubSteps: number;
  private accumulator = 0;
  private lastMs: number | null = null;
  private rafId: number | null = null;
  private lastRenderMs = -Infinity;

  /** When true, fixedUpdate/update are skipped but render still runs (pause, menus). */
  simulationPaused = false;
  /** Minimum interval between rendered frames in ms (0 = uncapped). Set from the FPS cap setting. */
  minFrameIntervalMs = 0;
  /** Counters for diagnostics and tests. */
  frameCount = 0;
  fixedTickCount = 0;
  /** Simulated seconds elapsed (advances only while not paused). */
  simTime = 0;

  constructor(
    private readonly callbacks: GameLoopCallbacks,
    options: GameLoopOptions = {},
  ) {
    this.fixedDt = 1 / (options.fixedHz ?? SIM.fixedHz);
    this.maxFrameDelta = options.maxFrameDelta ?? SIM.maxFrameDelta;
    this.maxSubSteps = options.maxSubSteps ?? SIM.maxSubSteps;
  }

  get running(): boolean {
    return this.rafId !== null;
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastMs = null;
    const frame = (now: number): void => {
      this.rafId = requestAnimationFrame(frame);
      if (this.minFrameIntervalMs > 0 && now - this.lastRenderMs < this.minFrameIntervalMs - 0.5) return;
      this.lastRenderMs = now;
      this.tick(now);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastMs = null;
  }

  /** Advance one rendered frame. Returns the number of fixed steps executed. */
  tick(nowMs: number): number {
    const frameDt = this.lastMs === null ? 0 : Math.min((nowMs - this.lastMs) / 1000, this.maxFrameDelta);
    this.lastMs = nowMs;
    let steps = 0;

    if (!this.simulationPaused) {
      this.accumulator += frameDt;
      while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
        this.callbacks.fixedUpdate(this.fixedDt);
        this.accumulator -= this.fixedDt;
        this.simTime += this.fixedDt;
        this.fixedTickCount++;
        steps++;
      }
      // drop the backlog instead of spiralling when the machine cannot keep up
      if (steps === this.maxSubSteps && this.accumulator >= this.fixedDt) this.accumulator = 0;
      this.callbacks.update(frameDt, this.accumulator / this.fixedDt);
    }

    this.callbacks.render();
    this.callbacks.endFrame?.(frameDt);
    this.frameCount++;
    return steps;
  }

  /** Forget accumulated time (call after a long pause / state change). */
  resetTiming(): void {
    this.accumulator = 0;
    this.lastMs = null;
  }
}
