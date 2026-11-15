import { BOSS_ARENA, type ZoneId } from '@/config/level';
import { ECONOMY } from '@/config/tunables';
import type { PickupKind } from '@/core/types';
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

/**
 * Zone placement for the quay: 9 crates and 4 medkits. Two of them sit on one-high container
 * stacks (2.6 m) and need the double jump. `placements.test.ts` checks every position against the
 * generated container layout and the props.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // C Gate Apron
  c('C', -24, 27),
  c('C', 26, 23),
  m('C', 16, 28.5),
  // A Container Yard
  c('A', -9.3, 5),
  c('A', 9.5, 16),
  c('A', -21.8, 3.6, true), // one-high stack, west block
  m('A', 0.1, -5.4, true), // one-high stack facing the relay court
  // B Relay Court
  c('B', -4, -16.5),
  m('B', 24, -15.5),
  // A, east lane
  c('A', 25, -0.9),
  // D Quay, east of the boss arena
  c('D', 30, -26),
  c('D', 7, -21.5),
  m('D', 28, -35),
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
