import { WAREHOUSE } from '@/config/warehouse';
import { openingPoints, usableOpenings } from './openings';
import type { V3 } from './steering';

/**
 * Anti-camping call-in (spec 29): when the player stands on the mezzanine for `campSeconds`, drones are called in
 * from outside the north windows or the roller door. Pure: the manager feeds it the player position and counts.
 */

/** Feet on the mezzanine (or in the office on it): inside its x/z and above `floorY - yMargin`. */
export function onMezzanine(p: V3, yMargin: number): boolean {
  const m = WAREHOUSE.mezzanine;
  return p.x >= m.minX && p.x <= m.maxX && p.z >= m.minZ && p.z <= m.maxZ && p.y > m.floorY - yMargin;
}

export interface CallInConfig {
  campSeconds: number;
  count: number;
  maxAlive: number;
  maxPerRun: number;
}

export class CallInDirector {
  /** Seconds the player has stood on the mezzanine without a break. */
  camp = 0;
  /** Drones called in this run. */
  called = 0;
  /** Waves sent (rotates the spawn openings). */
  waves = 0;

  constructor(private readonly cfg: CallInConfig) {}

  /**
   * Returns how many drones to call in now (0 most of the time). `aliveCallIns`: call-in drones alive;
   * `liveTotal` / `liveCap`: all live robots and the global cap.
   */
  update(dt: number, camping: boolean, aliveCallIns: number, liveTotal: number, liveCap: number): number {
    if (!camping) {
      this.camp = 0;
      return 0;
    }
    this.camp += dt;
    if (this.camp < this.cfg.campSeconds) return 0;
    if (aliveCallIns >= this.cfg.maxAlive) return 0;
    const n = Math.min(this.cfg.count, this.cfg.maxPerRun - this.called, liveCap - liveTotal);
    if (n <= 0) return 0;
    this.called += n;
    this.waves++;
    this.camp = 0;
    return n;
  }

  /** New run (respawn does not reset the per-run cap). */
  reset(): void {
    this.camp = 0;
    this.called = 0;
    this.waves = 0;
  }
}

/**
 * Where call-in drones appear: beyond the approach point of the usable openings, the north windows nearest to the
 * player first, then the roller door; `wave` rotates through the list so consecutive waves come from different
 * openings. Always outside the warehouse.
 */
export function callInSpawnPoints(
  player: V3,
  count: number,
  wave: number,
  cfg: { approach: number; inside: number; spawnOut: number },
): V3[] {
  const usable = usableOpenings(cfg);
  const windows = usable
    .filter((o) => o.kind === 'window')
    .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
  const doors = usable.filter((o) => o.kind === 'roller-door');
  const list = [...windows, ...doors];
  if (list.length === 0) return [];
  const out: V3[] = [];
  for (let i = 0; i < count; i++) {
    const o = list[(wave * count + i) % list.length]!;
    const a = openingPoints(o, cfg).approach;
    out.push({ x: a.x + o.nx * cfg.spawnOut, y: a.y, z: a.z + o.nz * cfg.spawnOut });
  }
  return out;
}
