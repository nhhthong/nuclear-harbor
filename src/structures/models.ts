import type { BufferGeometry } from 'three';
import { MeshBuilder } from '@/world/meshBuilder';
import { CRANE } from './layout';

type V3 = readonly [number, number, number];

/** N-sided prism side walls between two rings (radius r0 at y0, r1 at y1), outward facing. */
function ring(b: MeshBuilder, cx: number, cz: number, y0: number, r0: number, y1: number, r1: number, sides: number): void {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const p = (a: number, r: number, y: number): V3 => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    // counter-clockwise seen from outside: lower a1 -> lower a0 -> upper a0 -> upper a1
    b.quad(p(a1, r0, y0), p(a0, r0, y0), p(a0, r1, y1), p(a1, r1, y1));
  }
}

/** Flat cap of an N-gon at height y, facing up (or down). */
function cap(b: MeshBuilder, cx: number, cz: number, y: number, r: number, sides: number, up: boolean): void {
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2;
    const a1 = ((i + 1) / sides) * Math.PI * 2;
    const c: V3 = [cx, y, cz];
    const p0: V3 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r];
    const p1: V3 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
    if (up) b.quad(c, p1, p0, p0);
    else b.quad(c, p0, p1, p1);
  }
}

export interface MastGeometry {
  /** Galvanised pole, base, cross arm and lamp housings. */
  steel: BufferGeometry;
  /** Lamp lenses (emissive). */
  lens: BufferGeometry;
  /** Local position of the middle lens and the local direction the heads point (before the mast yaw). */
  headY: number;
  headZ: number;
}

/** Flood-light mast of height 1 unit pole scale is NOT used: build per height so sections stay square. */
export function buildMast(height: number): MastGeometry {
  const steel = new MeshBuilder();
  const lens = new MeshBuilder();
  steel.box(0, 0.06, 0, 0.45, 0.06, 0.45); // base plate
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) steel.box(sx * 0.34, 0.15, sz * 0.34, 0.04, 0.05, 0.04); // anchor bolts
  steel.beam([0, 0.12, 0], [0, height * 0.55, 0], 0.3);
  steel.beam([0, height * 0.55, 0], [0, height, 0], 0.22);
  steel.box(0.2, 1.3, 0, 0.06, 0.28, 0.14); // junction box
  // climbing rungs
  for (let y = 1.8; y < height - 0.8; y += 0.45) steel.box(0, y, -0.19, 0.16, 0.012, 0.012);
  // cross arm with three heads tilted down and forward (+Z)
  const armY = height - 0.15;
  steel.beam([-1.15, armY, 0], [1.15, armY, 0], 0.12, 0.1);
  const headY = armY - 0.24;
  const headZ = 0.42;
  for (const hx of [-0.9, 0, 0.9]) {
    steel.beam([hx, armY, 0.02], [hx, armY - 0.1, 0.16], 0.06, 0.06);
    steel.beam([hx, armY - 0.06, 0.1], [hx, headY - 0.04, headZ + 0.06], 0.56, 0.2);
    // hood fins
    for (const fx of [-0.2, 0, 0.2]) steel.beam([hx + fx, armY + 0.02, 0.1], [hx + fx, headY + 0.08, headZ], 0.02, 0.06);
    // lens: thin slab on the underside of the housing
    lens.beam([hx, armY - 0.17, 0.17], [hx, headY - 0.13, headZ + 0.0], 0.5, 0.02);
  }
  return { steel: steel.build(), lens: lens.build(), headY, headZ };
}

export interface CraneGeometry {
  paint: BufferGeometry;
  dark: BufferGeometry;
  /** Cab windows and work-light lenses. */
  glow: BufferGeometry;
  /** Red obstruction lights. */
  beacon: BufferGeometry;
}

