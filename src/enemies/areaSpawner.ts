import type { ZoneId } from '@/config/level';
import type { EnemySpawn } from './BaseEnemy';

/** Axis-aligned area on the ground. */
export interface AreaRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AreaSpawnerConfig {
  /** Robots alive at the same time, over all areas. */
  liveCap: number;
  /** An area wakes up when the player is inside its rectangle grown by this (m). */
  enterMargin: number;
  /** ...and goes back to sleep after the player stayed outside the rectangle grown by this (m)... */
  exitMargin: number;
  /** ...for this long (s). */
  exitDelay: number;
  /** Robots of a sleeping area are removed once the player is this far away (m). */
  despawnDistance: number;
  /** Nothing appears closer to the player than this (m). */
  minSpawnDistance: number;
  /** One spawn or despawn pass per interval (s): spreads the cost over frames. */
  interval: number;
}

/** What the spawner needs from a live robot. */
export interface LiveRobot {
  readonly id: string;
  readonly alive: boolean;
  readonly position: { x: number; z: number };
}

export interface AreaIo<R extends LiveRobot> {
  spawn(spawn: EnemySpawn): R | null;
  /** Silent removal: no explosion, no drop, no kill event. */
  despawn(robot: R): void;
}

interface Entry<R> {
  readonly spawn: EnemySpawn;
  readonly zone: ZoneId;
  state: 'waiting' | 'live' | 'dead';
  robot: R | null;
}

function inside(r: AreaRect, x: number, z: number, margin: number): boolean {
  return x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin;
}

/**
 * Streams the robot roster by area instead of spawning everything at load: an area's robots appear
 * when the player approaches it (never within `minSpawnDistance`, one per `interval`), and are removed
 * again once the player has left and is far away. Killed robots stay dead; removed survivors come back
 * when the area wakes up again. A global cap bounds the number of live robots.
 */
export class AreaSpawner<R extends LiveRobot> {
  private readonly entries: Entry<R>[];
  private readonly active = new Map<ZoneId, boolean>();
  private readonly away = new Map<ZoneId, number>();
  private timer = 0;

  constructor(
    roster: ReadonlyArray<{ spawn: EnemySpawn; zone: ZoneId }>,
    private readonly areas: Readonly<Record<ZoneId, AreaRect>>,
    private readonly cfg: AreaSpawnerConfig,
    private readonly io: AreaIo<R>,
  ) {
    this.entries = roster.map((r) => ({ spawn: r.spawn, zone: r.zone, state: 'waiting', robot: null }));
  }

  get liveCount(): number {
    let n = 0;
    for (const e of this.entries) if (e.state === 'live') n++;
    return n;
  }

  /** Robots not yet destroyed (live or waiting). */
  get remaining(): number {
    let n = 0;
    for (const e of this.entries) if (e.state !== 'dead') n++;
    return n;
  }

  isActive(zone: ZoneId): boolean {
    return this.active.get(zone) === true;
  }

  update(dt: number, px: number, pz: number): void {
    const { cfg } = this;
    for (const zone of Object.keys(this.areas) as ZoneId[]) {
      const rect = this.areas[zone];
      if (inside(rect, px, pz, cfg.enterMargin)) {
        this.active.set(zone, true);
        this.away.set(zone, 0);
      } else if (this.active.get(zone) && !inside(rect, px, pz, cfg.exitMargin)) {
        const t = (this.away.get(zone) ?? 0) + dt;
        this.away.set(zone, t);
        if (t >= cfg.exitDelay) this.active.set(zone, false);
      }
    }

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = cfg.interval;

    let live = 0;
    for (const e of this.entries) {
      if (e.state !== 'live') continue;
      const r = e.robot;
      if (!r || !r.alive) {
        // destroyed in combat
        e.state = 'dead';
        e.robot = null;
        continue;
      }
      if (!this.active.get(e.zone) && Math.hypot(r.position.x - px, r.position.z - pz) > cfg.despawnDistance) {
        this.io.despawn(r);
        e.state = 'waiting';
        e.robot = null;
        continue;
      }
      live++;
    }
    if (live >= cfg.liveCap) return;

    // one spawn per pass: the waiting post of an awake area nearest to the player, beyond the minimum
    let best: Entry<R> | null = null;
    let bestD = Infinity;
    for (const e of this.entries) {
      if (e.state !== 'waiting' || !this.active.get(e.zone)) continue;
      const d = Math.hypot(e.spawn.position.x - px, e.spawn.position.z - pz);
      if (d < cfg.minSpawnDistance || d >= bestD) continue;
      best = e;
      bestD = d;
    }
    if (!best) return;
    const robot = this.io.spawn(best.spawn);
    if (robot) {
      best.state = 'live';
      best.robot = robot;
    }
  }

  /** Marks a robot destroyed right away (called on the kill event, the next pass would also see it). */
  onDestroyed(id: string): void {
    for (const e of this.entries) {
      if (e.state === 'live' && e.robot?.id === id) {
        e.state = 'dead';
        e.robot = null;
        return;
      }
    }
  }
}
