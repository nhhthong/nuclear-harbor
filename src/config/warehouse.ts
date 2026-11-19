/**
 * Shared contract for spec 29 (warehouse + L-shaped map). Several modules read these numbers:
 * the level layout and warehouse shell (src/structures), the interior props, the flying drones
 * (openings) and the pickups. Change them only here.
 *
 * Coordinates as in level.ts: +X east, +Y up, +Z south, ground at y = 0, player yaw 0 looks north (-Z).
 *
 *   z = -88  ======================= quay edge / sea =======================
 *            |  D quay (boss arena, crane)                    full width   |
 *   z = -40  |----------------------------------------------------------|
 *            |  B relay court (tower at 0, -34)               full width   |
 *   z = -24  |------ container wall (no gap) ------|==== warehouse N ====|
 *            |  A yard, west leg  x -36..6          |  WAREHOUSE          |
 *            |                                      |  x 8..34, z -24..12 |
 *   z =  12  |                                      |=====================|
 *            |  C gate apron, west leg (spawn)      |  closed loading dock|
 *   z =  34  ========================================(outside the play area)
 *          x = -36                              x = 6   x = 8         x = 36
 *
 * The outdoor play area is an L: the west leg (gate + yard, x -36..6) and the north leg (court + quay,
 * full width). The only way from the yard to the court is THROUGH the warehouse: west roller door in,
 * north back door out.
 */

export interface Rect {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface Opening {
  readonly id: string;
  readonly kind: 'roller-door' | 'door' | 'window';
  /** Centre of the opening (world). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Outward normal of the wall it is cut in (unit, on XZ). */
  readonly nx: number;
  readonly nz: number;
  readonly width: number;
  readonly height: number;
  /** Drones may fly through it. */
  readonly flyable: boolean;
}

export const WAREHOUSE = {
  /** Outer footprint of the building (walls included). */
  footprint: { minX: 8, maxX: 34, minZ: -24, maxZ: 12 } as Rect,
  wallThickness: 0.3,
  eaveHeight: 9,
  ridgeHeight: 11,
  /** Mezzanine along the north wall; its walking surface is at `floorY`. */
  mezzanine: { minX: 9, maxX: 33, minZ: -23.7, maxZ: -17, floorY: 3.6 } as Rect & { readonly floorY: number },
  /** Glazed control office standing on the mezzanine (east end), interior height 3 m. */
  office: { minX: 25, maxX: 33, minZ: -23.7, maxZ: -17, height: 3 } as Rect & { readonly height: number },
  /** Straight steel stair from the floor (south end, y 0) up to the mezzanine (north end, y 3.6). */
  stairs: { minX: 9.4, maxX: 11, minZ: -17, maxZ: -10.4, bottomZ: -10.4, topZ: -17, riser: 0.18, tread: 0.33 },
  openings: [
    { id: 'west-roller', kind: 'roller-door', x: 8, y: 2.5, z: -4, nx: -1, nz: 0, width: 5, height: 5, flyable: true },
    { id: 'north-back', kind: 'door', x: 14, y: 2.25, z: -24, nx: 0, nz: -1, width: 4.5, height: 4.5, flyable: true },
    // open window frames (no glass) on the mezzanine, looking over the relay court
    { id: 'win-n1', kind: 'window', x: 17, y: 5.4, z: -24, nx: 0, nz: -1, width: 2.4, height: 1.4, flyable: true },
    { id: 'win-n2', kind: 'window', x: 21, y: 5.4, z: -24, nx: 0, nz: -1, width: 2.4, height: 1.4, flyable: true },
    { id: 'win-n3', kind: 'window', x: 28, y: 5.4, z: -24, nx: 0, nz: -1, width: 2.4, height: 1.4, flyable: true },
  ] as readonly Opening[],
  /** The player walks this corridor from the roller door to the back door; keep it free (width 4 m). */
  corridor: [
    { minX: 8, maxX: 16, minZ: -6, maxZ: -2 },
    { minX: 12, maxX: 16, minZ: -24, maxZ: -2 },
  ] as readonly Rect[],
  /** Interior prop zones (floor level unless noted). Props stay inside these and off the corridor. */
  propZones: {
    racks: { minX: 18, maxX: 33, minZ: -15, maxZ: 11 } as Rect,
    workshop: { minX: 9, maxX: 16, minZ: 3, maxZ: 11 } as Rect,
    floorStacks: { minX: 9, maxX: 11.5, minZ: -2, maxZ: 2 } as Rect,
    underMezzanine: { minX: 17, maxX: 33, minZ: -23.5, maxZ: -17.5 } as Rect,
    /** On the mezzanine, inside the office (y = mezzanine.floorY). */
    office: { minX: 25.3, maxX: 32.7, minZ: -23.4, maxZ: -17.3 } as Rect,
  },
  /** Reserved for the extra ammo crate (spec 29, drones): nothing else within 1.2 m. */
  supplySpot: { x: 17.5, y: 0, z: -20 },
} as const;

/** Tall perimeter wall around the outdoor L (not on the quay edge). */
export const PERIMETER_WALL = { height: 7, thickness: 0.6 } as const;

/** Player spawn moves into the west leg of the gate apron. */
export const SPAWN_L = { x: -15, y: 0, z: 29 } as const;
