import type { GameOverReason } from '@/core/types';

/**
 * Pure game-flow decisions (GDD 4.2, 8.2, 9.3; REVIEW #7). No three.js, DOM, Rapier or events:
 * the flow module feeds events in and acts on the returned decisions.
 */

export interface Checkpoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export type RunStatus = 'running' | 'died' | 'expired' | 'victoryPending' | 'won';

export interface RunStats {
  elapsed: number;
  kills: number;
  shots: number;
  hits: number;
  deaths: number;
  respawns: number;
  /** hits / shots, 0 without shots. */
  accuracy: number;
}

export interface BestResult {
  completed: boolean;
  bestTimeRemaining: number;
}

export class FlowState {
  private _status: RunStatus = 'running';
  private _checkpoint: Checkpoint;
  private _elapsed = 0;
  private _kills = 0;
  private _shots = 0;
  private _hits = 0;
  private _deaths = 0;
  private _respawns = 0;

  constructor(spawn: Checkpoint) {
    this._checkpoint = { ...spawn };
  }

  get status(): RunStatus {
    return this._status;
  }

  get checkpoint(): Checkpoint {
    return this._checkpoint;
  }

  /** True while the run is not decided yet (statistics keep counting). */
  private get live(): boolean {
    return this._status === 'running';
  }

  setCheckpoint(cp: Checkpoint): void {
    this._checkpoint = { ...cp };
  }

  /** `player:died`. Only a running run can be lost by death. */
  onPlayerDied(): { over: GameOverReason } | null {
    if (this._status !== 'running') return null;
    this._status = 'died';
    this._deaths++;
    return { over: 'player-died' };
  }

  /** `countdown:expired`. Only a running run can fail by expiry. */
  onCountdownExpired(): { over: GameOverReason } | null {
    if (this._status !== 'running') return null;
    this._status = 'expired';
    return { over: 'countdown-expired' };
  }

  /** `boss:defeated`: victory is announced after the collapse delay. */
  onBossDefeated(): boolean {
    if (this._status !== 'running') return false;
    this._status = 'victoryPending';
    return true;
  }

  completeVictory(): boolean {
    if (this._status !== 'victoryPending') return false;
    this._status = 'won';
    return true;
  }

  canRespawn(): boolean {
    return this._status === 'died';
  }

  /** Returns the checkpoint to revive at and resumes the run, or null when respawn is refused. */
  respawn(): Checkpoint | null {
    if (!this.canRespawn()) return null;
    this._status = 'running';
    this._respawns++;
    return this._checkpoint;
  }

  addTime(dt: number): void {
    if (this.live) this._elapsed += dt;
  }
  addKill(): void {
    if (this.live) this._kills++;
  }
  addShot(): void {
    if (this.live) this._shots++;
  }
  addHit(): void {
    if (this.live) this._hits++;
  }

  get stats(): RunStats {
    return {
      elapsed: this._elapsed,
      kills: this._kills,
      shots: this._shots,
      hits: this._hits,
      deaths: this._deaths,
      respawns: this._respawns,
      accuracy: this._shots > 0 ? this._hits / this._shots : 0,
    };
  }
}

/** Reads the stored best result; anything malformed counts as "none". */
export function parseBest(raw: string | null): BestResult | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const r = v as Record<string, unknown>;
    if (typeof r.completed !== 'boolean' || typeof r.bestTimeRemaining !== 'number' || !Number.isFinite(r.bestTimeRemaining)) {
      return null;
    }
    return { completed: r.completed, bestTimeRemaining: r.bestTimeRemaining };
  } catch {
    return null;
  }
}

/** A victory always marks the game completed; more time remaining is better. */
export function mergeBest(prev: BestResult | null, timeRemaining: number): BestResult {
  const t = Math.max(0, timeRemaining);
  return { completed: true, bestTimeRemaining: Math.max(prev?.bestTimeRemaining ?? 0, t) };
}
