import { BOSS_ARENA, fromLegacyZ, zoneAt, type ZoneId } from '@/config/level';
import { WAREHOUSE } from '@/config/warehouse';
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
 * Zone placement for the quay: 8 crates (the last one at `WAREHOUSE.supplySpot`, spec 29) and 2 medkits. All of them are on the ground since the jump was lowered (the double jump no longer reaches 2.6 m container tops). `placements.test.ts` checks every position against the
 * generated container layout and the props.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // C Gate Apron
  c('C', -24, fromLegacyZ(27)),
  c('C', 26, fromLegacyZ(23)),
  // A Container Yard: lane and aisle crossings and open ground (all supplies are on the ground)
  c('A', -11, 9),
  c('A', 9, -8),
  c('A', -16, -11), // west blocks, on the ground (was on a one-high stack; the lower jump no longer reaches container tops)
  m('A', -0.5, -27.5), // aisle facing the relay court, on the ground (was on a one-high stack)
  // B Relay Court
  c('B', -4, fromLegacyZ(-16.5)),
  // D Quay, east of the boss arena
  c('D', 30, fromLegacyZ(-26)),
  m('D', 28, fromLegacyZ(-35)),
  // spec 29: the drones' crate, inside the warehouse under the mezzanine (reserved spot; cast from below its floor)
  c(zoneAt(WAREHOUSE.supplySpot.x, WAREHOUSE.supplySpot.z) ?? 'A', WAREHOUSE.supplySpot.x, WAREHOUSE.supplySpot.z, false, WAREHOUSE.mezzanine.floorY - 0.6),
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
