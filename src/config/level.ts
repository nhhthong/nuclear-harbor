/**
 * Level contract: coarse layout of the harbor shared by every content ticket.
 *
 * Coordinate system: +X = east, +Y = up, +Z = south. Ground (concrete) is at y = 0.
 * The sea lies north of the dock edge (z < LAND.minZ) and west/east of the land.
 * Player yaw 0 looks towards -Z (north).
 *
 *            z = -90   ======== dock edge / sea to the north ========
 *            |  D  Dock + Control Center (boss arena)              |
 *            z = -30   ---------------------------------------------
 *            |  A  Container Yard      |  B  Crane Zone            |
 *            z =  24   ---------------------------------------------
 *            |  C  Warehouse (player start)                        |
 *            z =  62   =============================================
 *            x = -72                  x = 0                    x = 72
 *
 * Compact layout (144 x 152 m): every objective is at most ~70 m from the previous one. The side
 * passages around the warehouse are sealed (see world/barriers.ts), so a run flows
 * spawn -> warehouse (tower 1) -> yard (tower 2) -> crane zone (tower 3) -> dock (tower 4, boss).
 *
 * Geometry tickets (T-03, T-04) build to this contract; gameplay tickets place content relative
 * to it. Changing a value here affects several tickets: announce it in the PR.
 */

export type ZoneId = 'A' | 'B' | 'C' | 'D';

export interface ZoneDef {
  readonly id: ZoneId;
  readonly name: string;
  /** Axis-aligned bounds on the XZ plane. */
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const LAND = { minX: -72, maxX: 72, minZ: -90, maxZ: 62 } as const;
export const SEA_LEVEL_Y = -2;

export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  A: { id: 'A', name: 'Container Yard', minX: -72, maxX: 0, minZ: -30, maxZ: 24 },
  B: { id: 'B', name: 'Crane Zone', minX: 0, maxX: 72, minZ: -30, maxZ: 24 },
  C: { id: 'C', name: 'Warehouse', minX: -72, maxX: 72, minZ: 24, maxZ: 62 },
  D: { id: 'D', name: 'Dock + Control Center', minX: -72, maxX: 72, minZ: -90, maxZ: -30 },
};

export const PLAYER_SPAWN = {
  position: { x: 0, y: 0, z: 58.5 } as Vec3Like,
  /** Facing north, towards the warehouse door. */
  yaw: 0,
} as const;

/** Warehouse building footprint inside zone C (T-03 builds it, door on the south and north walls). */
export const WAREHOUSE_FOOTPRINT = { minX: -30, maxX: 30, minZ: 32, maxZ: 54, height: 10 } as const;

/** Control center building inside zone D (T-03). */
export const CONTROL_CENTER_FOOTPRINT = { minX: 46, maxX: 66, minZ: -82, maxZ: -68, height: 7 } as const;

export interface TowerDef {
  readonly id: 1 | 2 | 3 | 4;
  readonly zone: ZoneId;
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
  /** Base of the tower (where the player stands to interact). */
  readonly position: Vec3Like;
}

/** GDD 8. Tower 3 stands on a 3 m gantry platform (structures module), reached with a double jump. */
export const TOWERS: readonly TowerDef[] = [
  { id: 1, zone: 'C', difficulty: 'easy', position: { x: 16, y: 0, z: 43 } },
  { id: 2, zone: 'A', difficulty: 'medium', position: { x: -36, y: 0, z: -3 } },
  { id: 3, zone: 'B', difficulty: 'hard', position: { x: 38, y: 3, z: -4 } },
  { id: 4, zone: 'D', difficulty: 'very-hard', position: { x: 32, y: 0, z: -56 } },
];

export interface CraneSite {
  readonly id: string;
  readonly zone: ZoneId;
  readonly position: Vec3Like;
  /** Rotation around Y in radians. */
  readonly yaw: number;
  /** Uniform scale variation of the base crane model (GDD 7.4). */
  readonly scale: number;
}

