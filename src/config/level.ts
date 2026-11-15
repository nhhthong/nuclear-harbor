/**
 * Level contract: one small night-time quay ("tiny level, high detail").
 *
 * Coordinate system: +X = east, +Y = up, +Z = south. Ground (wet asphalt) is at y = 0.
 * The sea lies north of the quay edge (z < LAND.minZ). Player yaw 0 looks towards -Z (north).
 *
 *            z = -52   ======== quay edge / sea to the north ========
 *            |  D  Quay (boss arena, gantry crane at the east end)    |
 *            z = -18   ----------------------------------------------
 *            |  B  Relay court (the control tower)                    |
 *            z = -10   ----------------------------------------------
 *            |  A  Container yard (two N-S lanes, two E-W aisles)     |
 *            z =  20   ----------------------------------------------
 *            |  C  Gate apron (player start, site office)             |
 *            z =  34   ==============================================
 *            x = -36                  x = 0                    x = 36
 *
 * 72 x 86 m. A run is: gate -> through the container yard (8 robots) -> hold the relay tower
 * -> TITAN-04 drops onto the quay. Everything a ticket places is relative to these constants.
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

export const LAND = { minX: -36, maxX: 36, minZ: -52, maxZ: 34 } as const;
export const SEA_LEVEL_Y = -2;

export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  A: { id: 'A', name: 'Container Yard', minX: -36, maxX: 36, minZ: -10, maxZ: 20 },
  B: { id: 'B', name: 'Relay Court', minX: -36, maxX: 36, minZ: -18, maxZ: -10 },
  C: { id: 'C', name: 'Gate Apron', minX: -36, maxX: 36, minZ: 20, maxZ: 34 },
  D: { id: 'D', name: 'Quay', minX: -36, maxX: 36, minZ: -52, maxZ: -18 },
};

export const PLAYER_SPAWN = {
  position: { x: 0, y: 0, z: 30 } as Vec3Like,
  /** Facing north, into the yard. */
  yaw: 0,
} as const;

export interface TowerDef {
  readonly id: number;
  readonly zone: ZoneId;
  readonly difficulty: 'easy' | 'medium' | 'hard' | 'very-hard';
  /** Base of the tower (where the player stands to interact). */
  readonly position: Vec3Like;
}

/** The single relay tower, in the court between the yard and the quay. */
export const TOWERS: readonly TowerDef[] = [{ id: 1, zone: 'B', difficulty: 'hard', position: { x: 0, y: 0, z: -14 } }];

export interface CraneSite {
  readonly id: string;
  readonly zone: ZoneId;
  readonly position: Vec3Like;
  /** Rotation around Y in radians. */
  readonly yaw: number;
  readonly scale: number;
}

/** One ship-to-shore gantry crane at the east end of the quay, boom over the water. */
export const CRANE_SITES: readonly CraneSite[] = [{ id: 'crane-quay', zone: 'D', position: { x: 25, y: 0, z: -43 }, yaw: 0, scale: 1 }];

/** Boss arena on the quay. Keep this disc free of containers and props. */
export const BOSS_ARENA = {
  center: { x: -8, y: 0, z: -35 } as Vec3Like,
  radius: 17,
} as const;

export interface KeepClearDisc {
  readonly reason: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/** Ground areas that containers and props must leave empty. */
export const KEEP_CLEAR: readonly KeepClearDisc[] = [
  { reason: 'player-spawn', x: PLAYER_SPAWN.position.x, z: PLAYER_SPAWN.position.z, radius: 5 },
  { reason: 'boss-arena', x: BOSS_ARENA.center.x, z: BOSS_ARENA.center.z, radius: BOSS_ARENA.radius + 1 },
  ...TOWERS.map((t) => ({ reason: `tower-${t.id}`, x: t.position.x, z: t.position.z, radius: 5 })),
  ...CRANE_SITES.map((c) => ({ reason: c.id, x: c.position.x, z: c.position.z, radius: 11 })),
];

export function isKeepClear(x: number, z: number, margin = 0): boolean {
  return KEEP_CLEAR.some((d) => Math.hypot(x - d.x, z - d.z) < d.radius + margin);
}

/** Decorative cargo ship, static, moored out in the dark. */
export const SHIP_BACKDROP = { position: { x: -34, y: SEA_LEVEL_Y, z: -112 } as Vec3Like, yaw: 0.1 } as const;

/** Enemy roster per zone; sums to ENEMY_COUNTS. The gate apron (player spawn) stays empty. */
export const ENEMY_DISTRIBUTION: Readonly<Record<ZoneId, { army: number; spot: number; duck: number; samurai: number }>> = {
  // one cyber samurai per area at most, none in the relay court (the scorpion's ground)
  A: { army: 3, spot: 4, duck: 3, samurai: 1 },
  B: { army: 1, spot: 2, duck: 1, samurai: 0 },
  C: { army: 0, spot: 0, duck: 0, samurai: 1 },
  D: { army: 1, spot: 2, duck: 1, samurai: 1 },
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
