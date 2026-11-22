/**
 * Getting out of a wedge (spec 33). Pure helpers, no three or physics: the scorpion feeds them its own
 * movement and the clearance of a ring of probe rays.
 */

/**
 * Tracks whether something that wants to move is not getting anywhere: it has covered less than
 * `minMove` metres over `window` seconds of trying to walk (time spent not trying does not count).
 */
export class StuckTracker {
  private t = 0;
  private x = 0;
  private z = 0;
  private armed = false;

  constructor(
    private readonly window: number,
    private readonly minMove: number,
  ) {}

  /** One step. Returns true (once) when the window ends and the walker has not moved `minMove`. */
  update(dt: number, wantsToMove: boolean, x: number, z: number): boolean {
    // not trying to walk (a skill, a stun, standing off): the window pauses, it neither runs nor resets, so the
    // short walking spells between skills add up to one window
    if (!wantsToMove) return false;
    if (!this.armed) {
      this.armed = true;
      this.t = 0;
      this.x = x;
      this.z = z;
      return false;
    }
    this.t += dt;
    if (Math.hypot(x - this.x, z - this.z) >= this.minMove) {
      // progress: start a fresh window from here
      this.t = 0;
      this.x = x;
      this.z = z;
      return false;
    }
    if (this.t < this.window) return false;
    this.reset();
    return true;
  }

  reset(): void {
    this.armed = false;
    this.t = 0;
  }
}

/**
 * The most open of `clearances` (free distance along each of N evenly spaced headings, index i = angle
 * i / N * 2 PI from the facing). Ties and near-ties (within `tolerance`) prefer the heading closest to
 * `preferIndex` (straight back out is better than a random side). Returns the index.
 */
export function pickEscapeHeading(clearances: readonly number[], preferIndex: number, tolerance = 0.25): number {
  const n = clearances.length;
  let best = 0;
  let bestClear = -Infinity;
  for (const c of clearances) if (c > bestClear) bestClear = c;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const c = clearances[i] ?? 0;
    if (c < bestClear - tolerance) continue;
    const d = Math.min((i - preferIndex + n) % n, (preferIndex - i + n) % n);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * True when even the best heading leaves less than `needed` metres: the body is embedded or boxed in on
 * every side, so crawling will not help and it must be moved to a free spot.
 */
export function isBoxedIn(clearances: readonly number[], needed: number): boolean {
  return Math.max(...clearances) < needed;
}