/** Ship-to-shore gantry crane in its local frame (see CRANE): legs, bracing, boom, A-frame, stays, stairs, cab. */
export function buildCrane(): CraneGeometry {
  const p = new MeshBuilder();
  const d = new MeshBuilder();
  const glow = new MeshBuilder();
  const beacon = new MeshBuilder();
  const { legX, legZ, legSize, portalY, boomY, boomBack, boomReach, boomGauge, apexY } = CRANE;

  // bogies and sill beams
  for (const sz of [-1, 1]) {
    p.box(0, 1.05, sz * legZ, legX + 0.9, 0.35, 0.5);
    for (const sx of [-1, 1]) {
      d.box(sx * legX, 0.42, sz * legZ, 1.5, 0.3, 0.42);
      for (const wx of [-1.0, -0.35, 0.35, 1.0]) d.box(sx * legX + wx, 0.2, sz * legZ, 0.24, 0.2, 0.5);
    }
  }
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.beam([sx * legX, 1.4, sz * legZ], [sx * legX, portalY, sz * legZ], legSize);
  // portal beams (top) and mid ties
  for (const sz of [-1, 1]) {
    p.beam([-legX, portalY, sz * legZ], [legX, portalY, sz * legZ], 0.9, 1.1);
    p.beam([-legX, 8.5, sz * legZ], [legX, 8.5, sz * legZ], 0.5, 0.6);
    // X bracing in the frame, between the mid tie and the portal beam
    p.beam([-legX, 8.8, sz * legZ], [legX, portalY - 0.6, sz * legZ], 0.3);
    p.beam([legX, 8.8, sz * legZ], [-legX, portalY - 0.6, sz * legZ], 0.3);
  }
  for (const sx of [-1, 1]) {
    p.beam([sx * legX, portalY, -legZ], [sx * legX, portalY, legZ], 0.8, 1.0);
    p.beam([sx * legX, 8.5, -legZ], [sx * legX, 8.5, legZ], 0.45, 0.5);
    p.beam([sx * legX, 1.6, -legZ], [sx * legX, 8.3, legZ], 0.26);
  }
  // boom: two girders along z with cross ties (lattice), reaching over the water (-z)
  const g = boomGauge / 2;
  for (const sx of [-1, 1]) {
    p.beam([sx * g, boomY, boomBack], [sx * g, boomY, -boomReach], 0.5, 0.9);
    p.beam([sx * g, portalY + 0.5, sx > 0 ? legZ : -legZ], [sx * g, boomY - 0.4, sx > 0 ? legZ : -legZ], 0.4);
  }
  for (let z = boomBack; z >= -boomReach; z -= 3) {
    p.beam([-g, boomY, z], [g, boomY, z], 0.2, 0.3);
    if (z - 3 >= -boomReach) p.beam([-g, boomY + 0.3, z], [g, boomY + 0.3, z - 3], 0.12);
  }
  // supports from the portal frame up to the boom
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.beam([sx * legX, portalY + 0.5, sz * legZ], [sx * g, boomY - 0.4, sz * legZ * 0.9], 0.45);
  // A-frame and stays
  for (const sx of [-1, 1]) {
    p.beam([sx * g, boomY + 0.4, legZ], [sx * 0.5, apexY, 0.5], 0.5);
    p.beam([sx * g, boomY + 0.4, -legZ], [sx * 0.5, apexY, 0.5], 0.5);
    d.beam([sx * 0.5, apexY, 0.5], [sx * g, boomY + 0.5, -boomReach + 1.5], 0.14);
    d.beam([sx * 0.5, apexY, 0.5], [sx * g, boomY + 0.5, -boomReach * 0.5], 0.14);
    d.beam([sx * 0.5, apexY, 0.5], [sx * g, boomY + 0.5, boomBack - 0.5], 0.14);
  }
  p.box(0, apexY + 0.1, 0.5, 0.9, 0.25, 0.4);
  // machinery house on the back of the boom
  p.box(0, boomY + 2.3, boomBack - 4.2, 2.4, 1.8, 3.6);
  d.box(0, boomY + 4.2, boomBack - 4.2, 2.5, 0.1, 3.7);
  for (const vz of [-2, 0, 2]) d.box(2.42, boomY + 2.6, boomBack - 4.2 + vz, 0.03, 0.5, 0.6); // louvres
  // trolley, operator cab and spreader hanging over the quay edge
  const trolleyZ = -legZ - 5;
  d.box(0, boomY - 0.75, trolleyZ, g + 0.3, 0.3, 1.6);
  p.box(1.2, boomY - 2.6, trolleyZ + 2.4, 1.1, 1.2, 1.3);
  glow.box(1.2, boomY - 2.7, trolleyZ + 2.4 - 1.32, 0.9, 0.55, 0.02);
  glow.box(1.2 - 1.12, boomY - 2.7, trolleyZ + 2.4, 0.02, 0.5, 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.beam([sx * 1.1, boomY - 1.0, trolleyZ + sz * 1.2], [sx * 1.1, 9.2, trolleyZ + sz * 0.9], 0.05);
  p.box(0, 9.0, trolleyZ, 1.3, 0.22, 3.05); // spreader
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) d.box(sx * 1.2, 8.7, trolleyZ + sz * 2.95, 0.1, 0.16, 0.1);
  // zig-zag stairs up the south-west leg with landings and hand rails
  const sx0 = -legX - 0.9;
  let y = 1.4;
  let dir = 1;
  while (y < portalY - 1.5) {
    const z0 = legZ - 0.2 - (dir > 0 ? 3.4 : 0);
    const z1 = z0 + 3.4;
    const [za, zb] = dir > 0 ? [z0, z1] : [z1, z0];
    d.beam([sx0, y, za], [sx0, y + 2.6, zb], 0.7, 0.08);
    d.beam([sx0 - 0.36, y + 1.0, za], [sx0 - 0.36, y + 3.6, zb], 0.04);
    d.box(sx0, y + 2.6, zb + (dir > 0 ? 0.45 : -0.45), 0.4, 0.04, 0.45);
    y += 2.6;
    dir = -dir;
  }
  // walkway with rail along the boom
  d.box(g + 0.55, boomY + 0.5, (boomBack - boomReach) / 2, 0.35, 0.03, (boomBack + boomReach) / 2);
  d.box(g + 0.9, boomY + 1.5, (boomBack - boomReach) / 2, 0.02, 0.02, (boomBack + boomReach) / 2);
  for (let z = boomBack; z >= -boomReach; z -= 2) d.box(g + 0.9, boomY + 1.0, z, 0.02, 0.5, 0.02);
  // work lights under the sea-side portal beam (lenses) and obstruction lights
  for (const sx of [-0.55, 0.55]) {
    d.box(sx * legX, portalY - 0.75, -legZ, 0.35, 0.14, 0.28);
    glow.box(sx * legX, portalY - 0.9, -legZ, 0.3, 0.012, 0.22);
  }
  beacon.box(0, apexY + 0.5, 0.5, 0.12, 0.14, 0.12);
  beacon.box(0, boomY + 0.75, -boomReach + 0.3, 0.12, 0.14, 0.12);
  beacon.box(0, boomY + 4.5, boomBack - 4.2, 0.12, 0.14, 0.12);
  return { paint: p.build(), dark: d.build(), glow: glow.build(), beacon: beacon.build() };
}

