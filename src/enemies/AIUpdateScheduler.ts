import { AI_SCHEDULING } from '@/config/tunables';
import type { SimLevel } from '@/core/types';
import { ENEMY_LOCAL } from './tunables';

/** What the scheduler needs from an enemy. Timers live on the enemy so no maps are required. */
export interface Schedulable {
  readonly position: { x: number; y: number; z: number };
  readonly alive: boolean;
  simLevel: SimLevel;
  /** Uninterruptible states (e.g. charge wind-up) think at the near rate regardless of distance. */
  forceHighRate: boolean;
  /** Seconds accumulated since the last think; read as `dt` by the enemy's think. */
  thinkDt: number;
}

export function simLevelForDistance(distance: number): SimLevel {
  if (distance <= AI_SCHEDULING.nearDistance) return 'active';
  if (distance <= AI_SCHEDULING.dormantDistance) return 'simplified';
  return 'dormant';
}

/** Think rate (Hz) for a distance: near / mid / far bands; 0 = dormant (coarse interval). */
export function thinkHzForDistance(distance: number): number {
  if (distance <= AI_SCHEDULING.nearDistance) return AI_SCHEDULING.nearHz;
  if (distance <= AI_SCHEDULING.midDistance) return AI_SCHEDULING.midHz;
  if (distance <= AI_SCHEDULING.dormantDistance) return AI_SCHEDULING.farHz;
  return 0;
}

/** Seconds between thinks for a distance (dormant uses the coarse dormant interval). */
export function thinkInterval(distance: number, forceHighRate = false): number {
  if (forceHighRate) return 1 / AI_SCHEDULING.nearHz;
  const hz = thinkHzForDistance(distance);
  return hz > 0 ? 1 / hz : ENEMY_LOCAL.dormantInterval;
}

/**
 * Distance-based AI scheduler (GDD 13.7). `update` assigns each enemy its sim level and fills
 * `out` with the enemies that should think this tick (reused array: no allocation).
 */
export class AIUpdateScheduler {
  /** Fixed-step time carried between calls is tracked per enemy in `thinkDt`. */
  private readonly timers = new WeakMap<object, number>();

  update<T extends Schedulable>(
    enemies: readonly T[],
    playerX: number,
    playerZ: number,
    dt: number,
    out: T[],
  ): T[] {
    out.length = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e === undefined || !e.alive) continue;
      const dx = e.position.x - playerX;
      const dz = e.position.z - playerZ;
      const distance = Math.sqrt(dx * dx + dz * dz);
      e.simLevel = simLevelForDistance(distance);
      const timer = (this.timers.get(e) ?? 0) + dt;
      const interval = thinkInterval(distance, e.forceHighRate);
      if (timer >= interval) {
        e.thinkDt = timer;
        this.timers.set(e, 0);
        out.push(e);
      } else {
        this.timers.set(e, timer);
      }
    }
    return out;
  }
}
