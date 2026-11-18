import { STRIKER } from './tunables';

/**
 * Striker weapon cycle (pure): `idle` -> `burst` (3 rounds) -> `idle` ..., and every 6 to 9 seconds
 * `idle` -> `telegraph` (pods glow, the mech stands still) -> rocket -> `recover` -> `idle`.
 */
export type AttackPhase = 'idle' | 'burst' | 'telegraph' | 'recover';

export interface Attack {
  phase: AttackPhase;
  /** Seconds to the next round (burst), or in the phase (telegraph, recover). */
  timer: number;
  shotsLeft: number;
  /** Seconds until a burst may start / until a rocket telegraph may start. */
  burstCooldown: number;
  rocketCooldown: number;
}

export interface AttackConfig {
  burst: { size: number; interval: number; period: number };
  rocket: { minGap: number; maxGap: number; telegraph: number; recover: number; firstGap: number };
}

export const ATTACK_CONFIG: AttackConfig = STRIKER;

export interface AttackStep {
  /** Rounds to fire this tick (0 or 1) and rockets to launch this tick (0 or 1). */
  bullets: number;
  rockets: number;
}

export function createAttack(cfg: AttackConfig = ATTACK_CONFIG, rand: () => number = Math.random): Attack {
  return { phase: 'idle', timer: 0, shotsLeft: 0, burstCooldown: 0, rocketCooldown: cfg.rocket.firstGap + rand() * (cfg.rocket.maxGap - cfg.rocket.minGap) };
}

/** Seconds from the first to the last round of a burst. */
export function burstDuration(cfg: AttackConfig = ATTACK_CONFIG): number {
  return (cfg.burst.size - 1) * cfg.burst.interval;
}

/** A rocket gap in [minGap, maxGap] for `rand` in [0, 1). */
export function rocketGap(rand: number, cfg: AttackConfig = ATTACK_CONFIG): number {
  return cfg.rocket.minGap + rand * (cfg.rocket.maxGap - cfg.rocket.minGap);
}

/** Drops an unfired telegraph (target lost, state change); a started burst always finishes. */
export function abortAttack(a: Attack): void {
  if (a.phase === 'telegraph') {
    a.phase = 'idle';
    a.timer = 0;
  }
}

const result: AttackStep = { bullets: 0, rockets: 0 };

/**
 * Advances the cycle by `dt`. `canFire` = target in range with line of sight. The returned object is reused.
 * A rocket takes priority over a burst when both are due.
 */
export function stepAttack(a: Attack, dt: number, canFire: boolean, rand: () => number = Math.random, cfg: AttackConfig = ATTACK_CONFIG): AttackStep {
  result.bullets = 0;
  result.rockets = 0;
  a.burstCooldown = Math.max(0, a.burstCooldown - dt);
  if (a.phase !== 'telegraph') a.rocketCooldown = Math.max(0, a.rocketCooldown - dt);
  switch (a.phase) {
    case 'idle':
      if (!canFire) break;
      if (a.rocketCooldown <= 0) {
        a.phase = 'telegraph';
        a.timer = 0;
      } else if (a.burstCooldown <= 0) {
        a.phase = 'burst';
        a.shotsLeft = cfg.burst.size;
        a.timer = 0; // first round leaves immediately
      }
      break;
    case 'burst':
      a.timer -= dt;
      if (a.timer <= 0) {
        result.bullets = 1;
        a.shotsLeft--;
        if (a.shotsLeft <= 0) {
          a.phase = 'idle';
          a.burstCooldown = Math.max(0, cfg.burst.period - burstDuration(cfg));
        } else {
          a.timer = cfg.burst.interval;
        }
      }
      break;
    case 'telegraph':
      if (!canFire) {
        abortAttack(a);
        break;
      }
      a.timer += dt;
      if (a.timer >= cfg.rocket.telegraph) {
        result.rockets = 1;
        a.phase = 'recover';
        a.timer = 0;
        // launch to launch is the gap: the cooldown only has to cover what is left after the next telegraph
        a.rocketCooldown = Math.max(0, rocketGap(rand(), cfg) - cfg.rocket.telegraph);
      }
      break;
    case 'recover':
      a.timer += dt;
      if (a.timer >= cfg.rocket.recover) {
        a.phase = 'idle';
        a.timer = 0;
        a.burstCooldown = Math.max(a.burstCooldown, 0.4);
      }
      break;
  }
  return result;
}

/** Glow level 0..1 of the rocket pods: ramps during the telegraph, flashes at the launch, fades while recovering. */
export function podGlow(a: Attack, cfg: AttackConfig = ATTACK_CONFIG): number {
  switch (a.phase) {
    case 'telegraph':
      return Math.min(1, a.timer / cfg.rocket.telegraph);
    case 'recover':
      return Math.max(0, 1 - a.timer / 0.5);
    default:
      return 0;
  }
}
