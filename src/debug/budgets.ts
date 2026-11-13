export interface BudgetLimits {
  readonly maxDrawCalls: number;
  readonly maxTriangles: number;
  readonly jsHeapWarnMb: number;
  readonly lowEndFps: number;
}

/** The subset of a snapshot that budgets look at. */
export interface BudgetInput {
  readonly drawCalls: number;
  readonly triangles: number;
  /** MB; NaN when `performance.memory` is unavailable. */
  readonly heapMb: number;
  /** True once fps stayed below the low-end target for the configured time. */
  readonly lowFpsSustained: boolean;
}

type BudgetKey = 'drawCalls' | 'triangles' | 'heap' | 'fps';

export interface BudgetWarning {
  readonly key: BudgetKey;
  readonly message: string;
}

/** Pure: list of exceeded budgets (GDD 13.9 "memory has a budget and warnings"). */
export function evaluateBudgets(input: BudgetInput, limits: BudgetLimits): BudgetWarning[] {
  const out: BudgetWarning[] = [];
  if (input.drawCalls > limits.maxDrawCalls) {
    out.push({ key: 'drawCalls', message: `draw calls ${input.drawCalls} > ${limits.maxDrawCalls}` });
  }
  if (input.triangles > limits.maxTriangles) {
    out.push({ key: 'triangles', message: `triangles ${input.triangles} > ${limits.maxTriangles}` });
  }
  if (Number.isFinite(input.heapMb) && input.heapMb > limits.jsHeapWarnMb) {
    out.push({ key: 'heap', message: `JS heap ${input.heapMb.toFixed(0)} MB > ${limits.jsHeapWarnMb} MB` });
  }
  if (input.lowFpsSustained) {
    out.push({ key: 'fps', message: `FPS below ${limits.lowEndFps} (sustained)` });
  }
  return out;
}

/** Tracks how long fps has continuously been below a threshold. No allocation. */
export class LowFpsTracker {
  private belowFor = 0;

  constructor(
    private readonly threshold: number,
    private readonly seconds: number,
  ) {}

  /** Feed one frame: current fps estimate and the frame's duration in seconds. */
  update(fps: number, dtSeconds: number): boolean {
    if (fps > 0 && fps < this.threshold) this.belowFor += dtSeconds;
    else this.belowFor = 0;
    return this.belowFor > this.seconds;
  }

  reset(): void {
    this.belowFor = 0;
  }
}
