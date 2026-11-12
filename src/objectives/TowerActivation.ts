export type CancelReason = 'left-range' | 'released' | 'died';

export interface ActivationInput {
  inRange: boolean;
  holding: boolean;
  playerAlive: boolean;
}

export interface ActivationResult {
  started: boolean;
  activated: boolean;
  cancelled: CancelReason | null;
  /** Current progress 0..1. */
  progress: number;
  /** True while progress is advancing this step. */
  active: boolean;
}

/** Pure per-tower hold-to-activate state machine (GDD 8.1). */
export class TowerActivation {
  private _progress = 0;
  private _active = false;
  private _done = false;

  constructor(
    private readonly holdSeconds: number,
    private readonly resetInstant: boolean,
    private readonly decayPerSecond = 1 / 2,
  ) {}

  get progress(): number {
    return this._progress;
  }

  get isActivated(): boolean {
    return this._done;
  }

  get isActivating(): boolean {
    return this._active;
  }

  /** Mark as activated without a hold (test hooks, `?towers=n`). */
  forceActivate(): void {
    this._done = true;
    this._active = false;
    this._progress = 1;
  }

  step(dt: number, input: ActivationInput): ActivationResult {
    const res: ActivationResult = { started: false, activated: false, cancelled: null, progress: this._progress, active: false };
    if (this._done) {
      res.progress = 1;
      return res;
    }
    const ok = input.playerAlive && input.inRange && input.holding;
    if (ok) {
      if (!this._active) {
        this._active = true;
        res.started = true;
      }
      this._progress = Math.min(1, this._progress + dt / this.holdSeconds);
      res.active = true;
      if (this._progress >= 1) {
        this._done = true;
        this._active = false;
        res.activated = true;
      }
    } else {
      if (this._active) {
        this._active = false;
        res.cancelled = !input.playerAlive ? 'died' : !input.inRange ? 'left-range' : 'released';
      }
      if (this._progress > 0) {
        this._progress = this.resetInstant ? 0 : Math.max(0, this._progress - dt * this.decayPerSecond);
      }
    }
    res.progress = this._progress;
    return res;
  }
}
