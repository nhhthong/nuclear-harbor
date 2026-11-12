import { PERFORMANCE } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { summarise, type BenchmarkReport, type ResourceCounts } from './benchmark';
import { evaluateBudgets, LowFpsTracker } from './budgets';
import { ColliderView } from './ColliderView';
import { FrameStats } from './FrameStats';
import { Overlay } from './Overlay';
import { collectContext, countEnemies, emptySnapshot, readResources, type PerfSnapshot } from './snapshot';
import { DEBUG_TUNABLES } from './tunables';

const COLLIDER_KEY = 'F4';
const DELTA_RESET_KEY = 'F6';
const EMA_ALPHA = 0.1;
const BENCH_INITIAL_FRAMES = 240 * 10;

const zeroCounts = (): ResourceCounts => ({ geometries: 0, textures: 0, programs: 0, tracked: 0, heapMb: 0 });

/**
 * Performance monitor, debug overlay, collider view and benchmark recorder (GDD 13.8, 13.9, 16, 15 M3).
 * Own rAF sampler so frame time is correct in menus too; `update()` is not used.
 */
export function createDebugModule(): GameModule {
  let ctx: GameContext | null = null;
  let overlay: Overlay | null = null;
  let colliders: ColliderView | null = null;
  let rafId = 0;
  let onKey: ((e: KeyboardEvent) => void) | null = null;
  let offWorldReady: (() => void) | null = null;
  let disposeScope: (() => void) | null = null;

  const stats = new FrameStats(DEBUG_TUNABLES.frameWindow);
  const lowFps = new LowFpsTracker(PERFORMANCE.lowEndFps, DEBUG_TUNABLES.lowFpsSeconds);
  const snap = emptySnapshot();
  const baseline = zeroCounts();
  const current = zeroCounts();
  const delta = zeroCounts();
  let lastFrameMs = 0;
  let emaMs = 0;
  let lowFpsSustained = false;
  let lastRefreshMs = -Infinity;
  let lastTickMs = 0;
  let lastFixedTick = 0;
  let ticksPerSec = 0;

  // benchmark state
  let benchActive = false;
  let benchMs = 0;
  let benchTargetMs = 0;
  let benchSeconds = 0;
  let benchCount = 0;
  let benchFrame = new Float64Array(BENCH_INITIAL_FRAMES);
  let benchDraw = new Float64Array(BENCH_INITIAL_FRAMES);
  let benchTri = new Float64Array(BENCH_INITIAL_FRAMES);
  const benchStart = zeroCounts();
  let benchResolve: ((r: BenchmarkReport) => void) | null = null;
  let benchPromise: Promise<BenchmarkReport> | null = null;
  let lastReport: BenchmarkReport | null = null;
  let benchText: string | null = null;

  function fillSnapshot(c: GameContext, s: PerfSnapshot): void {
    collectContext(c, s);
    s.fps = stats.fps;
    s.avgMs = stats.avgMs;
    s.onePercentLowFps = stats.onePercentLowFps;
    s.maxMs = stats.maxMs;
    s.fixedTicksPerSec = ticksPerSec;
    s.lowFpsSustained = lowFpsSustained;
    s.warnings = evaluateBudgets(s, PERFORMANCE);
  }

  function growBench(): void {
    const size = benchFrame.length * 2;
    const grow = (a: Float64Array<ArrayBuffer>): Float64Array<ArrayBuffer> => {
      const n = new Float64Array(size);
      n.set(a);
      return n;
    };
    benchFrame = grow(benchFrame);
    benchDraw = grow(benchDraw);
    benchTri = grow(benchTri);
  }

  function finishBenchmark(c: GameContext): void {
    benchActive = false;
    const end = readResources(c, zeroCounts());
    const enemies = emptySnapshot().enemies;
    countEnemies(c, enemies);
    const report = summarise(
      { count: benchCount, frameMs: benchFrame, drawCalls: benchDraw, triangles: benchTri },
      { seconds: benchSeconds, start: { ...benchStart }, end, enemies, quality: c.renderer.qualityPreset, finishedAt: Date.now() },
    );
    lastReport = report;
    benchText = `BENCH ${report.fps.avg.toFixed(0)} fps avg, ${report.fps.onePercentLow.toFixed(0)} 1%low, maxDC ${report.maxDrawCalls}, dGeo ${report.delta.geometries} dTex ${report.delta.textures}`;
    console.log(`BENCH ${JSON.stringify(report)}`);
    const resolve = benchResolve;
    benchResolve = null;
    benchPromise = null;
    resolve?.(report);
  }

  function startBenchmark(seconds: number): Promise<BenchmarkReport> {
    if (benchPromise) return benchPromise;
    const c = ctx;
    if (!c) return Promise.reject(new Error('debug module not initialised'));
    benchSeconds = seconds;
    benchTargetMs = seconds * 1000;
    benchMs = 0;
    benchCount = 0;
    benchActive = true;
    benchText = `BENCH recording ${seconds}s ...`;
    readResources(c, benchStart);
    benchPromise = new Promise<BenchmarkReport>((resolve) => {
      benchResolve = resolve;
    });
    return benchPromise;
  }

  function resetDelta(): void {
    if (ctx) readResources(ctx, baseline);
  }

  function refresh(nowMs: number): void {
    const c = ctx;
    if (!c || !overlay) return;
    lastRefreshMs = nowMs;
    const elapsed = nowMs - lastTickMs;
    if (lastTickMs > 0 && elapsed > 0) ticksPerSec = ((c.clock.fixedTick - lastFixedTick) * 1000) / elapsed;
    lastTickMs = nowMs;
    lastFixedTick = c.clock.fixedTick;
    fillSnapshot(c, snap);
    readResources(c, current);
    delta.geometries = current.geometries - baseline.geometries;
    delta.textures = current.textures - baseline.textures;
    delta.tracked = current.tracked - baseline.tracked;
    overlay.render(snap, delta, benchText);
  }

  function frame(now: number): void {
    rafId = requestAnimationFrame(frame);
    const c = ctx;
    if (!c) return;
    if (lastFrameMs > 0) {
      const dt = now - lastFrameMs;
      stats.push(dt);
      emaMs = emaMs === 0 ? dt : emaMs + (dt - emaMs) * EMA_ALPHA;
      lowFpsSustained = lowFps.update(emaMs > 0 ? 1000 / emaMs : 0, dt / 1000);
      if (benchActive) {
        if (benchCount >= benchFrame.length) growBench();
        const info = c.renderer.webgl.info;
        benchFrame[benchCount] = dt;
        benchDraw[benchCount] = info.render.calls;
        benchTri[benchCount] = info.render.triangles;
        benchCount++;
        benchMs += dt;
        if (benchMs >= benchTargetMs) finishBenchmark(c);
      }
    }
    lastFrameMs = now;
    if (overlay?.isVisible) {
      if (now - lastRefreshMs >= 1000 / DEBUG_TUNABLES.overlayHz) refresh(now);
      colliders?.update(now);
    } else if (colliders?.isEnabled) {
      colliders.update(now);
    }
  }

  return {
    id: 'debug',

    init(context) {
      ctx = context;
      const res = context.resources.scope('debug');
      overlay = new Overlay(context.uiRoot);
      colliders = new ColliderView(context.scene, context.physics);
      res.track(colliders.object);
      disposeScope = () => res.dispose();

      const wantOverlay = context.flags.debug || context.flags.params.has('bench');
      overlay.setVisible(wantOverlay);
      if (context.flags.params.has('colliders')) colliders.setEnabled(true);
      resetDelta();

      onKey = (e: KeyboardEvent) => {
        if (e.repeat) return;
        const c = ctx;
        if (!c || !overlay) return;
        if (c.input.actionsForCode(e.code).includes('debugToggle')) {
          e.preventDefault();
          overlay.setVisible(!overlay.isVisible);
          if (overlay.isVisible) refresh(performance.now());
        } else if (e.code === COLLIDER_KEY) {
          e.preventDefault();
          colliders?.setEnabled(!colliders.isEnabled);
        } else if (e.code === DELTA_RESET_KEY) {
          e.preventDefault();
          resetDelta();
          if (overlay.isVisible) refresh(performance.now());
        }
      };
      window.addEventListener('keydown', onKey);

      context.testHooks.debug = {
        snapshot: (): PerfSnapshot => {
          const s = emptySnapshot();
          fillSnapshot(context, s);
          return s;
        },
        startBenchmark,
        get lastReport(): BenchmarkReport | null {
          return lastReport;
        },
      };

      const benchParam = context.flags.params.get('bench');
      if (benchParam !== null) {
        const seconds = Number(benchParam) || 20;
        offWorldReady = context.events.on('world:ready', () => {
          void startBenchmark(seconds);
        });
      }

      rafId = requestAnimationFrame(frame);
    },

    dispose() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      if (onKey) window.removeEventListener('keydown', onKey);
      onKey = null;
      offWorldReady?.();
      offWorldReady = null;
      overlay?.dispose();
      overlay = null;
      colliders?.dispose();
      colliders = null;
      disposeScope?.();
      disposeScope = null;
      if (ctx) delete ctx.testHooks.debug;
      ctx = null;
      benchActive = false;
    },
  };
}
