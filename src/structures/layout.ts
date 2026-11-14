import { CRANE_SITES, LAND } from '@/config/level';

/**
 * Pure placement data of everything that stands on the quay besides containers: flood-light masts,
 * the gantry crane's solid parts, the perimeter fence and small props. No three.js here, so the
 * layout is unit-testable and the world module can read lamp positions for the reflection probe.
 */

export interface FloodLight {
  id: string;
  /** Mast base on the ground. */
  x: number;
  z: number;
  height: number;
  /** Point on the ground the lamp head aims at. */
  aimX: number;
  aimZ: number;
  color: number;
  /** Candela of the spot light. */
  intensity: number;
  castShadow: boolean;
}

const SODIUM = 0xffc48c;
const LED = 0xcfe0ff;

export const FLOOD_LIGHTS: readonly FloodLight[] = [
  { id: 'gate-w', x: -21, z: 25, height: 11, aimX: -9, aimZ: 13, color: SODIUM, intensity: 2600, castShadow: true },
  { id: 'gate-e', x: 21, z: 25, height: 11, aimX: 9, aimZ: 13, color: SODIUM, intensity: 2600, castShadow: true },
  { id: 'yard-w', x: -33.6, z: 2, height: 12, aimX: -14, aimZ: 3, color: LED, intensity: 2300, castShadow: false },
  { id: 'yard-e', x: 33.6, z: 2, height: 12, aimX: 14, aimZ: 3, color: LED, intensity: 2300, castShadow: false },
  { id: 'court-w', x: -19, z: -15, height: 11, aimX: -3, aimZ: -14, color: SODIUM, intensity: 2800, castShadow: true },
  { id: 'court-e', x: 19, z: -15, height: 11, aimX: 4, aimZ: -17, color: SODIUM, intensity: 2400, castShadow: false },
  { id: 'quay-w', x: -32, z: -24, height: 13, aimX: -12, aimZ: -36, color: LED, intensity: 3600, castShadow: true },
];

export interface SolidBox {
  id: string;
  center: { x: number; y: number; z: number };
  half: { x: number; y: number; z: number };
}

/** Gantry crane dimensions (metres, local frame: +X along the quay, -Z towards the water). */
export const CRANE = {
  legX: 8,
  legZ: 5,
  legSize: 0.9,
  portalY: 17,
  boomY: 19,
  boomBack: 12,
  boomReach: 34,
  boomGauge: 3.2,
  apexY: 27,
  color: 0xf0a81c,
  /** Two work lights under the portal beam. */
  workLight: { color: 0xdbe8ff, intensity: 2600, y: 16.4 },
} as const;

/** Colliders of the crane: the four legs and the two sill beams. */
export function craneSolids(): SolidBox[] {
  const out: SolidBox[] = [];
  for (const site of CRANE_SITES) {
    const { x, z } = site.position;
    const h = CRANE.portalY / 2;
    const s = CRANE.legSize / 2;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        out.push({ id: `${site.id}/leg-${sx}-${sz}`, center: { x: x + sx * CRANE.legX, y: h, z: z + sz * CRANE.legZ }, half: { x: s, y: h, z: s } });
      }
    }
    for (const sz of [-1, 1]) {
      out.push({ id: `${site.id}/sill-${sz}`, center: { x, y: 0.7, z: z + sz * CRANE.legZ }, half: { x: CRANE.legX + s, y: 0.7, z: 0.6 } });
    }
  }
  return out;
}

export type PropKind = 'barrier' | 'drum' | 'pallet' | 'cabin' | 'bollard' | 'cone';

export interface Prop {
  kind: PropKind;
  x: number;
  z: number;
  yaw: number;
  /** 0..1, picks colour / stack height. */
  variant: number;
}

/** Collision half extents per prop kind (cones have none). */
export const PROP_SIZE: Record<PropKind, { hx: number; hy: number; hz: number; solid: boolean }> = {
  barrier: { hx: 1.5, hy: 0.42, hz: 0.3, solid: true },
  drum: { hx: 0.3, hy: 0.45, hz: 0.3, solid: true },
  pallet: { hx: 0.6, hy: 0.55, hz: 0.5, solid: true },
  cabin: { hx: 3.05, hy: 1.45, hz: 1.25, solid: true },
  bollard: { hx: 0.3, hy: 0.35, hz: 0.3, solid: true },
  cone: { hx: 0.18, hy: 0.35, hz: 0.18, solid: false },
};

