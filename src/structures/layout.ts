import { CRANE_SITES, LAND, fromLegacyZ } from '@/config/level';

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

const LEGACY_FLOOD_LIGHTS: readonly FloodLight[] = [
  { id: 'gate-w', x: -21, z: 25, height: 11, aimX: -9, aimZ: 13, color: SODIUM, intensity: 2600, castShadow: true },
  { id: 'gate-e', x: 21, z: 25, height: 11, aimX: 9, aimZ: 13, color: SODIUM, intensity: 2600, castShadow: true },
  { id: 'yard-w', x: -33.6, z: 2, height: 12, aimX: -14, aimZ: 3, color: LED, intensity: 2300, castShadow: false },
  { id: 'yard-e', x: 33.6, z: 2, height: 12, aimX: 14, aimZ: 3, color: LED, intensity: 2300, castShadow: false },
  { id: 'court-w', x: -19, z: -15, height: 11, aimX: -3, aimZ: -14, color: SODIUM, intensity: 2800, castShadow: true },
  { id: 'court-e', x: 19, z: -15, height: 11, aimX: 4, aimZ: -17, color: SODIUM, intensity: 2400, castShadow: false },
  { id: 'quay-w', x: -32, z: -24, height: 13, aimX: -12, aimZ: -36, color: LED, intensity: 3600, castShadow: true },
];

