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
 * Zone placement for the compact harbor: 14 crates and 10 medkits next to towers and lanes, with
 * five elevated spots that reward the double jump (2.6 m one-high stacks from the ground, 5.2 m
 * two-high stacks from a neighbouring one-high stack, the 3 m tower-3 gantry). Container tops come
 * from the world generator (seeded, `world/tunables.ts`); `placements.test.ts` checks every position
 * against that layout, so a layout change that moves a stack fails the test instead of silently
 * dropping a crate onto the ground. Indoor tower-1 spots cast from below the 10 m warehouse roof.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // A Container Yard (Duck country, tower 2): 5 crates, 3 medkits
  c('A', -31, -1), // tower 2
  c('A', -58.8, -19.3, true), // one-high stack, west block
  c('A', -11.9, -22, true), // two-high stack, reached from the one-high stack south of it
  c('A', -21.3, -27), // north end of the N-S lane
  c('A', -46.3, 20), // south apron
  m('A', -41, -1), // tower 2
  m('A', -21.3, -3), // lane junction
  m('A', -11.9, 13.3, true), // two-high stack, reached from the one-high stack south of it
  // B Crane Zone (tower 3 on the gantry): 4 crates, 3 medkits
  c('B', 41, -2, true), // tower-3 gantry platform
  c('B', 66, 10),
  c('B', 32, -27),
  c('B', 8, 21),
  m('B', 46, -6),
  m('B', 64, -28),
  m('B', 28, 21),
  // C Warehouse (tower 1, easy): 2 crates, 2 medkits
  c('C', 22, 47, false, 8),
  c('C', -52, 40), // west side yard (reached from the north)
  m('C', 10, 36, false, 8),
  m('C', 52, 40), // east side yard
  // D Dock (tower 4, boss route): 3 crates, 2 medkits
  c('D', 36, -52),
  c('D', 56.5, -58.95, true), // one-high stack beside the control center
  c('D', 4, -44), // on the way to the arena
  m('D', 38, -62),
  m('D', 24, -36),
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
