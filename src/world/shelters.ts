import type { ZoneId } from '@/config/level';
import { WORLD } from '@/config/tunables';

/**
 * Safe containers: a few 20 ft containers with the doors swung open. The player can walk in, the
 * walls stop bullets, and standing inside heals. Pure data and geometry helpers (no three.js), so the
 * placement is unit-tested against the container layout and the props.
 *
 * Model frame: centred on the container, the length runs along X and the open end faces +X. `yaw`
 * turns it about Y (three.js sense): the door then faces (cos yaw, -sin yaw) in world X/Z.
 */

export const SHELTER = {
  /** HP per second while inside, once nothing has hurt the player for `calmSeconds`. */
  healPerSecond: 12,
  calmSeconds: 1.2,
  /** Wall thickness of the colliders; the visual inner liner sits on their inner face (m). */
  wall: 0.14,
  /** Visual door leaves swung open along the side walls (m, from the end of the container). */
  leaf: 1.19,
} as const;

export interface Shelter {
  id: string;
  zone: ZoneId;
  x: number;
  z: number;
  yaw: number;
}

const FACING_EAST = 0;
const FACING_WEST = Math.PI;

export const SHELTERS: readonly Shelter[] = [
  // yard, west block: the door faces the N-S lane (east)
  { id: 'yard-north', zone: 'A', x: -24, z: -22, yaw: FACING_EAST },
  // yard, south part, close to the start
  { id: 'yard-south', zone: 'A', x: 24, z: 10, yaw: FACING_WEST },
  // relay court, west of the tower
  { id: 'court-west', zone: 'B', x: -28, z: -34, yaw: FACING_EAST },
  // quay: east side, and west of the boss arena
  { id: 'quay-east', zone: 'D', x: 31, z: -58, yaw: FACING_WEST },
  { id: 'quay-west', zone: 'D', x: -31, z: -56, yaw: FACING_EAST },
];

const L = WORLD.container.length;
const W = WORLD.container.width;
const H = WORLD.container.height;

export interface WorldBox {
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
  yaw: number;
}

/** Local (lx, lz) of the container frame to world X/Z. */
export function toWorld(s: Shelter, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c };
}

/** World X/Z to the container frame. */
export function toLocal(s: Shelter, x: number, z: number): { lx: number; lz: number } {
  const dx = x - s.x;
  const dz = z - s.z;
  const c = Math.cos(s.yaw);
  const sn = Math.sin(s.yaw);
  return { lx: dx * c - dz * sn, lz: dx * sn + dz * c };
}

/** True when a point (feet position) is inside the room: past the door frame and below the roof. */
export function insideShelter(s: Shelter, x: number, y: number, z: number): boolean {
  if (y < -0.3 || y > H - 0.3) return false;
  const { lx, lz } = toLocal(s, x, z);
  return lx >= -L / 2 + SHELTER.wall + 0.1 && lx <= L / 2 + 0.05 && Math.abs(lz) <= W / 2 - SHELTER.wall - 0.05;
}

/**
 * Static boxes of the walls, back wall, roof and the two swung-open door leaves. The container
 * stands on the ground, so the local centre height is H / 2.
 */
export function shelterBoxes(s: Shelter): WorldBox[] {
  const hx = L / 2;
  const hz = W / 2;
  const t = SHELTER.wall;
  const part = (lx: number, ly: number, lz: number, hlx: number, hly: number, hlz: number): WorldBox => {
    const p = toWorld(s, lx, lz);
    return { center: { x: p.x, y: H / 2 + ly, z: p.z }, halfExtents: { x: hlx, y: hly, z: hlz }, yaw: s.yaw };
  };
  const leafZ = hz - 0.12 + 0.03;
  return [
    part(0, 0, hz - t / 2, hx, H / 2, t / 2),
    part(0, 0, -(hz - t / 2), hx, H / 2, t / 2),
    part(-hx + t / 2, 0, 0, t / 2, H / 2, hz),
    part(0, H / 2 - t / 2, 0, hx, t / 2, hz),
    part(hx + SHELTER.leaf / 2, 0, leafZ, SHELTER.leaf / 2, H / 2 - 0.1, 0.03),
    part(hx + SHELTER.leaf / 2, 0, -leafZ, SHELTER.leaf / 2, H / 2 - 0.1, 0.03),
  ];
}

/** Axis-aligned footprint of the room (for the nav grid): the interior plus half a metre at the door. */
export function shelterFootprint(s: Shelter): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const hx = L / 2 + 0.5;
  const hz = W / 2;
  const pts = [
    toWorld(s, -hx, -hz),
    toWorld(s, -hx, hz),
    toWorld(s, hx, -hz),
    toWorld(s, hx, hz),
  ];
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minZ: Math.min(...pts.map((p) => p.z)),
    maxZ: Math.max(...pts.map((p) => p.z)),
  };
}