function row(kind: PropKind, x0: number, z0: number, dx: number, dz: number, n: number, yaw: number, v0 = 0.1): Prop[] {
  return Array.from({ length: n }, (_, i) => ({ kind, x: x0 + dx * i, z: z0 + dz * i, yaw, variant: (v0 + i * 0.37) % 1 }));
}

/**
 * Hand-placed props. They stay out of the yard lanes (robots patrol there), the boss arena and the
 * spawn disc: gate chicane, site office, drum and pallet dumps on the apron and the court, mooring
 * bollards along the quay edge.
 */
export const PROPS: readonly Prop[] = [
  // gate chicane: two staggered rows of concrete barriers
  ...row('barrier', -13.5, 22.6, 3.15, 0, 3, 0, 0.2),
  ...row('barrier', 7.2, 24.4, 3.15, 0, 3, 0, 0.6),
  { kind: 'cone', x: -3.4, z: 22.7, yaw: 0, variant: 0.1 },
  { kind: 'cone', x: 5.2, z: 24.5, yaw: 0, variant: 0.5 },
  { kind: 'cone', x: -1.0, z: 26.4, yaw: 0, variant: 0.9 },
  // site office and its yard clutter (south-east corner)
  { kind: 'cabin', x: 27.5, z: 29.6, yaw: 0, variant: 0.3 },
  ...row('drum', 22.2, 31.6, 0.72, 0, 3, 0, 0.15),
  { kind: 'drum', x: 22.6, z: 30.9, yaw: 0.6, variant: 0.8 },
  { kind: 'pallet', x: 31.6, z: 25.6, yaw: 0.2, variant: 0.9 },
  { kind: 'pallet', x: 33.0, z: 26.9, yaw: 1.4, variant: 0.4 },
  // south-west dump
  ...row('pallet', -31.5, 30.5, 1.5, 0, 3, 0.05, 0.3),
  ...row('drum', -26.4, 31.8, 0.7, 0.05, 4, 0, 0.55),
  { kind: 'drum', x: -26.0, z: 31.1, yaw: 0, variant: 0.2 },
  { kind: 'barrier', x: -30.5, z: 26.0, yaw: Math.PI / 2, variant: 0.4 },
  // relay court: cover on both flanks of the tower
  ...row('barrier', -12.4, -12.2, 3.15, 0, 2, 0, 0.7),
  ...row('barrier', 6.3, -15.8, 3.15, 0, 2, 0, 0.1),
  ...row('drum', -30.6, -11.6, 0.72, 0, 3, 0, 0.35),
  { kind: 'pallet', x: 30.4, z: -12.2, yaw: 0.3, variant: 0.75 },
  { kind: 'pallet', x: 31.9, z: -11.4, yaw: 1.1, variant: 0.2 },
  // quay: mooring bollards on the edge and cover at the arena rim
  ...row('bollard', -30, LAND.minZ + 1.5, 10, 0, 5, 0, 0.5),
  { kind: 'bollard', x: 31, z: LAND.minZ + 1.5, yaw: 0, variant: 0.5 },
  ...row('barrier', 12.2, -24.6, 0, -3.15, 2, Math.PI / 2, 0.3),
  { kind: 'drum', x: -31.6, z: -44.0, yaw: 0, variant: 0.6 },
  { kind: 'drum', x: -30.9, z: -44.6, yaw: 0, variant: 0.05 },
  { kind: 'pallet', x: -31.4, z: -46.6, yaw: 0.5, variant: 0.6 },
];

/** Axis-aligned collider of a prop (yaw is 0 or PI/2 for the solid kinds that are not square). */
export function propSolid(p: Prop): SolidBox | null {
  const s = PROP_SIZE[p.kind];
  if (!s.solid) return null;
  const quarter = Math.abs(Math.sin(p.yaw)) > 0.7;
  return {
    id: `${p.kind}@${p.x.toFixed(1)},${p.z.toFixed(1)}`,
    center: { x: p.x, y: s.hy, z: p.z },
    half: { x: quarter ? s.hz : s.hx, y: s.hy, z: quarter ? s.hx : s.hz },
  };
}

/** Every solid of this module, for physics and for tests that need the walkable area. */
export function structureSolids(): SolidBox[] {
  const masts: SolidBox[] = FLOOD_LIGHTS.map((f) => ({ id: `mast-${f.id}`, center: { x: f.x, y: f.height / 2, z: f.z }, half: { x: 0.22, y: f.height / 2, z: 0.22 } }));
  const props = PROPS.map(propSolid).filter((s): s is SolidBox => s !== null);
  return [...craneSolids(), ...masts, ...props];
}
