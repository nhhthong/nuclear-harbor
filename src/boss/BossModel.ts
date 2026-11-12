import { BOSS } from '@/config/tunables';
import { resolveDamage } from '@/combat/damage';
import type { BossPhase } from '@/core/types';

export type BossModelEvent =
  | { type: 'phaseChanged'; phase: BossPhase }
  | { type: 'weakPointDamaged'; index: number; hp: number; maxHp: number }
  | { type: 'weakPointDestroyed'; index: number; remaining: number }
  | { type: 'coreExposed' }
  | { type: 'coreDamaged'; hp: number; maxHp: number }
  | { type: 'defeated' };

export interface HitOutcome {
  dealt: number;
  absorbed: boolean;
  killed: boolean;
  events: BossModelEvent[];
}

export interface BossModelConfig {
  weakPointCount: number;
  weakPointHp: number;
  coreHp: number;
  awakeningDuration: number;
  armorDamageMultiplier: number;
}

export const DEFAULT_BOSS_MODEL_CONFIG: BossModelConfig = {
  weakPointCount: BOSS.weakPointCount,
  weakPointHp: BOSS.weakPointHp,
  coreHp: BOSS.coreHp,
  awakeningDuration: BOSS.awakeningDuration,
  armorDamageMultiplier: BOSS.armorDamageMultiplier,
};

/**
 * Pure TITAN-04 combat model (GDD 9): four weak points, then the core. Phases
 * dormant -> awakening -> weakpoint-hunt -> core-exposed -> destroyed. Events are returned as data.
 */
export class BossModel {
  phase: BossPhase = 'dormant';
  readonly weakPoints: number[];
  coreHp: number;
  private awakeningLeft = 0;

  constructor(private readonly config: BossModelConfig = DEFAULT_BOSS_MODEL_CONFIG) {
    this.weakPoints = Array.from({ length: config.weakPointCount }, () => config.weakPointHp);
    this.coreHp = config.coreHp;
  }

  /** GDD 5.4: total HP the player has to chew through. */
  get totalHp(): number {
    return this.config.weakPointCount * this.config.weakPointHp + this.config.coreHp;
  }

  get destroyedFlags(): boolean[] {
    return this.weakPoints.map((hp) => hp <= 0);
  }

  get weakPointsAlive(): number {
    let n = 0;
    for (const hp of this.weakPoints) if (hp > 0) n++;
    return n;
  }

  get vulnerable(): boolean {
    return this.phase === 'weakpoint-hunt' || this.phase === 'core-exposed';
  }

  /** `?bossphase=core`: weak points already gone; the core opens once awakening ends. */
  destroyAllWeakPointsSilently(): void {
    if (this.phase !== 'dormant') return;
    this.weakPoints.fill(0);
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
    if (this.weakPointsAlive === 0) return this.exposeCore();
    this.phase = 'weakpoint-hunt';
    return [{ type: 'phaseChanged', phase: 'weakpoint-hunt' }];
  }

  /** Armour (hull, legs): absorbs everything (armorDamageMultiplier is 0). */
  hitArmor(amount: number): HitOutcome {
    const raw = this.vulnerable ? Math.max(0, amount) * this.config.armorDamageMultiplier : 0;
    return { dealt: raw, absorbed: raw <= 0, killed: false, events: [] };
  }

  hitWeakPoint(index: number, amount: number): HitOutcome {
    const hp = this.weakPoints[index];
    if (hp === undefined || hp <= 0 || !this.vulnerable) return { dealt: 0, absorbed: true, killed: false, events: [] };
    const r = resolveDamage(hp, { amount, zone: 'weakpoint' });
    this.weakPoints[index] = r.hpAfter;
    const events: BossModelEvent[] = [];
    if (r.dealt > 0) {
      events.push({ type: 'weakPointDamaged', index, hp: r.hpAfter, maxHp: this.config.weakPointHp });
    }
    if (r.killed) {
      events.push({ type: 'weakPointDestroyed', index, remaining: this.weakPointsAlive });
      if (this.weakPointsAlive === 0 && this.phase === 'weakpoint-hunt') events.push(...this.exposeCore());
    }
    return { dealt: r.dealt, absorbed: r.absorbed, killed: r.killed, events };
  }

  hitCore(amount: number): HitOutcome {
    if (this.phase !== 'core-exposed' || this.coreHp <= 0) return { dealt: 0, absorbed: true, killed: false, events: [] };
    const r = resolveDamage(this.coreHp, { amount, zone: 'core' });
    this.coreHp = r.hpAfter;
    const events: BossModelEvent[] = [];
    if (r.dealt > 0) events.push({ type: 'coreDamaged', hp: r.hpAfter, maxHp: this.config.coreHp });
    if (r.killed) {
      this.phase = 'destroyed';
      events.push({ type: 'phaseChanged', phase: 'destroyed' }, { type: 'defeated' });
    }
    return { dealt: r.dealt, absorbed: r.absorbed, killed: r.killed, events };
  }

  private exposeCore(): BossModelEvent[] {
    this.phase = 'core-exposed';
    return [{ type: 'phaseChanged', phase: 'core-exposed' }, { type: 'coreExposed' }];
  }
}
