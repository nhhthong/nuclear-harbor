import { SPIDER_ROBOT } from '@/config/tunables';
import { SPIDER_LOCAL } from './tunables';

/** Observable spider states (GDD 6.2). */
export type SpiderState = 'patrol' | 'flank' | 'chase' | 'attack' | 'hop' | 'destroyed';

export interface SpiderBrainInput {
  state: SpiderState;
  timeInState: number;
  distance: number;
  hasLos: boolean;
  /** Seconds since the player was last seen; Infinity if never. */
  timeSinceSeen: number;
  playerAlive: boolean;
  /** The flank point has been reached. */
  flankReached: boolean;
  /** The player moved far from where the flank point was computed. */
  playerMovedFar: boolean;
  commanded: boolean;
  commandArrived: boolean;
}

export interface SpiderBrainConfig {
  detectionRange: number;
  attackRange: number;
  loseTargetTime: number;
  attackHysteresis: number;
  flankMinTime: number;
  flankTimeout: number;
}

export const SPIDER_BRAIN_CONFIG: SpiderBrainConfig = {
  detectionRange: SPIDER_ROBOT.detectionRange,
  attackRange: SPIDER_ROBOT.attackRange,
  loseTargetTime: SPIDER_ROBOT.loseTargetTime,
  attackHysteresis: SPIDER_LOCAL.attackRangeHysteresis,
  flankMinTime: SPIDER_LOCAL.flankMinTime,
  flankTimeout: SPIDER_LOCAL.flankTimeout,
};

/**
 * Pure decision function: state + perception -> next state. `hop` and `destroyed` are not decided
 * here (the robot starts/ends hops; the damage path destroys).
 */
export function decideSpider(i: SpiderBrainInput, cfg: SpiderBrainConfig = SPIDER_BRAIN_CONFIG): SpiderState {
  if (i.state === 'destroyed' || i.state === 'hop') return i.state;

  const sees = i.playerAlive && i.hasLos && i.distance <= cfg.detectionRange;
  const aware = i.playerAlive && (sees || i.timeSinceSeen < cfg.loseTargetTime);

  switch (i.state) {
    case 'patrol':
      if (aware) return 'flank';
      return i.commanded ? 'chase' : 'patrol';
    case 'flank':
      if (!aware) return 'patrol';
      if (i.timeInState < cfg.flankMinTime) return 'flank';
      if (i.flankReached || i.playerMovedFar || i.timeInState > cfg.flankTimeout) return 'chase';
      return 'flank';
    case 'chase':
      if (sees && i.distance <= cfg.attackRange) return 'attack';
      if (!aware) return i.commanded && !i.commandArrived ? 'chase' : 'patrol';
      return 'chase';
    case 'attack':
      if (!aware) return 'patrol';
      if (!i.hasLos || i.distance > cfg.attackRange * cfg.attackHysteresis) return 'chase';
      return 'attack';
  }
}

export interface XZ {
  x: number;
  z: number;
}

/** Snaps (x, z) to a walkable cell writing into `out`; returns false when none exists. */
export type SnapFn = (x: number, z: number, out: XZ) => boolean;

export interface FlankConfig {
  flankDistance: number;
  flankAngleDeg: number;
}

/**
 * Point `flankDistance` from the player, `flankAngleDeg` off the player's facing to `side`
 * (+1 = left/counter-clockwise seen from above, -1 = right), snapped to walkable ground. Falls
 * back to `selfPos` when nothing walkable is found.
 */
export function computeFlankPoint(
  playerPos: XZ,
  playerForward: XZ,
  selfPos: XZ,
  side: 1 | -1,
  cfg: FlankConfig,
  snap?: SnapFn,
  out: XZ = { x: 0, z: 0 },
): XZ {
  const a = side * ((cfg.flankAngleDeg * Math.PI) / 180);
  const c = Math.cos(a);
  const s = Math.sin(a);
  // rotate the facing about the vertical axis; positive angle turns towards the player's left
  const fx = playerForward.x;
  const fz = playerForward.z;
  const len = Math.hypot(fx, fz) || 1;
  const dx = (fx * c + fz * s) / len;
  const dz = (-fx * s + fz * c) / len;
  out.x = playerPos.x + dx * cfg.flankDistance;
  out.z = playerPos.z + dz * cfg.flankDistance;
  if (snap && !snap(out.x, out.z, out)) {
    out.x = selfPos.x;
    out.z = selfPos.z;
  }
  return out;
}
