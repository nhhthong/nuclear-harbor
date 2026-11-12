export interface VoiceLimits {
  priority: number;
  maxInstances: number;
  cooldownMs: number;
}

export type Acquire =
  | { granted: true; voiceId: number; stolen: number | null }
  | { granted: false; reason: 'cooldown' | 'priority' };

interface Active {
  voiceId: number;
  id: string;
  priority: number;
  startedMs: number;
  seq: number;
}

/**
 * Pure voice bookkeeping: global cap, per-sound instance limit and cooldown (rate limit).
 * Stealing picks the lowest priority voice, oldest first; a new voice never steals a more
 * important one. Time is injected so the class is deterministic in tests.
 */
export class VoiceAllocator<Id extends string> {
  private readonly active = new Map<number, Active>();
  private readonly lastStart = new Map<Id, number>();
  private readonly played = new Map<Id, number>();
  private nextVoice = 1;
  private seq = 0;
  private peakActive = 0;

  constructor(
    readonly cap: number,
    private readonly limits: (id: Id) => VoiceLimits,
  ) {}

  get activeCount(): number {
    return this.active.size;
  }

  get peak(): number {
    return this.peakActive;
  }

  activeOf(id: Id): number {
    let n = 0;
    for (const v of this.active.values()) if (v.id === id) n++;
    return n;
  }

  playedCount(id: Id): number {
    return this.played.get(id) ?? 0;
  }

  acquire(id: Id, nowMs: number): Acquire {
    const lim = this.limits(id);
    const last = this.lastStart.get(id);
    if (last !== undefined && nowMs - last < lim.cooldownMs) return { granted: false, reason: 'cooldown' };

    let stolen: number | null = null;
    if (this.activeOf(id) >= lim.maxInstances) {
      stolen = this.pickVictim((v) => v.id === id)?.voiceId ?? null;
    } else if (this.active.size >= this.cap) {
      const victim = this.pickVictim(() => true);
      if (!victim || victim.priority > lim.priority) return { granted: false, reason: 'priority' };
      stolen = victim.voiceId;
    }
    if (stolen !== null) this.active.delete(stolen);

    const voiceId = this.nextVoice++;
    this.active.set(voiceId, { voiceId, id, priority: lim.priority, startedMs: nowMs, seq: this.seq++ });
    this.lastStart.set(id, nowMs);
    this.played.set(id, (this.played.get(id) ?? 0) + 1);
    if (this.active.size > this.peakActive) this.peakActive = this.active.size;
    return { granted: true, voiceId, stolen };
  }

  /** Idempotent: releasing an unknown (already stolen/released) voice is a no-op. */
  release(voiceId: number): void {
    this.active.delete(voiceId);
  }

  private pickVictim(filter: (v: Active) => boolean): Active | null {
    let best: Active | null = null;
    for (const v of this.active.values()) {
      if (!filter(v)) continue;
      if (!best || v.priority < best.priority || (v.priority === best.priority && v.seq < best.seq)) best = v;
    }
    return best;
  }
}