/** Concrete jersey barrier, 3 m long, centred, standing on y = 0. */
export function buildBarrier(): BufferGeometry {
  const b = new MeshBuilder();
  const hl = 1.5;
  // half profile (z, y) from the foot up to the top centre
  const prof: Array<[number, number]> = [
    [0.3, 0],
    [0.3, 0.09],
    [0.13, 0.33],
    [0.085, 0.84],
    [-0.085, 0.84],
    [-0.13, 0.33],
    [-0.3, 0.09],
    [-0.3, 0],
  ];
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i] as [number, number];
    const [z1, y1] = prof[i + 1] as [number, number];
    b.quad([-hl, y0, z0], [hl, y0, z0], [hl, y1, z1], [-hl, y1, z1]);
  }
  // end caps as three stacked quads
  for (const s of [-1, 1]) {
    const x = s * hl;
    const q = (za: number, ya: number, zb: number, yb: number, zc: number, yc: number, zd: number, yd: number): void => {
      if (s > 0) b.quad([x, ya, za], [x, yb, zb], [x, yc, zc], [x, yd, zd]);
      else b.quad([x, yb, zb], [x, ya, za], [x, yd, zd], [x, yc, zc]);
    };
    q(0.3, 0, -0.3, 0, -0.3, 0.09, 0.3, 0.09);
    q(0.3, 0.09, -0.3, 0.09, -0.13, 0.33, 0.13, 0.33);
    q(0.13, 0.33, -0.13, 0.33, -0.085, 0.84, 0.085, 0.84);
  }
  // lifting slots
  for (const sx of [-0.8, 0.8]) b.box(sx, 0.05, 0, 0.16, 0.05, 0.31);
  return b.build();
}

