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
 * Final zone placement (T-16): 14 crates and 10 medkits next to towers and Charger lanes, with six
 * "grapple" spots on container tops (7.8 m three-high stacks, 5.2 m two-high stacks) and the
 * tower-3 gantry. Container tops come from the world generator (seeded, `world/tunables.ts`);
 * `placements.test.ts` checks every position against that layout, so a layout change that moves a
 * stack fails the test instead of silently dropping a crate onto the ground.
 * Indoor tower-1 spots cast from below the 10 m warehouse roof.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // A Container Yard (Charger country, tower 2): 5 crates, 3 medkits
  c('A', -67, -8), // tower 2
  c('A', -69.5, -23.1, true), // three-high stack beside the E-W aisles
  c('A', -38.4, -8.6, true), // three-high stack, east block
  c('A', -25.9, -48), // north end of the N-S lane (Charger start)
  c('A', -88.2, 30), // south end of the western lane
  m('A', -77, -16), // tower 2
  m('A', -25.9, -21), // lane junction
  m('A', -57, 30), // south end of the middle lane
  // B Crane Zone (tower 3 on the gantry): 4 crates, 3 medkits
  c('B', 77, -12, true), // tower-3 gantry platform
  c('B', 48.3, -8.5, true), // two-high stack
  c('B', 60, -50),
  c('B', 105, 10),
  m('B', 66, -16),
  m('B', 100, -50),
  m('B', 20, 25),
  // C Warehouse (tower 1, easy): 2 crates, 2 medkits
  c('C', 24, 66, false, 8),
  c('C', -70, 70),
  m('C', 16, 58, false, 8),
  m('C', 60, 75),
  // D Dock (tower 4, boss route): 3 crates, 2 medkits
  c('D', 56, -90),
  c('D', -98.2, -99.9, true), // two-high stack at the western dock
  c('D', -73.6, -77.3, true), // two-high stack on the way to the arena
  m('D', 64, -100),
  m('D', 20, -75),
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
