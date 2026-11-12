/** One benchmark sample (taken once per rendered frame). */
export interface BenchSamples {
  readonly count: number;
  readonly frameMs: ArrayLike<number>;
  readonly drawCalls: ArrayLike<number>;
  readonly triangles: ArrayLike<number>;
}

export interface ResourceCounts {
  geometries: number;
  textures: number;
  programs: number;
  tracked: number;
  heapMb: number;
}

export interface BenchmarkReport {
  seconds: number;
  frames: number;
  fps: { avg: number; min: number; onePercentLow: number };
  frameMs: { avg: number; max: number };
  maxDrawCalls: number;
  maxTriangles: number;
  start: ResourceCounts;
  end: ResourceCounts;
  /** end - start (steady scene should be ~0). */
  delta: ResourceCounts;
  enemies: { total: number; active: number; simplified: number; dormant: number };
  quality: string;
  /** Wall-clock timestamp (ms since epoch). */
  finishedAt: number;
}

export interface BenchContext {
  seconds: number;
  start: ResourceCounts;
  end: ResourceCounts;
  enemies: BenchmarkReport['enemies'];
  quality: string;
  finishedAt: number;
}

function diff(a: ResourceCounts, b: ResourceCounts): ResourceCounts {
  return {
    geometries: b.geometries - a.geometries,
    textures: b.textures - a.textures,
    programs: b.programs - a.programs,
    tracked: b.tracked - a.tracked,
    heapMb: b.heapMb - a.heapMb,
  };
}

/** Pure: reduce raw samples to the report written to the console as `BENCH {json}`. */
export function summarise(samples: BenchSamples, ctx: BenchContext): BenchmarkReport {
  const n = samples.count;
  let sum = 0;
  let maxMs = 0;
  let maxDraw = 0;
  let maxTri = 0;
  for (let i = 0; i < n; i++) {
    const ms = samples.frameMs[i] ?? 0;
    sum += ms;
    maxMs = Math.max(maxMs, ms);
    maxDraw = Math.max(maxDraw, samples.drawCalls[i] ?? 0);
    maxTri = Math.max(maxTri, samples.triangles[i] ?? 0);
  }
  const sorted = Array.from({ length: n }, (_, i) => samples.frameMs[i] ?? 0).sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(n * 0.01));
  let worst = 0;
  for (let i = n - k; i < n; i++) worst += sorted[i] ?? 0;
  const avgMs = n > 0 ? sum / n : 0;
  const worstAvg = n > 0 ? worst / k : 0;
  return {
    seconds: ctx.seconds,
    frames: n,
    fps: {
      avg: avgMs > 0 ? 1000 / avgMs : 0,
      min: maxMs > 0 ? 1000 / maxMs : 0,
      onePercentLow: worstAvg > 0 ? 1000 / worstAvg : 0,
    },
    frameMs: { avg: avgMs, max: maxMs },
    maxDrawCalls: maxDraw,
    maxTriangles: maxTri,
    start: ctx.start,
    end: ctx.end,
    delta: diff(ctx.start, ctx.end),
    enemies: ctx.enemies,
    quality: ctx.quality,
    finishedAt: ctx.finishedAt,
  };
}
