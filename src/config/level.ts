import { SPAWN_L, WAREHOUSE, type Rect } from './warehouse';

/**
 * Level contract: one quay under an overcast sky ("tiny level, high detail"), an L-shaped play area since
 * spec 29. The warehouse fills the inner corner of the L and is the only way from the yard to the court.
 *
 * Coordinate system: +X = east, +Y = up, +Z = south. Ground (wet asphalt) is at y = 0.
 * The sea lies north of the quay edge (z < LAND.minZ). Player yaw 0 looks towards -Z (north).
 *
 *   z = -88  ===================== quay edge / sea to the north =====================
 *            |  D  Quay (boss arena, gantry crane, staged boxes)        full width  |  48 m
 *   z = -40  |------------------------------------------------------------------|
 *            |  B  Relay court (the control tower, the scorpion)        full width  |  16 m
 *   z = -24  |##### container wall, 2 high, no gap #####|==== warehouse N wall =====|
 *            |  A  Container yard, west leg             ]  WAREHOUSE (zone A)       |
 *            |     lanes x = -15 and x = 2, aisle z = -4 ]> roller door (8, -4)     |
 *   z =  12  |                                    x=6 _ |===========================|
 *            |  C  Gate apron, west leg (spawn -15, 29) |  closed loading dock       |
 *   z =  34  ========= 7 m perimeter wall ==============|  (outside the play area)   |
 *          x = -36                                  x = 6  x = 8                 x = 36
 *
 * 72 x 122 m of land. The play area is the west leg (x -36..6, plus the 2 m apron in front of the warehouse
 * door), the north leg (court and quay, full width) and the warehouse interior. A 7 m perimeter wall closes
 * the land sides of the L (src/world/perimeter.ts); the quay edge stays open. A run is: gate -> container
 * yard -> warehouse (roller door, stair, mezzanine, back door) -> hold the relay tower -> the boss drops onto
 * the quay. Everything a ticket places is relative to these constants.
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

export const LAND = { minX: -36, maxX: 36, minZ: -88, maxZ: 34 } as const;
export const SEA_LEVEL_Y = -2;

/**
 * Zone rectangles (area streaming, debug). They span the full land width; `zoneAt` only answers inside
 * the play area, so the closed loading dock (south-east) belongs to no zone. The warehouse counts as A.
 */
export const ZONES: Readonly<Record<ZoneId, ZoneDef>> = {
  A: { id: 'A', name: 'Container Yard', minX: -36, maxX: 36, minZ: -24, maxZ: 12 },
  B: { id: 'B', name: 'Relay Court', minX: -36, maxX: 36, minZ: -40, maxZ: -24 },
  C: { id: 'C', name: 'Gate Apron', minX: -36, maxX: 36, minZ: 12, maxZ: 34 },
  D: { id: 'D', name: 'Quay', minX: -36, maxX: 36, minZ: -88, maxZ: -40 },
};

/** The parts of the L-shaped play area (spec 29). Outside them, on land, is the closed loading dock. */
export const PLAY_AREA: Readonly<Record<'westLeg' | 'doorApron' | 'northLeg' | 'warehouse', Rect>> = {
  /** Gate apron and container yard, west of the dock wall. */
  westLeg: { minX: LAND.minX, maxX: 6, minZ: -24, maxZ: LAND.maxZ },
  /** Strip between the dock wall line and the warehouse west wall, in front of the roller door. */
  doorApron: { minX: 6, maxX: WAREHOUSE.footprint.minX, minZ: -24, maxZ: WAREHOUSE.footprint.maxZ },
  /** Relay court and quay, full width. */
  northLeg: { minX: LAND.minX, maxX: LAND.maxX, minZ: LAND.minZ, maxZ: -24 },
  warehouse: WAREHOUSE.footprint,
};

/** The container yard: the west leg north of the gate apron, up to the warehouse west wall. */
export const YARD_RECT: Rect = { minX: LAND.minX, maxX: WAREHOUSE.footprint.minX, minZ: -24, maxZ: 12 };

const inRect = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** True inside the L (outdoor legs) or the warehouse. */
export function isInPlayArea(x: number, z: number): boolean {
  return inRect(PLAY_AREA.westLeg, x, z) || inRect(PLAY_AREA.doorApron, x, z) || inRect(PLAY_AREA.northLeg, x, z) || inRect(PLAY_AREA.warehouse, x, z);
}

/** True inside the warehouse footprint (walls included). */
export function isInWarehouse(x: number, z: number): boolean {
  return inRect(WAREHOUSE.footprint, x, z);
}

/** True on land but outside the play area: the closed loading dock behind the perimeter wall. */
export function isInClosedBlock(x: number, z: number): boolean {
  return x >= LAND.minX && x <= LAND.maxX && z >= LAND.minZ && z <= LAND.maxZ && !isInPlayArea(x, z);
}

