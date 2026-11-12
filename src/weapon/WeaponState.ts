/**
 * Pure weapon state machine: magazine, reserve, fire cooldown and reload timer. No three.js, no DOM.
 * Driven by `step(dt, input)`; the returned object describes what happened during the tick and is
 * reused between calls (read it immediately).
 */
export interface WeaponStateConfig {
  magSize: number;
  startReserve: number;
  /** Rounds per second. */
  fireRate: number;
  reloadDuration: number;
  /** Automatic weapons shoot while the trigger is held; otherwise only on a fresh press. */
  automatic: boolean;
  /** Minimum seconds between dry-fire clicks. */
  dryFireInterval: number;
}

export interface WeaponInput {
  fireHeld: boolean;
  firePressed: boolean;
  reloadPressed: boolean;
}

export interface WeaponStepResult {
  shot: boolean;
  dryFire: boolean;
  reloadStarted: boolean;
  reloadFinished: boolean;
  /** Mag or reserve changed during this tick. */
  changed: boolean;
}

export class WeaponState {
  mag: number;
  reserve: number;
  private cooldown = 0;
  private reloadLeft = 0;
  private reloadingFlag = false;
  private readonly result: WeaponStepResult = {
    shot: false,
    dryFire: false,
    reloadStarted: false,
    reloadFinished: false,
    changed: false,
  };

  constructor(private readonly cfg: WeaponStateConfig) {
    this.mag = cfg.magSize;
    this.reserve = cfg.startReserve;
  }

  get reloading(): boolean {
    return this.reloadingFlag;
  }

  get reloadProgress(): number {
    return this.reloadingFlag ? 1 - this.reloadLeft / this.cfg.reloadDuration : 0;
  }

  step(dt: number, input: WeaponInput): WeaponStepResult {
    const r = this.result;
    r.shot = false;
    r.dryFire = false;
    r.reloadStarted = false;
    r.reloadFinished = false;
    r.changed = false;

    // keep at most one tick of carry-over so the long-run rate matches fireRate
    this.cooldown = Math.max(-dt, this.cooldown - dt);

    if (this.reloadingFlag) {
      this.reloadLeft -= dt;
      if (this.reloadLeft <= 0) {
        const moved = Math.min(this.cfg.magSize - this.mag, this.reserve);
        this.mag += moved;
        this.reserve -= moved;
        this.reloadingFlag = false;
        this.reloadLeft = 0;
        r.reloadFinished = true;
        r.changed = true;
      }
    }

    if (input.reloadPressed) this.tryStartReload(r);

    const trigger = this.cfg.automatic ? input.fireHeld || input.firePressed : input.firePressed;
    if (trigger && !this.reloadingFlag && this.cooldown <= 0) {
      if (this.mag > 0) {
        this.mag--;
        this.cooldown += 1 / this.cfg.fireRate;
        r.shot = true;
        r.changed = true;
      } else if (this.reserve > 0) {
        this.tryStartReload(r);
      } else {
        this.cooldown = this.cfg.dryFireInterval;
        r.dryFire = true;
      }
    }
    return r;
  }

  private tryStartReload(r: WeaponStepResult): void {
    if (this.reloadingFlag || this.mag >= this.cfg.magSize || this.reserve <= 0) return;
    this.reloadingFlag = true;
    this.reloadLeft = this.cfg.reloadDuration;
    r.reloadStarted = true;
  }

  /** Add rounds to the reserve. Returns true when the count changed. */
  grantAmmo(amount: number): boolean {
    if (!(amount > 0)) return false;
    this.reserve += Math.floor(amount);
    return true;
  }

  /** Make sure at least `floor` rounds are in reserve. Returns true when the count changed. */
  ensureReserveFloor(floor: number): boolean {
    if (this.reserve >= floor) return false;
    this.reserve = floor;
    return true;
  }

  /** Abort a running reload and clear the cooldown (death / respawn). */
  cancelReload(): void {
    this.reloadingFlag = false;
    this.reloadLeft = 0;
    this.cooldown = 0;
  }
}