/** GDD 7.4: 6 cranes = 3 in the Crane Zone, 1 at the yard edge, 2 at the dock edge beside the boss arena. */
export const CRANE_SITES: readonly CraneSite[] = [
  { id: 'crane-b1', zone: 'B', position: { x: 14, y: 0, z: -15 }, yaw: 0, scale: 1.0 },
  { id: 'crane-b2', zone: 'B', position: { x: 57, y: 0, z: -15 }, yaw: Math.PI / 2, scale: 1.0 },
  { id: 'crane-b3', zone: 'B', position: { x: 20, y: 0, z: 9 }, yaw: 0, scale: 0.9 },
  { id: 'crane-a1', zone: 'A', position: { x: -57, y: 0, z: 9 }, yaw: Math.PI / 2, scale: 1.0 },
  { id: 'crane-d1', zone: 'D', position: { x: -65, y: 0, z: -78 }, yaw: Math.PI / 2, scale: 1.0 },
  { id: 'crane-d2', zone: 'D', position: { x: 16, y: 0, z: -76 }, yaw: 0, scale: 1.0 },
];

/** Boss arena on the dock (GDD 9.1). Keep this disc free of containers and buildings. */
export const BOSS_ARENA = {
  center: { x: -28, y: 0, z: -60 } as Vec3Like,
  radius: 28,
} as const;

export interface KeepClearDisc {
  readonly reason: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/**
 * Ground areas that level geometry of OTHER tickets must leave empty (below y = 9 m): containers
 * and buildings (T-03) stay out of these discs; each disc's owner builds inside it. Cranes and
 * the tower-3 platform must keep their ground footprint inside their own disc.
 */
export const KEEP_CLEAR: readonly KeepClearDisc[] = [
  { reason: 'player-spawn', x: PLAYER_SPAWN.position.x, z: PLAYER_SPAWN.position.z, radius: 5 },
  { reason: 'boss-arena', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z, radius: BOSS_ARENA.radius + 2 },
  ...TOWERS.map((t) => ({ reason: `tower-${t.id}`, x: t.position.x, z: t.position.z, radius: 7 })),
  ...CRANE_SITES.map((c) => ({ reason: c.id, x: c.position.x, z: c.position.z, radius: 12 })),
];

export function isKeepClear(x: number, z: number, margin = 0): boolean {
  return KEEP_CLEAR.some((d) => Math.hypot(x - d.x, z - d.z) < d.radius + margin);
}

/** Decorative cargo ship (GDD 7.1), static, out at sea. */
export const SHIP_BACKDROP = { position: { x: -30, y: SEA_LEVEL_Y, z: -165 } as Vec3Like, yaw: 0.12 } as const;

/** Enemy distribution per zone; sums to GDD 6 totals (14 / 10 / 6). Mostly Ducks in the yard (GDD 6.3). */
export const ENEMY_DISTRIBUTION: Readonly<Record<ZoneId, { army: number; spot: number; duck: number }>> = {
  A: { army: 5, spot: 3, duck: 4 },
  B: { army: 4, spot: 3, duck: 0 },
  C: { army: 3, spot: 2, duck: 1 },
  D: { army: 2, spot: 2, duck: 1 },
};

export function zoneAt(x: number, z: number): ZoneId | null {
  for (const zone of Object.values(ZONES)) {
    if (x >= zone.minX && x < zone.maxX && z >= zone.minZ && z < zone.maxZ) return zone.id;
  }
  return null;
}

export function isOnLand(x: number, z: number): boolean {
  return x >= LAND.minX && x <= LAND.maxX && z >= LAND.minZ && z <= LAND.maxZ;
}

/** Spawn inside the foundation sandbox scene (`?sandbox`, see src/sandbox). */
const SANDBOX_SPAWN = {
  position: { x: 0, y: 0, z: 12 } as Vec3Like,
  yaw: 0,
} as const;

/** Where the player starts for the current mode. */
export function spawnFor(sandbox: boolean): { position: Vec3Like; yaw: number } {
  return sandbox ? SANDBOX_SPAWN : PLAYER_SPAWN;
}
