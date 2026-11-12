import { BOSS } from '@/config/tunables';
import type { BossPhase } from '@/core/types';
import { BOSS_LOCAL, WEAK_POINT } from './tunables';

export type BossAttackKind = 'heavy-cannon' | 'ground-slam' | 'missile-barrage';

export const ATTACK_KINDS: readonly BossAttackKind[] = ['ground-slam', 'missile-barrage', 'heavy-cannon'];

export interface AbilityParams {
  cannonCooldown: number;
  slamRadius: number;
  missileCount: number;
  /** Multiplies every cooldown and the global interval (core-exposed speed-up). */
  cooldownFactor: number;
}

/** GDD 9.2: each destroyed weak point removes or weakens one ability. Radius is full-size metres. */
export function abilityParams(destroyed: readonly boolean[], phase: BossPhase): AbilityParams {
  const a = BOSS_LOCAL.abilities;
  let missileCount: number = BOSS.missileBarrage.count;
  if (destroyed[WEAK_POINT.left]) missileCount -= a.sideMissileCountReduction;
  if (destroyed[WEAK_POINT.right]) missileCount -= a.sideMissileCountReduction;
  return {
    cannonCooldown: BOSS.heavyCannon.cooldown * (destroyed[WEAK_POINT.front] ? a.frontCannonCooldownFactor : 1),
    slamRadius: BOSS.groundSlam.radius * (destroyed[WEAK_POINT.back] ? a.rearSlamRadiusFactor : 1),
    missileCount: Math.max(1, missileCount),
    cooldownFactor: phase === 'core-exposed' ? a.coreExposedCooldownFactor : 1,
  };
}

export interface SchedulerInput {
  phase: BossPhase;
  destroyed: readonly boolean[];
  /** Horizontal distance boss to player. */
  playerDistance: number;
}

export interface AttackStep {
  kind: 'telegraph' | 'impact';
  attack: BossAttackKind;
  /** Telegraph duration (s). */
  duration: number;
  /** Danger radius: slam radius (scaled), cannon/missile splash radius. */
  radius: number;
  /** Missile count for the barrage, else 1. */
  count: number;
}

interface Active {
  attack: BossAttackKind;
  remaining: number;
  duration: number;
  radius: number;
  count: number;
}

const TELEGRAPH: Record<BossAttackKind, number> = {
  'heavy-cannon': BOSS.heavyCannon.telegraph,
  'ground-slam': BOSS.groundSlam.telegraph,
  'missile-barrage': BOSS.missileBarrage.telegraph,
};

/**
 * Pure attack scheduler: global interval, per-attack cooldown, selection by range and phase and
 * the telegraph -> impact timeline. One attack runs at a time. `scale` shrinks distances for the
 * sandbox boss.
 */
export class AttackScheduler {
  private readonly cooldowns: Record<BossAttackKind, number> = {
    'heavy-cannon': 0,
    'ground-slam': 0,
    'missile-barrage': 0,
  };
  private interval: number = BOSS.attackInterval;
  private active: Active | null = null;
  private last: BossAttackKind | null = null;

  constructor(private readonly scale = 1) {}

  get busy(): boolean {
    return this.active !== null;
  }

  get activeAttack(): BossAttackKind | null {
    return this.active?.attack ?? null;
  }

  cooldownOf(attack: BossAttackKind): number {
    return this.cooldowns[attack];
  }

  /** Respawn / restart: timers back to the start, nothing in flight. */
  reset(): void {
    this.active = null;
    this.last = null;
    this.interval = BOSS.attackInterval;
    for (const k of ATTACK_KINDS) this.cooldowns[k] = 0;
  }

  update(dt: number, input: SchedulerInput): AttackStep | null {
    if (input.phase !== 'weakpoint-hunt' && input.phase !== 'core-exposed') {
      this.active = null;
      return null;
    }
    for (const k of ATTACK_KINDS) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    if (this.active) {
      this.active.remaining -= dt;
      if (this.active.remaining > 0) return null;
      const a = this.active;
      this.active = null;
      this.interval = BOSS.attackInterval * abilityParams(input.destroyed, input.phase).cooldownFactor;
      return { kind: 'impact', attack: a.attack, duration: a.duration, radius: a.radius, count: a.count };
    }
    this.interval = Math.max(0, this.interval - dt);
    if (this.interval > 0) return null;
    const choice = this.choose(input);
    return choice ? this.begin(choice, input) : null;
  }