/** 200 l steel drum with rolling hoops and a rim, standing on y = 0. */
export function buildDrum(): BufferGeometry {
  const b = new MeshBuilder();
  const n = 14;
  const r = 0.29;
  const levels: Array<[number, number]> = [
    [0, r],
    [0.03, r + 0.012],
    [0.06, r],
    [0.29, r],
    [0.31, r + 0.014],
    [0.33, r],
    [0.57, r],
    [0.59, r + 0.014],
    [0.61, r],
    [0.84, r],
    [0.87, r + 0.012],
    [0.9, r],
  ];
  for (let i = 0; i < levels.length - 1; i++) {
    const [y0, r0] = levels[i] as [number, number];
    const [y1, r1] = levels[i + 1] as [number, number];
    ring(b, 0, 0, y0, r0, y1, r1, n);
  }
  cap(b, 0, 0, 0.875, r - 0.012, n, true);
  ring(b, 0, 0, 0.9, r - 0.012, 0.875, r - 0.012, n);
  cap(b, 0, 0, 0, r, n, false);
  b.box(0.15, 0.89, 0.02, 0.035, 0.012, 0.035); // bung
  return b.build();
}

/** Wooden pallet with two strapped crates, standing on y = 0. */
export function buildPallet(): { wood: BufferGeometry; crate: BufferGeometry } {
  const w = new MeshBuilder();
  const c = new MeshBuilder();
  for (const z of [-0.45, 0, 0.45]) w.box(0, 0.05, z, 0.6, 0.05, 0.05);
  for (let i = 0; i < 6; i++) w.box(-0.52 + i * 0.208, 0.115, 0, 0.085, 0.012, 0.5);
  for (const z of [-0.45, 0.45]) w.box(0, 0.012, z, 0.6, 0.012, 0.05);
  c.box(-0.05, 0.47, -0.05, 0.5, 0.34, 0.42);
  c.box(0.08, 0.96, 0.02, 0.36, 0.15, 0.3);
  // strapping
  for (const x of [-0.3, 0.2]) c.box(x - 0.05, 0.47, -0.05, 0.02, 0.345, 0.425);
  return { wood: w.build(), crate: c.build() };
}

/** Site office cabin (6.1 x 2.9 x 2.5 m): corrugated walls, door, roof, skids. Windows are separate (emissive). */
export function buildCabin(): { shell: BufferGeometry; trim: BufferGeometry; windows: BufferGeometry } {
  const s = new MeshBuilder();
  const t = new MeshBuilder();
  const win = new MeshBuilder();
  const hx = 3.05;
  const hz = 1.25;
  const y0 = 0.25;
  const y1 = 2.85;
  for (const z of [-0.9, 0.9]) t.box(0, 0.125, z, hx - 0.1, 0.125, 0.08); // skids
  s.box(0, y0 + 0.05, 0, hx, 0.05, hz); // floor
  s.box(0, y1 + 0.05, 0, hx + 0.06, 0.06, hz + 0.06); // roof
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(sx * (hx - 0.06), (y0 + y1) / 2, sz * (hz - 0.06), 0.06, (y1 - y0) / 2, 0.06);
  const h = y1 - y0 - 0.1;
  s.corrugated([-hx + 0.12, y0 + 0.1, hz - 0.05], [1, 0, 0], [0, 1, 0], [0, 0, 1], 2 * hx - 0.24, h, 0.18, 0.02);
  s.corrugated([hx - 0.12, y0 + 0.1, -hz + 0.05], [-1, 0, 0], [0, 1, 0], [0, 0, -1], 2 * hx - 0.24, h, 0.18, 0.02);
  s.corrugated([-hx + 0.05, y0 + 0.1, -hz + 0.12], [0, 0, 1], [0, 1, 0], [-1, 0, 0], 2 * hz - 0.24, h, 0.18, 0.02);
  s.corrugated([hx - 0.05, y0 + 0.1, hz - 0.12], [0, 0, -1], [0, 1, 0], [1, 0, 0], 2 * hz - 0.24, h, 0.18, 0.02);
  // door and window frames on the -z face (towards the yard)
  t.box(-1.9, y0 + 1.05, -hz + 0.03, 0.47, 1.05, 0.035);
  t.box(-1.56, y0 + 1.0, -hz - 0.02, 0.02, 0.07, 0.03); // handle
  for (const wx of [0.2, 1.9]) {
    t.box(wx, 1.75, -hz + 0.035, 0.64, 0.48, 0.03);
    win.box(wx, 1.75, -hz - 0.002, 0.56, 0.4, 0.004);
    t.box(wx, 1.75, -hz - 0.012, 0.02, 0.4, 0.008); // mullion
  }
  // step and an air-conditioning box
  t.box(-1.9, 0.12, -hz - 0.3, 0.5, 0.12, 0.25);
  t.box(2.6, 2.2, hz + 0.2, 0.35, 0.28, 0.2);
  // roof light above the door
  win.box(-1.9, 2.5, -hz - 0.06, 0.16, 0.05, 0.05);
  return { shell: s.build(), trim: t.build(), windows: win.build() };
}

