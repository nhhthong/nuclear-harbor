export interface CountdownStep {
  /** Whole-second values crossed during this step (descending), each reported once. */
  ticks: { remaining: number; critical: boolean }[];
  /** True only on the step where the countdown reached zero. */
  expired: boolean;
}

/** Pure countdown timer (GDD 8.2). Time never goes negative, `expired` fires exactly once. */
export class NuclearCountdown {
  private _remaining: number;
  private running = true;
  private hasExpired = false;
  private lastWhole: number;

  constructor(
    readonly total: number,
    private readonly criticalSeconds: number,
  ) {
    this._remaining = Math.max(0, total);
    this.lastWhole = Math.ceil(this._remaining);
  }

  get remaining(): number {
    return this._remaining;
  }

  get isRunning(): boolean {
    return this.running && !this.hasExpired;
  }

  get isExpired(): boolean {
    return this.hasExpired;
  }

  get critical(): boolean {
    return this._remaining < this.criticalSeconds;
  }

  stop(): void {
    this.running = false;
  }

  setRemaining(seconds: number): void {
    this._remaining = Math.max(0, seconds);
    this.lastWhole = Math.ceil(this._remaining);
  }

  step(dt: number): CountdownStep {
    const out: CountdownStep = { ticks: [], expired: false };
    if (!this.isRunning || dt <= 0) return out;
    this._remaining = Math.max(0, this._remaining - dt);
    const whole = Math.ceil(this._remaining);
    while (this.lastWhole > whole) {
      this.lastWhole -= 1;
      out.ticks.push({ remaining: this.lastWhole, critical: this.lastWhole < this.criticalSeconds });
    }
    if (this._remaining <= 0) {
      this.hasExpired = true;
      out.expired = true;
    }
    return out;
  }
}