/**
 * Zone bounds of the first, half-depth version of the level. Authored data written in that frame
 * (props, lights, patrol posts) goes through `fromLegacyZ`, which stretches each zone to the depth it
 * had in the 122 m rectangle (`STRETCHED_Z`, frozen: spec 29 moved zone borders, not the props).
 */
const LEGACY_Z: Readonly<Record<ZoneId, readonly [number, number]>> = {
  A: [-10, 20],
  B: [-18, -10],
  C: [20, 34],
  D: [-52, -18],
};

/** Zone borders of the 122 m rectangle before spec 29 (the target frame of `fromLegacyZ`). */
const STRETCHED_Z: Readonly<Record<ZoneId, readonly [number, number]>> = {
  A: [-28, 16],
  B: [-40, -28],
  C: [16, 34],
  D: [-88, -40],
};

/** Maps a z of the 86 m level onto the 122 m one (each zone is stretched to its depth there). */
export function fromLegacyZ(z: number): number {
  for (const id of ['D', 'B', 'A', 'C'] as const) {
    const [a, b] = LEGACY_Z[id];
    const [c, d] = STRETCHED_Z[id];
    if (z >= a && z <= b) return c + (z - a) * ((d - c) / (b - a));
  }
  return z;
}

/** No robot is placed or streamed in within this distance of the player spawn (m). */
export const SPAWN_SAFE_RADIUS = 32;

export const PLAYER_SPAWN = {
  /** West leg of the gate apron (spec 29). */
  position: { x: SPAWN_L.x, y: SPAWN_L.y, z: SPAWN_L.z } as Vec3Like,
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
export const TOWERS: readonly TowerDef[] = [{ id: 1, zone: 'B', difficulty: 'hard', position: { x: 0, y: 0, z: -34 } }];

export interface CraneSite {
  readonly id: string;
  readonly zone: ZoneId;
  readonly position: Vec3Like;
  /** Rotation around Y in radians. */
  readonly yaw: number;
  readonly scale: number;
}

/** One ship-to-shore gantry crane at the east end of the quay, boom over the water. */
export const CRANE_SITES: readonly CraneSite[] = [{ id: 'crane-quay', zone: 'D', position: { x: 25, y: 0, z: -75 }, yaw: 0, scale: 1 }];

/** Boss arena on the quay. Keep this disc free of containers and props. */
export const BOSS_ARENA = {
  center: { x: -10, y: 0, z: -66 } as Vec3Like,
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
  // spec 29: the court in front of the warehouse back door stays open (the roller door opens onto the
  // yard aisle at z = -4, which the yard generator keeps free anyway)
  { reason: 'warehouse-back-door', x: 14, z: WAREHOUSE.footprint.minZ - 3, radius: 5 },
];

export function isKeepClear(x: number, z: number, margin = 0): boolean {
  return KEEP_CLEAR.some((d) => Math.hypot(x - d.x, z - d.z) < d.radius + margin);
}

/** Decorative cargo ship, static, moored out in the dark. */
export const SHIP_BACKDROP = { position: { x: -34, y: SEA_LEVEL_Y, z: -148 } as Vec3Like, yaw: 0.1 } as const;

/** Enemy roster per zone; sums to ENEMY_COUNTS. The gate apron (player spawn) stays empty. */
export const ENEMY_DISTRIBUTION: Readonly<Record<ZoneId, { army: number; spot: number; duck: number; biped: number; samurai: number }>> = {
  // The gate apron (spawn) is empty. No samurai in the relay court (the scorpion's ground). Spec 29: the
  // yard is the west leg only (zone A also holds the warehouse floor), so the court and the quay take more.
  A: { army: 2, spot: 2, duck: 1, biped: 2, samurai: 1 },
  B: { army: 2, spot: 2, duck: 1, biped: 0, samurai: 0 },
  C: { army: 0, spot: 0, duck: 0, biped: 0, samurai: 0 },
  D: { army: 1, spot: 2, duck: 2, biped: 2, samurai: 2 },
};

/** Zone of a point of the play area; null outside it (sea, closed loading dock). */
export function zoneAt(x: number, z: number): ZoneId | null {
  if (!isInPlayArea(x, z)) return null;
  for (const zone of Object.values(ZONES)) {
    if (x >= zone.minX && x < zone.maxX && z >= zone.minZ && z < zone.maxZ) return zone.id;
  }
  return null;
}

/** Walkable land: inside the land rectangle and inside the L (not the closed loading dock). */
export function isOnLand(x: number, z: number): boolean {
  return x >= LAND.minX && x <= LAND.maxX && z >= LAND.minZ && z <= LAND.maxZ && isInPlayArea(x, z);
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
