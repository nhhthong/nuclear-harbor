import { BOSS_LOCAL } from './tunables';

export interface LandingObstacle {
  x: number;
  z: number;
  r: number;
}

export interface LandingParams {
  centre: { x: number; z: number };
  arenaRadius: number;
  /** Ground footprint radius of the boss (feet ring). */
  footprint: number;
  player: { x: number; z: number };
  obstacles: readonly LandingObstacle[];
  /** Extra check for static props (e.g. physics probes); true = something stands there. */
  blocked?: (x: number, z: number, footprint: number) => boolean;
  /** Extra gap between the footprint and the player / obstacles. */
  clearance?: number;
}

export interface LandingSpot {
  x: number;
  z: number;
  /** False when no fully clear candidate existed (the best of the rest is returned). */
  clear: boolean;
}

/** Candidates ordered by distance from the arena centre: the centre, then rings inside the arena. */
export function landingCandidates(centre: { x: number; z: number }, arenaRadius: number, footprint: number): Array<{ x: number; z: number }> {
  const out = [{ x: centre.x, z: centre.z }];
  const maxR = Math.max(0, arenaRadius - footprint * 0.6);
  const { rings, perRing } = BOSS_LOCAL.landing;
  for (let ring = 1; ring <= rings; ring++) {
    const r = (maxR * ring) / rings;
    for (let i = 0; i < perRing; i++) {
      const a = ((i + (ring % 2) * 0.5) / perRing) * Math.PI * 2;
      out.push({ x: centre.x + Math.cos(a) * r, z: centre.z + Math.sin(a) * r });
    }
  }
  return out;
}

/**
 * Pure landing spot rule: the first candidate (centre outwards) whose feet ring stays clear of the
 * player, of every obstacle and of probed props. Fallback: the candidate with the largest clearance.
 */
export function pickLandingSpot(p: LandingParams): LandingSpot {
  const gap = p.clearance ?? BOSS_LOCAL.landing.clearance;
  const cands = landingCandidates(p.centre, p.arenaRadius, p.footprint);
  let best: LandingSpot | null = null;
  let bestScore = -Infinity;
  for (const c of cands) {
    let score = Math.hypot(c.x - p.player.x, c.z - p.player.z) - p.footprint - gap;
    for (const o of p.obstacles) {
      score = Math.min(score, Math.hypot(c.x - o.x, c.z - o.z) - p.footprint - o.r - 1);
    }
    const blocked = p.blocked ? p.blocked(c.x, c.z, p.footprint) : false;
    if (score >= 0 && !blocked) return { x: c.x, z: c.z, clear: true };
    const s = blocked ? score - 1000 : score;
    if (s > bestScore) {
      bestScore = s;
      best = { x: c.x, z: c.z, clear: false };
    }
  }
  return best ?? { x: p.centre.x, z: p.centre.z, clear: false };
}
