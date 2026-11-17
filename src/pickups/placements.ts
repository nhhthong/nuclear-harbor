import { BOSS_ARENA, fromLegacyZ, type ZoneId } from '@/config/level';
import { ECONOMY, WORLD } from '@/config/tunables';
import type { PickupKind } from '@/core/types';
import { generateContainerLayout } from '@/world/containerLayout';
import { PICKUP } from './tunables';

type PlacementZone = ZoneId | 'boss';

export interface PickupCandidate {
  readonly kind: PickupKind;
  readonly zone: PlacementZone;
  readonly x: number;
  readonly z: number;
  /** Meant to end up on a container top / perch / gantry to reward grappling (GDD 5.4). */
  readonly elevated?: boolean;
  /** Ray start height override (indoor spots below a roof). */
  readonly castFromY?: number;
}

const c = (zone: ZoneId, x: number, z: number, elevated = false, castFromY?: number): PickupCandidate => ({
  kind: 'ammo',
  zone,
  x,
  z,
  elevated,
  castFromY,
});
const m = (zone: ZoneId, x: number, z: number, elevated = false, castFromY?: number): PickupCandidate => ({
  kind: 'medkit',
  zone,
  x,
  z,
  elevated,
  castFromY,
});

const LAYOUT = generateContainerLayout();

/** Centre of the one-high container stack in the yard nearest to (x, z): a double jump reaches its top. */
function stackTopNear(x: number, z: number): [number, number] {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const t of LAYOUT.stackTops) {
    // one-high, set square on the grid (loose boxes at an angle are left out)
    if (t.zone !== 'A' || Math.abs(t.y - WORLD.container.height) > 0.01 || Math.abs(Math.sin(2 * t.yaw)) > 1e-6) continue;
    const d = Math.hypot(t.x - x, t.z - z);
    if (d < bestD) {
      bestD = d;
      best = [t.x, t.z];
    }
  }
  if (!best) throw new Error('pickups: the yard has no one-high stack');
  return best;
}

/**
 * Zone placement for the quay: 7 crates and 2 medkits. Two of them sit on one-high container
 * stacks (2.6 m) and need the double jump. `placements.test.ts` checks every position against the
 * generated container layout and the props.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // C Gate Apron
  c('C', -24, fromLegacyZ(27)),
  c('C', 26, fromLegacyZ(23)),
  // A Container Yard: lane and aisle crossings (always free), plus two supplies on one-high stacks
  c('A', -11, 9),
  c('A', 9, -8),
  c('A', ...stackTopNear(-21, -8), true), // one-high stack, west blocks
  m('A', ...stackTopNear(0, -24), true), // one-high stack facing the relay court
  // B Relay Court
  c('B', -4, fromLegacyZ(-16.5)),
  // D Quay, east of the boss arena
  c('D', 30, fromLegacyZ(-26)),
  m('D', 28, fromLegacyZ(-35)),
];

/** Boss supplies: ring just outside the arena, spread over the landward half so every spot is on land. */
function buildBossRing(): PickupCandidate[] {
  const radius = BOSS_ARENA.radius + PICKUP.bossRingOffset;
  const total = ECONOMY.ammoCratesInBossArena + ECONOMY.medkitsInBossArena;
  const spanDeg = 200;
  const out: PickupCandidate[] = [];
  for (let i = 0; i < total; i++) {
    // angle 0 = south (+z), spread symmetrically around it
    const a = ((-spanDeg / 2 + (spanDeg * (i + 0.5)) / total) * Math.PI) / 180;
    // indices 1, 5, 9 are medkits (3 of 11)
    const kind: PickupKind = i % 4 === 1 ? 'medkit' : 'ammo';
    out.push({
      kind,
      zone: 'boss',
      x: BOSS_ARENA.center.x + Math.sin(a) * radius,
      z: BOSS_ARENA.center.z + Math.cos(a) * radius,
    });
  }
  return out;
}

export const BOSS_PLACEMENTS: readonly PickupCandidate[] = buildBossRing();