/** Cast-iron mooring bollard. */
export function buildBollard(): BufferGeometry {
  const b = new MeshBuilder();
  const n = 12;
  ring(b, 0, 0, 0, 0.3, 0.06, 0.3, n);
  ring(b, 0, 0, 0.06, 0.3, 0.1, 0.2, n);
  ring(b, 0, 0, 0.1, 0.2, 0.5, 0.18, n);
  ring(b, 0, 0, 0.5, 0.18, 0.56, 0.32, n);
  ring(b, 0, 0, 0.56, 0.32, 0.66, 0.32, n);
  ring(b, 0, 0, 0.66, 0.32, 0.72, 0.2, n);
  cap(b, 0, 0, 0.72, 0.2, n, true);
  return b.build();
}

/** Traffic cone: base slab + cone body. The white band is added in the material via height. */
export function buildCone(): BufferGeometry {
  const b = new MeshBuilder();
  b.box(0, 0.015, 0, 0.19, 0.015, 0.19);
  ring(b, 0, 0, 0.03, 0.13, 0.7, 0.025, 10);
  cap(b, 0, 0, 0.7, 0.025, 10, true);
  return b.build();
}

export interface FenceGeometry {
  /** Posts, top rail and tension wires. */
  frame: BufferGeometry;
  /** Mesh panels: UVs repeat once per metre so a diamond texture tiles. */
  mesh: BufferGeometry;
}

/** Chain-link fence along a list of straight runs (ground kerb top = `baseY`). */
export function buildFence(runs: ReadonlyArray<{ x0: number; z0: number; x1: number; z1: number }>, baseY: number, height: number): FenceGeometry {
  const frame = new MeshBuilder();
  const mesh = new MeshBuilder();
  for (const r of runs) {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
    const n = Math.max(1, Math.round(len / 3));
    const dx = (r.x1 - r.x0) / len;
    const dz = (r.z1 - r.z0) / len;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * len;
      const x = r.x0 + dx * t;
      const z = r.z0 + dz * t;
      frame.beam([x, baseY, z], [x, baseY + height + 0.05, z], 0.07);
      // outrigger for the barbed wire
      frame.beam([x, baseY + height, z], [x - dz * 0.3, baseY + height + 0.35, z + dx * 0.3], 0.04);
    }
    frame.beam([r.x0, baseY + height, r.z0], [r.x1, baseY + height, r.z1], 0.05);
    frame.beam([r.x0, baseY + 0.05, r.z0], [r.x1, baseY + 0.05, r.z1], 0.03);
    for (const k of [0.12, 0.22, 0.32]) {
      frame.beam([r.x0 - dz * k, baseY + height + k * 1.1, r.z0 + dx * k], [r.x1 - dz * k, baseY + height + k * 1.1, r.z1 + dx * k], 0.012);
    }
    mesh.quad([r.x0, baseY, r.z0], [r.x1, baseY, r.z1], [r.x1, baseY + height, r.z1], [r.x0, baseY + height, r.z0], [0, 0, len, height]);
  }
  return { frame: frame.build(), mesh: mesh.build() };
}
