/**
 * Level contract: coarse layout of the harbor shared by every content ticket.
 *
 * Coordinate system: +X = east, +Y = up, +Z = south. Ground (concrete) is at y = 0.
 * The sea lies north of the dock edge (z < DOCK_EDGE_Z) and west/east of the land.
 * Player yaw 0 looks towards -Z (north).
 *
 *            z = -120  ======== dock edge / sea to the north ========
 *            |  D  Dock + Control Center (boss arena)              |
 *            z = -60   ---------------------------------------------
 *            |  A  Container Yard      |  B  Crane Zone            |
 *            z =  40   ---------------------------------------------
 *            |  C  Warehouse (player start)                        |
 *            z = 100   =============================================
 *            x = -120                 x = 0                   x = 120
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

export const LAND = { minX: -120, maxX: 120, minZ: -120, maxZ: 100 } as const;
export const DOCK_EDGE_Z = LAND.minZ;
export const SEA_LEVEL_Y = -2;

export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  A: { id: 'A', name: 'Container Yard', minX: -120, maxX: 0, minZ: -60, maxZ: 40 },
  B: { id: 'B', name: 'Crane Zone', minX: 0, maxX: 120, minZ: -60, maxZ: 40 },
  C: { id: 'C', name: 'Warehouse', minX: -120, maxX: 120, minZ: 40, maxZ: 100 },
  D: { id: 'D', name: 'Dock + Control Center', minX: -120, maxX: 120, minZ: -120, maxZ: -60 },
};

export const PLAYER_SPAWN = {
  position: { x: 0, y: 0, z: 96 } as Vec3Like,
  /** Facing north, towards the warehouse door. */
  yaw: 0,
} as const;

/** Warehouse building footprint inside zone C (T-03 builds it, door on the south and north walls). */
export const WAREHOUSE_FOOTPRINT = { minX: -50, maxX: 50, minZ: 50, maxZ: 90, height: 10 } as const;

/** Control center building inside zone D (T-03). */
export const CONTROL_CENTER_FOOTPRINT = { minX: 70, maxX: 100, minZ: -110, maxZ: -85, height: 7 } as const;

export interface TowerDef {
  readonly id: 1 | 2 | 3 | 4;
  readonly zone: ZoneId;
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
  /** Base of the tower (where the player stands to interact). */
  readonly position: Vec3Like;
}

/** GDD 8. Tower 3 stands on an elevated gantry platform (T-04 builds the platform at this spot). */
export const TOWERS: readonly TowerDef[] = [
  { id: 1, zone: 'C', difficulty: 'easy', position: { x: 20, y: 0, z: 62 } },
  { id: 2, zone: 'A', difficulty: 'medium', position: { x: -72, y: 0, z: -12 } },
  { id: 3, zone: 'B', difficulty: 'hard', position: { x: 72, y: 10, z: -12 } },
  { id: 4, zone: 'D', difficulty: 'very-hard', position: { x: 60, y: 0, z: -96 } },
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

/** GDD 7.4: 6 cranes = 3 in the Crane Zone, 1 at the yard edge, 2 around the dock / boss arena. */
export const CRANE_SITES: readonly CraneSite[] = [
  { id: 'crane-b1', zone: 'B', position: { x: 30, y: 0, z: -35 }, yaw: 0, scale: 1.0 },
  { id: 'crane-b2', zone: 'B', position: { x: 92, y: 0, z: -30 }, yaw: Math.PI / 2, scale: 1.15 },
  { id: 'crane-b3', zone: 'B', position: { x: 50, y: 0, z: 14 }, yaw: 0, scale: 0.9 },
  { id: 'crane-a1', zone: 'A', position: { x: -108, y: 0, z: -20 }, yaw: Math.PI / 2, scale: 1.0 },
  { id: 'crane-d1', zone: 'D', position: { x: -78, y: 0, z: -98 }, yaw: 0, scale: 1.1 },
  { id: 'crane-d2', zone: 'D', position: { x: 22, y: 0, z: -104 }, yaw: 0, scale: 1.1 },
];

/** Boss arena on the dock (GDD 9.1). Keep this disc free of containers and buildings. */
export const BOSS_ARENA = {
  center: { x: -28, y: 0, z: -90 } as Vec3Like,
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
  { reason: 'player-spawn', x: PLAYER_SPAWN.position.x, z: PLAYER_SPAWN.position.z, radius: 6 },
  { reason: 'boss-arena', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z, radius: BOSS_ARENA.radius + 4 },
  ...TOWERS.map((t) => ({ reason: `tower-${t.id}`, x: t.position.x, z: t.position.z, radius: 7 })),
  ...CRANE_SITES.map((c) => ({ reason: c.id, x: c.position.x, z: c.position.z, radius: 14 })),
];

export function isKeepClear(x: number, z: number, margin = 0): boolean {
  return KEEP_CLEAR.some((d) => Math.hypot(x - d.x, z - d.z) < d.radius + margin);
}

/** Decorative cargo ship (GDD 7.1), static, out at sea. */
export const SHIP_BACKDROP = { position: { x: -40, y: SEA_LEVEL_Y, z: -190 } as Vec3Like, yaw: 0.12 } as const;

/** Enemy distribution per zone; sums to GDD 6 totals (14 / 10 / 6). Mostly Chargers in the yard (GDD 6.3). */
export const ENEMY_DISTRIBUTION: Readonly<Record<ZoneId, { sphere: number; spider: number; charger: number }>> = {
  A: { sphere: 5, spider: 3, charger: 4 },
  B: { sphere: 4, spider: 3, charger: 0 },
  C: { sphere: 3, spider: 2, charger: 1 },
  D: { sphere: 2, spider: 2, charger: 1 },
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
export const SANDBOX_SPAWN = {
  position: { x: 0, y: 0, z: 12 } as Vec3Like,
  yaw: 0,
} as const;

/** Where the player starts for the current mode. */
export function spawnFor(sandbox: boolean): { position: Vec3Like; yaw: number } {
  return sandbox ? SANDBOX_SPAWN : PLAYER_SPAWN;
}