/** Authored in the half-depth frame; stretched with the zones (x and heights are unchanged). */
export const FLOOD_LIGHTS: readonly FloodLight[] = LEGACY_FLOOD_LIGHTS.map((f) => ({ ...f, z: fromLegacyZ(f.z), aimZ: fromLegacyZ(f.aimZ) }));

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
const LEGACY_PROPS: readonly Prop[] = [
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

/** Props of the half-depth frame moved onto the stretched zones (rows keep their own spacing). */
export const PROPS: readonly Prop[] = LEGACY_PROPS.map((p) => ({ ...p, z: fromLegacyZ(p.z) }));

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

// ---- parked vehicles (models: public/assets/props/vehicles.glb, built by tools/asset-pipeline/props.py) ----

export type VehicleKind = 'truck' | 'semi' | 'van' | 'pickup' | 'suv' | 'sedan' | 'hatchback' | 'forklift';

/** Footprint half extents (hx = width, hz = length, at yaw 0) and height, as printed by props.py. */
export const VEHICLE_SIZE: Record<VehicleKind, { hx: number; hz: number; h: number }> = {
  truck: { hx: 1.62, hz: 2.56, h: 3.05 },
  semi: { hx: 1.62, hz: 6.38, h: 3.84 },
  van: { hx: 1.16, hz: 2.42, h: 2.22 },
  pickup: { hx: 1.16, hz: 2.07, h: 1.81 },
  suv: { hx: 1.16, hz: 2.07, h: 1.88 },
  sedan: { hx: 1.16, hz: 2.15, h: 1.65 },
  hatchback: { hx: 1.16, hz: 2.1, h: 1.65 },
  forklift: { hx: 0.72, hz: 2.17, h: 2.58 },
};

export interface Vehicle {
  kind: VehicleKind;
  x: number;
  z: number;
  /** Multiples of PI/2 only: the collider is axis-aligned. */
  yaw: number;
  /** Multiplies the baked paint (white body panels take the colour, black parts stay black). */
  tint: number;
  /** Wrecks lie on a side or on the roof (the roll is about the vehicle's length axis). */
  wreck?: 'side' | 'roof';
  /** Flames on the wreck and a smoke column. */
  burning?: boolean;
}

const Q = Math.PI / 2;
const WHITE = 0xffffff;
const SILVER = 0xb8bcc0;
const RED = 0x9a2a22;
const NAVY = 0x5a7bb0;
const OLIVE = 0x6d7550;
const ORANGE = 0xd9772a;
/** Burnt-out paint: multiplies the baked colours down to charcoal. */
const BURNT = 0x3b332d;

/**
 * Hand-placed, final-frame coordinates: a staff car park and a truck waiting at the gate (apron, inside the
 * robot-free spawn disc), a forklift at the pallet dump, a pickup in the relay court, a box truck and a van
 * on the quay, and a semi parked between the crane legs. All of them stay off the yard lanes, the patrol
 * routes, the supply spots and the safe-container doors (`structures/layout.test.ts`).
 */
export const VEHICLES: readonly Vehicle[] = [
  // gate apron: west car park, nose to the fence
  { kind: 'sedan', x: -31, z: 19.3, yaw: 0, tint: SILVER },
  { kind: 'hatchback', x: -28, z: 19.3, yaw: 0, tint: RED },
  { kind: 'suv', x: -25, z: 19.3, yaw: 0, tint: NAVY },
  // gate apron: east car park
  { kind: 'van', x: 17.6, z: 18.4, yaw: 0, tint: WHITE },
  { kind: 'pickup', x: 21, z: 18.2, yaw: 0, tint: OLIVE },
  // truck with trailer queuing at the gate
  { kind: 'semi', x: -12, z: 24, yaw: Q, tint: WHITE },
  // forklift at the south-west pallet dump, forks towards the pallets
  { kind: 'forklift', x: -21, z: 31.2, yaw: -Q, tint: WHITE },
  // relay court, west edge
  { kind: 'pickup', x: -30, z: -39.2, yaw: Q, tint: SILVER },
  // quay
  { kind: 'truck', x: -27, z: -43, yaw: Q, tint: ORANGE },
  { kind: 'van', x: 16, z: -85.4, yaw: Q, tint: SILVER },
  { kind: 'semi', x: 25, z: -75.5, yaw: Q, tint: WHITE },
  // burning wrecks: the robots got here first
  { kind: 'sedan', x: 28, z: 23, yaw: 0, tint: BURNT, wreck: 'side', burning: true },
  { kind: 'van', x: -21, z: -29.5, yaw: Q, tint: BURNT, wreck: 'roof', burning: true },
  { kind: 'hatchback', x: -22, z: -46.5, yaw: 0, tint: BURNT, wreck: 'side', burning: true },
];

/** Half extents of the vehicle body in its own frame after the wreck roll (x across, y up, z along). */
export function vehicleBodyHalf(v: Vehicle): { x: number; y: number; z: number } {
  const s = VEHICLE_SIZE[v.kind];
  if (v.wreck === 'side') return { x: s.h / 2, y: s.hx, z: s.hz };
  return { x: s.hx, y: s.h / 2, z: s.hz };
}

export interface FireSpot {
  x: number;
  y: number;
  z: number;
  /** Flame width and height (m). */
  w: number;
  h: number;
  /** 0..1, de-synchronises the flame animation. */
  seed: number;
}

/** Flames of a burning vehicle: a big one in the middle of the body and a smaller one towards one end. */
export function vehicleFires(v: Vehicle): FireSpot[] {
  if (!v.burning) return [];
  const half = vehicleBodyHalf(v);
  const top = half.y * 2 - 0.35;
  const spot = (along: number, w: number, h: number, seed: number): FireSpot => ({
    x: v.x + Math.sin(v.yaw) * along,
    y: top,
    z: v.z + Math.cos(v.yaw) * along,
    w,
    h,
    seed,
  });
  const frac = (n: number) => ((n % 1) + 1) % 1;
  return [spot(0, 2.2, 3.2, frac(v.x * 0.37 + v.z * 0.11)), spot(half.z * 0.55, 1.4, 2.1, frac(v.x * 0.13 + v.z * 0.29 + 0.5))];
}

/** Axis-aligned collider of a parked vehicle (the whole body, ground to roof). */
export function vehicleSolid(v: Vehicle): SolidBox {
  const b = vehicleBodyHalf(v);
  const quarter = Math.abs(Math.sin(v.yaw)) > 0.7;
  return {
    id: `${v.kind}@${v.x.toFixed(1)},${v.z.toFixed(1)}`,
    center: { x: v.x, y: b.y, z: v.z },
    half: { x: quarter ? b.z : b.x, y: b.y, z: quarter ? b.x : b.z },
  };
}

// ---- scanned industrial clutter (models: public/assets/props/industrial.glb, built by industrial.py) ----

export type DressingKind = 'cabinet_a' | 'cabinet_b' | 'barrier' | 'barrel_red' | 'barrel_blue' | 'tyre' | 'generator' | 'worklight';

/** Footprint half extents (hx across, hz deep at yaw 0) and height, as printed by industrial.py. */
export const DRESSING_SIZE: Record<DressingKind, { hx: number; hz: number; h: number }> = {
  cabinet_a: { hx: 0.35, hz: 0.29, h: 1.51 },
  cabinet_b: { hx: 0.62, hz: 0.29, h: 1.51 },
  barrier: { hx: 0.78, hz: 0.22, h: 1.11 },
  barrel_red: { hx: 0.28, hz: 0.28, h: 0.88 },
  barrel_blue: { hx: 0.32, hz: 0.32, h: 0.93 },
  tyre: { hx: 0.3, hz: 0.3, h: 0.17 },
  generator: { hx: 0.41, hz: 0.29, h: 0.58 },
  worklight: { hx: 0.39, hz: 0.64, h: 1.79 },
};

export interface Dressing {
  kind: DressingKind;
  x: number;
  z: number;
  /** Multiples of PI/2 for the collider; `jitter` turns the model a little without moving the collider. */
  yaw: number;
  jitter?: number;
  /** Tyres only: how many lie on top of each other. */
  stack?: number;
}

const barrierRow = (x0: number, z: number, n: number, yaw = 0): Dressing[] =>
  Array.from({ length: n }, (_, i) => ({ kind: 'barrier' as const, x: x0 + i * 1.6 * Math.cos(yaw), z: z - i * 1.6 * Math.sin(yaw), yaw }));

/**
 * Dense clutter on the gate apron (the robot-free spawn area), in the spirit of a working terminal: an
 * electrical corner on the west fence, barrier walls that narrow the apron into lanes, barrel and tyre dumps
 * and a generator with a work light next to the burning wreck.
 */
export const DRESSING: readonly Dressing[] = [
  // west fence: electrical corner
  { kind: 'cabinet_b', x: -34.8, z: 22.6, yaw: Q },
  { kind: 'cabinet_a', x: -34.8, z: 23.9, yaw: Q },
  { kind: 'cabinet_b', x: -34.8, z: 25.0, yaw: Q },
  { kind: 'generator', x: -33.3, z: 24.2, yaw: Q, jitter: 0.15 },
  { kind: 'worklight', x: -33.6, z: 26.6, yaw: Q, jitter: -0.3 },
  // barrier walls: narrow the apron into lanes on both sides of the spawn
  ...barrierRow(-12.4, 28.6, 4),
  ...barrierRow(8.0, 28.6, 4),
  ...barrierRow(16.0, 21.9, 3),
  // tyre dump between the truck and the forklift
  { kind: 'tyre', x: -26.4, z: 27.4, yaw: 0, stack: 4 },
  { kind: 'tyre', x: -25.6, z: 28.1, yaw: 0, stack: 2 },
  { kind: 'tyre', x: -26.6, z: 28.4, yaw: 0, stack: 1, jitter: 0.4 },
  // barrels by the west car park
  { kind: 'barrel_red', x: -22.8, z: 17.3, yaw: 0, jitter: 0.4 },
  { kind: 'barrel_red', x: -22.2, z: 17.8, yaw: 0, jitter: 1.1 },
  { kind: 'barrel_blue', x: -22.9, z: 18.0, yaw: 0, jitter: 2.0 },
  // east: cabinets by the gate mast, barrels by the site office
  { kind: 'cabinet_b', x: 18.6, z: 25.0, yaw: Math.PI },
  { kind: 'cabinet_a', x: 19.9, z: 25.0, yaw: Math.PI },
  { kind: 'barrel_blue', x: 23.6, z: 26.0, yaw: 0, jitter: 0.7 },
  { kind: 'barrel_red', x: 24.3, z: 25.8, yaw: 0, jitter: 2.4 },
  { kind: 'barrel_blue', x: 23.6, z: 25.1, yaw: 0, jitter: 1.6 },
  // fire crew kit next to the burning wreck
  { kind: 'generator', x: 25.1, z: 24.1, yaw: Q, jitter: -0.2 },
  { kind: 'worklight', x: 25.2, z: 22.2, yaw: -Q, jitter: 0.35 },
];

/** Axis-aligned collider of a clutter item (tyre stacks grow with their count). */
export function dressingSolid(d: Dressing): SolidBox {
  const s = DRESSING_SIZE[d.kind];
  const quarter = Math.abs(Math.sin(d.yaw)) > 0.7;
  const h = d.kind === 'tyre' ? s.h * (d.stack ?? 1) : s.h;
  return {
    id: `${d.kind}@${d.x.toFixed(1)},${d.z.toFixed(1)}`,
    center: { x: d.x, y: h / 2, z: d.z },
    half: { x: quarter ? s.hz : s.hx, y: h / 2, z: quarter ? s.hx : s.hz },
  };
}

/** Every solid of this module, for physics and for tests that need the walkable area. */
export function structureSolids(): SolidBox[] {
  const masts: SolidBox[] = FLOOD_LIGHTS.map((f) => ({ id: `mast-${f.id}`, center: { x: f.x, y: f.height / 2, z: f.z }, half: { x: 0.22, y: f.height / 2, z: 0.22 } }));
  const props = PROPS.map(propSolid).filter((s): s is SolidBox => s !== null);
  return [...craneSolids(), ...masts, ...props, ...VEHICLES.map(vehicleSolid), ...DRESSING.map(dressingSolid)];
}