  /** Start an attack now regardless of range, cooldown and interval (test hook). */
  force(attack: BossAttackKind, input: SchedulerInput): AttackStep | null {
    if (this.active) return null;
    if (input.phase !== 'weakpoint-hunt' && input.phase !== 'core-exposed') return null;
    return this.begin(attack, input);
  }

  private choose(input: SchedulerInput): BossAttackKind | null {
    const p = abilityParams(input.destroyed, input.phase);
    const r = BOSS_LOCAL.ranges;
    const d = input.playerDistance;
    const s = this.scale;
    const eligible = (k: BossAttackKind): boolean => {
      if (this.cooldowns[k] > 0) return false;
      if (k === 'ground-slam') return d <= p.slamRadius * s;
      if (k === 'missile-barrage') return d >= r.missileMin * s && d <= r.missileMax * s;
      return d >= r.cannonMin * s && d <= r.cannonMax * s;
    };
    const candidates = ATTACK_KINDS.filter(eligible);
    const fresh = candidates.filter((k) => k !== this.last);
    return fresh[0] ?? candidates[0] ?? null;
  }

  private begin(attack: BossAttackKind, input: SchedulerInput): AttackStep {
    const p = abilityParams(input.destroyed, input.phase);
    const duration = TELEGRAPH[attack];
    let radius: number;
    let count = 1;
    let cooldown: number;
    if (attack === 'ground-slam') {
      radius = p.slamRadius * this.scale;
      cooldown = BOSS.groundSlam.cooldown;
    } else if (attack === 'missile-barrage') {
      radius = BOSS.missileBarrage.splashRadius;
      count = p.missileCount;
      cooldown = BOSS.missileBarrage.cooldown;
    } else {
      radius = BOSS.heavyCannon.splashRadius;
      cooldown = p.cannonCooldown;
    }
    this.cooldowns[attack] = cooldown * p.cooldownFactor;
    this.active = { attack, remaining: duration, duration, radius, count };
    this.last = attack;
    return { kind: 'telegraph', attack, duration, radius, count };
  }
}

// ---- geometry helpers (pure, shared by the module) ------------------------------------------

export interface XZ {
  x: number;
  z: number;
}

/** Clamp a point into the arena disc (radius minus margin). */
export function clampToArena(p: XZ, centre: XZ, radius: number, margin: number): XZ {
  const max = Math.max(0, radius - margin);
  const dx = p.x - centre.x;
  const dz = p.z - centre.z;
  const d = Math.hypot(dx, dz);
  if (d <= max || d === 0) return { x: p.x, z: p.z };
  return { x: centre.x + (dx / d) * max, z: centre.z + (dz / d) * max };
}

/** -1 retreat, 0 hold, +1 advance: keeps the boss inside the preferred distance band. */
export function rangeIntent(distance: number, min: number, max: number): -1 | 0 | 1 {
  if (distance > max) return 1;
  if (distance < min) return -1;
  return 0;
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Heavy cannon aim: where the player will stand when the telegraph ends. */
export function predictTarget(pos: XZ, velocity: XZ, lead: number): XZ {
  return { x: pos.x + velocity.x * lead, z: pos.z + velocity.z * lead };
}

/** Slam danger area: inside the radius and not standing on a perch above `safeHeight`. */
export function inSlamDanger(feet: { x: number; y: number; z: number }, centre: XZ, radius: number, safeHeight: number): boolean {
  return feet.y <= safeHeight && Math.hypot(feet.x - centre.x, feet.z - centre.z) <= radius;
}

/** Splash danger: distance from the blast point to the player's centre. */
export function inSplash(blast: { x: number; y: number; z: number }, centre: { x: number; y: number; z: number }, radius: number): boolean {
  return Math.hypot(blast.x - centre.x, blast.y - centre.y, blast.z - centre.z) <= radius;
}

/**
 * Missile impact points scattered around `centre` within `spread`: a spiral so markers do not
 * stack. `rand` returns [0,1) and only jitters the angle and radius.
 */
export function missileTargets(count: number, centre: XZ, spread: number, rand: () => number, out: XZ[] = []): XZ[] {
  out.length = 0;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const r = spread * Math.sqrt((i + 0.5 + (rand() - 0.5) * 0.3) / count);
    const a = phase + i * golden;
    out.push({ x: centre.x + Math.cos(a) * r, z: centre.z + Math.sin(a) * r });
  }
  return out;
}
