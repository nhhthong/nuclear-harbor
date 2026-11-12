import { Vector3 } from 'three';
import type { GameContext } from '@/core/GameContext';

/** Shared perception record, reused every think (no allocation). */
export interface Perception {
  playerAlive: boolean;
  /** Distance from the enemy to the player's eye (m). */
  distance: number;
  /** Eye-to-eye line of sight against the static world; only evaluated within `range`. */
  hasLos: boolean;
  /** Player eye position (valid after update). */
  playerEye: Vector3;
  lastSeenPos: Vector3;
  /** Sim time of the last sighting; -Infinity when never seen. */
  lastSeenTime: number;
  /** Seconds since last seen (Infinity when never). */
  timeSinceSeen: number;
}

export function createPerception(): Perception {
  return {
    playerAlive: true,
    distance: Infinity,
    hasLos: false,
    playerEye: new Vector3(),
    lastSeenPos: new Vector3(),
    lastSeenTime: -Infinity,
    timeSinceSeen: Infinity,
  };
}

/**
 * Refreshes distance, line of sight and last-seen memory. The LOS raycast is skipped beyond
 * `range` or when `withLos` is false (dormant robots).
 */
export function updatePerception(
  ctx: Pick<GameContext, 'player' | 'physics' | 'clock'>,
  from: Vector3,
  range: number,
  p: Perception,
  withLos = true,
): Perception {
  const player = ctx.player;
  player.getEyePosition(p.playerEye);
  p.playerAlive = player.alive;
  p.distance = from.distanceTo(p.playerEye);
  p.hasLos = withLos && p.playerAlive && p.distance <= range && ctx.physics.hasLineOfSight(from, p.playerEye);
  if (p.hasLos) {
    p.lastSeenTime = ctx.clock.simTime;
    p.lastSeenPos.copy(player.position);
  }
  p.timeSinceSeen = ctx.clock.simTime - p.lastSeenTime;
  return p;
}

/** Make the robot aware of the player right now (e.g. it was shot), without a sighting. */
export function markAware(ctx: Pick<GameContext, 'player' | 'clock'>, p: Perception): void {
  p.lastSeenTime = ctx.clock.simTime;
  p.lastSeenPos.copy(ctx.player.position);
  p.timeSinceSeen = 0;
}

/** Forget the target (respawn). */
export function forgetTarget(p: Perception): void {
  p.lastSeenTime = -Infinity;
  p.timeSinceSeen = Infinity;
  p.hasLos = false;
}
