import { BOSS } from '@/config/tunables';
import { resolveDamage } from '@/combat/damage';
import type { BossPhase } from '@/core/types';

export type BossModelEvent =
  | { type: 'phaseChanged'; phase: BossPhase }
  | { type: 'damaged'; hp: number; maxHp: number }
  | { type: 'defeated' };

export interface HitOutcome {
  dealt: number;
  absorbed: boolean;
  killed: boolean;
  events: BossModelEvent[];
}

export interface BossModelConfig {
  hp: number;
  awakeningDuration: number;
}

export const DEFAULT_BOSS_MODEL_CONFIG: BossModelConfig = {
  hp: BOSS.hp,
  awakeningDuration: BOSS.awakeningDuration,
};

/**
 * Pure Gunslinger Crab Mech combat model (spec 27): one HP pool, no weak points, no core stage.
 * Phases dormant -> awakening -> fight -> destroyed. Invulnerable while awakening. Events are returned as data.
 */
export class BossModel {
  phase: BossPhase = 'dormant';
  hp: number;
  private awakeningLeft = 0;

  constructor(private readonly config: BossModelConfig = DEFAULT_BOSS_MODEL_CONFIG) {
    this.hp = config.hp;
  }

  get maxHp(): number {
    return this.config.hp;
  }

  get vulnerable(): boolean {
    return this.phase === 'fight';
  }

  /** 0..1 share of HP left. */
  get hpFraction(): number {
    return this.config.hp > 0 ? this.hp / this.config.hp : 0;
  }

  /** `?bossphase=low`: start the fight with this share of the HP. */
  setHpFraction(f: number): void {
    this.hp = Math.max(1, Math.round(this.config.hp * Math.min(1, Math.max(0, f))));
  }

  spawn(): BossModelEvent[] {
    if (this.phase !== 'dormant') return [];
    this.phase = 'awakening';
    this.awakeningLeft = this.config.awakeningDuration;
    return [{ type: 'phaseChanged', phase: 'awakening' }];
  }

  update(dt: number): BossModelEvent[] {
    if (this.phase !== 'awakening') return [];
    this.awakeningLeft -= dt;
    if (this.awakeningLeft > 0) return [];
    this.phase = 'fight';
    return [{ type: 'phaseChanged', phase: 'fight' }];
  }

  /** Cinematic skipped: end the awakening now (same events as the timer running out). */
  finishAwakening(): BossModelEvent[] {
    if (this.phase !== 'awakening') return [];
    this.awakeningLeft = 0;
    return this.update(0);
  }

  /** Any hit on the body. Full damage while fighting, absorbed before and after. */
  hit(amount: number): HitOutcome {
    if (!this.vulnerable || this.hp <= 0) return { dealt: 0, absorbed: true, killed: false, events: [] };
    const r = resolveDamage(this.hp, { amount, zone: 'body' });
    this.hp = r.hpAfter;
    const events: BossModelEvent[] = [];
    if (r.dealt > 0) events.push({ type: 'damaged', hp: r.hpAfter, maxHp: this.config.hp });
    if (r.killed) {
      this.phase = 'destroyed';
      events.push({ type: 'phaseChanged', phase: 'destroyed' }, { type: 'defeated' });
    }
    return { dealt: r.dealt, absorbed: r.absorbed, killed: r.killed, events };
  }
}
