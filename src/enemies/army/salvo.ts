/** Telegraphed salvo: idle -> telegraph (missile cells open and glow) -> N rockets -> cooldown (pure). */
export type SalvoPhase = 'idle' | 'telegraph' | 'firing' | 'cooldown';

export interface Salvo {
  phase: SalvoPhase;
  /** Seconds in the current phase (or until the next rocket while firing). */
  timer: number;
  shotsLeft: number;
}

export interface SalvoConfig {
  telegraphTime: number;
  shotInterval: number;
  cooldown: number;
}

export function createSalvo(cooldownLeft = 0): Salvo {
  return { phase: cooldownLeft > 0 ? 'cooldown' : 'idle', timer: 0, shotsLeft: 0 };
}

/** Starts the telegraph for a salvo of `size` rockets (only from idle). */
export function beginSalvo(s: Salvo, size: number): boolean {
  if (s.phase !== 'idle') return false;
  s.phase = 'telegraph';
  s.timer = 0;
  s.shotsLeft = size;
  return true;
}

/** Cancels an unfired telegraph (target lost); a started salvo always finishes. */
export function abortTelegraph(s: Salvo): void {
  if (s.phase === 'telegraph') {
    s.phase = 'idle';
    s.timer = 0;
    s.shotsLeft = 0;
  }
}

/** Advances the salvo by `dt`. Returns how many rockets must be fired this step (0 or 1). */
export function stepSalvo(s: Salvo, dt: number, cfg: SalvoConfig): number {
  switch (s.phase) {
    case 'idle':
      return 0;
    case 'telegraph':
      s.timer += dt;
      if (s.timer >= cfg.telegraphTime) {
        s.phase = 'firing';
        s.timer = 0; // first rocket leaves immediately
      }
      return 0;
    case 'firing': {
      s.timer -= dt;
      if (s.timer > 0) return 0;
      s.shotsLeft--;
      if (s.shotsLeft <= 0) {
        s.phase = 'cooldown';
        s.timer = 0;
      } else {
        s.timer = cfg.shotInterval;
      }
      return 1;
    }
    case 'cooldown':
      s.timer += dt;
      if (s.timer >= cfg.cooldown) {
        s.phase = 'idle';
        s.timer = 0;
      }
      return 0;
  }
}

/** Glow level 0..1 of the missile cells: ramps during the telegraph, stays lit while firing, fades after. */
export function glowLevel(s: Salvo, cfg: SalvoConfig): number {
  switch (s.phase) {
    case 'telegraph':
      return Math.min(1, s.timer / cfg.telegraphTime);
    case 'firing':
      return 1;
    case 'cooldown':
      return Math.max(0, 1 - s.timer / 0.6);
    default:
      return 0;
  }
}
