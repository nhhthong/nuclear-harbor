import { BOSS_ARENA, type ZoneId } from '@/config/level';
import { ECONOMY } from '@/config/tunables';
import type { PickupKind } from '@/core/types';
import { PICKUP } from './tunables';

export type PlacementZone = ZoneId | 'boss';

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
 * Zone candidates (14 crates, 10 medkits), hand-tuned from `config/level.ts`: near each tower, the
 * Charger-heavy zone A gets the most, a few elevated spots. T-16 does the final tuning.
 * Indoor tower-1 spots cast from below the 10 m warehouse roof.
 */
export const ZONE_PLACEMENTS: readonly PickupCandidate[] = [
  // A Container Yard: 5 crates, 3 medkits
  c('A', -67, -8),
  c('A', -35, 12, true),
  c('A', -88, 28),
  c('A', -45, -42, true),
  c('A', -15, -50),
  m('A', -77, -16),
  m('A', -20, -20),
  m('A', -60, 30),
  // B Crane Zone: 4 crates, 3 medkits
  c('B', 77, -12, true), // tower-3 gantry platform
  c('B', 10, -10),
  c('B', 60, -50),
  c('B', 105, 10),
  m('B', 66, -16),
  m('B', 100, -50),
  m('B', 20, 25),
  // C Warehouse: 2 crates, 2 medkits
  c('C', 24, 66, false, 8),
  c('C', -70, 70),
  m('C', 16, 58, false, 8),
  m('C', 60, 75),
  // D Dock: 3 crates, 2 medkits
  c('D', 56, -90),
  c('D', -95, -72, true),
  c('D', 105, -70),
  m('D', 64, -100),
  m('D', 20, -75),
];

/** Boss supplies: ring just outside the arena, spread over the landward half so every spot is on land. */
export function buildBossRing(): PickupCandidate[] {
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
