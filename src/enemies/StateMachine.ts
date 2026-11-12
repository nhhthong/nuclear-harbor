/** Tiny generic state holder with enter/exit hooks and time-in-state (no allocation per update). */
export interface StateHooks<S extends string> {
  onEnter?: (state: S, previous: S) => void;
  onExit?: (state: S, next: S) => void;
}

export class StateMachine<S extends string> {
  private current: S;
  private elapsed = 0;

  constructor(
    initial: S,
    private readonly hooks: StateHooks<S> = {},
  ) {
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  /** Seconds spent in the current state. */
  get timeInState(): number {
    return this.elapsed;
  }

  /** Returns true when the state changed. Setting the current state again is a no-op. */
  set(next: S): boolean {
    if (next === this.current) return false;
    const previous = this.current;
    this.hooks.onExit?.(previous, next);
    this.current = next;
    this.elapsed = 0;
    this.hooks.onEnter?.(next, previous);
    return true;
  }

  update(dt: number): void {
    this.elapsed += dt;
  }
}
