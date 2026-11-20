import { MeshBuilder } from '@/world/meshBuilder';
import { GATES } from './tunables';
import type { BufferGeometry } from 'three';

/**
 * Chain-link fences with swing gates (spec 30). Pure layout, a small per-gate state machine and the
 * geometry; the structures module adds meshes and colliders and drives `GateSystem.update`.
 *
 * Fence runs are solid world colliders (robots path around them, through the gate gaps). Each gate leaf is
 * a collider in the GATE group: it stops walkers while closed and is disabled while the leaf swings or
 * stands open; bullets, sight lines and the nav bake ignore it, so robots route through closed gates and
 * open them when they arrive.
 */

export interface FenceRun {
  readonly x0: number;
  readonly x1: number;
  readonly z: number;
}

export interface Leaf {
  /** Hinge position (on the fence line). */
  readonly hx: number;
  readonly z: number;
  /** Leaf length along +x (1) or -x (-1) from the hinge when closed. */
  readonly dir: 1 | -1;
  readonly length: number;
}

export interface GateDef {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly leaves: readonly Leaf[];
}

type LineCfg = (typeof GATES.lines)[number];
type GateCfg = (typeof GATES.gates)[number];

function lineOf(g: GateCfg): LineCfg {
  const l = GATES.lines.find((q) => q.id === g.line);
  if (!l) throw new Error(`gate ${g.id}: unknown fence line ${g.line}`);
  return l;
}

/** Gates in world coordinates, with their leaves (hinges at the gap ends). */
export function gateDefs(): GateDef[] {
  return GATES.gates.map((g) => {
    const l = lineOf(g);
    const x0 = g.x - g.width / 2;
    const x1 = g.x + g.width / 2;
    const leaves: Leaf[] =
      g.leaves === 2
        ? [
            { hx: x0, z: l.z, dir: 1, length: g.width / 2 },
            { hx: x1, z: l.z, dir: -1, length: g.width / 2 },
          ]
        : [{ hx: x0, z: l.z, dir: 1, length: g.width }];
    return { id: g.id, x: g.x, z: l.z, width: g.width, leaves };
  });
}

/** Fence runs: every line minus its gate gaps. */
export function fenceRuns(): FenceRun[] {
  const out: FenceRun[] = [];
  for (const l of GATES.lines) {
    const gaps = GATES.gates
      .filter((g) => g.line === l.id)
      .map((g) => [g.x - g.width / 2, g.x + g.width / 2] as const)
      .sort((a, b) => a[0] - b[0]);
    let x: number = l.x0;
    for (const [g0, g1] of gaps) {
      if (g0 - x > 0.2) out.push({ x0: x, x1: g0, z: l.z });
      x = g1;
    }
    if (l.x1 - x > 0.2) out.push({ x0: x, x1: l.x1, z: l.z });
  }
  return out;
}

/** Distance from point (px, pz) to the closed leaf segment. */
export function distanceToLeaf(leaf: Leaf, px: number, pz: number): number {
  const ax = leaf.hx;
  const bx = leaf.hx + leaf.dir * leaf.length;
  const lo = Math.min(ax, bx);
  const hi = Math.max(ax, bx);
  const cx = Math.max(lo, Math.min(hi, px));
  return Math.hypot(px - cx, pz - leaf.z);
}

export type GatePhase = 'closed' | 'opening' | 'open' | 'closing';

/** One gate's motion: `angle` 0 = closed, `GATES.openAngle` = open; `side` +1 swings towards +z (south). */
export class GateState {
  phase: GatePhase = 'closed';
  angle = 0;
  side: 1 | -1 = 1;
  private idle = 0;

  constructor(readonly def: GateDef) {}

  /** True while the leaves must not block anyone (anything but fully closed). */
  get passable(): boolean {
    return this.phase !== 'closed';
  }

  /**
   * Advances one step. `touchZ` is the z of whoever touched it this step (player first, else a robot),
   * or null; `anyoneNear` blocks closing. Returns 'opened' / 'closed' on the step a swing starts / ends.
   */
  step(dt: number, touchZ: number | null, anyoneNear: boolean): 'opened' | 'closed' | null {
    let ev: 'opened' | 'closed' | null = null;
    if (touchZ !== null && (this.phase === 'closed' || this.phase === 'closing')) {
      // swing away from whoever pushes: someone south (+z) of the line pushes the leaves north
      if (this.phase === 'closed') this.side = touchZ > this.def.z ? -1 : 1;
      this.phase = 'opening';
      ev = 'opened';
    }
    if (anyoneNear || touchZ !== null) this.idle = 0;
    else this.idle += dt;
    const target = GATES.openAngle;
    if (this.phase === 'opening') {
      this.angle = Math.min(target, this.angle + GATES.swingSpeed * dt);
      if (this.angle >= target) this.phase = 'open';
    } else if (this.phase === 'open') {
      if (this.idle >= GATES.closeDelay && !anyoneNear) this.phase = 'closing';
    } else if (this.phase === 'closing') {
      this.angle = Math.max(0, this.angle - GATES.swingSpeed * 0.6 * dt);
      if (this.angle <= 0) {
        this.phase = 'closed';
        this.idle = 0;
        ev = 'closed';
      }
    }
    return ev;
  }

  /** Yaw (about +y) of a leaf pivot: rotates the leaf from its closed direction towards `side`. */
  leafYaw(leaf: Leaf): number {
    // a leaf along +x rotated by +a about +y points towards -z; swing towards side (+z => negative yaw)
    return -this.side * leaf.dir * this.angle;
  }
}

export interface Walker {
  readonly x: number;
  readonly z: number;
}

/** All gates; `update` returns the gates whose swing started or ended this step (for sound). */
export class GateSystem {
  readonly gates: GateState[];

  constructor(defs: readonly GateDef[] = gateDefs()) {
    this.gates = defs.map((d) => new GateState(d));
  }

  update(dt: number, player: Walker | null, enemies: readonly Walker[]): Array<{ gate: GateState; event: 'opened' | 'closed' }> {
    const out: Array<{ gate: GateState; event: 'opened' | 'closed' }> = [];
    for (const g of this.gates) {
      const d = g.def;
      let touchZ: number | null = null;
      if (player && g.def.leaves.some((l) => distanceToLeaf(l, player.x, player.z) <= GATES.touchDistance)) touchZ = player.z;
      if (touchZ === null) {
        for (const e of enemies) {
          if (d.leaves.some((l) => distanceToLeaf(l, e.x, e.z) <= GATES.enemyDistance)) {
            touchZ = e.z;
            break;
          }
        }
      }
      const near = (w: Walker): boolean => Math.hypot(w.x - d.x, w.z - d.z) <= Math.max(GATES.clearRadius, d.width / 2 + 0.6);
      const anyoneNear = (player !== null && near(player)) || enemies.some(near);
      const ev = g.step(dt, touchZ, anyoneNear);
      if (ev) out.push({ gate: g, event: ev });
    }
    return out;
  }
}

/** Collider box of a closed leaf (centre and half extents). */
export function leafBox(leaf: Leaf): { center: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } } {
  const h = GATES.fenceHeight - 0.15;
  return {
    center: { x: leaf.hx + (leaf.dir * leaf.length) / 2, y: h / 2 + 0.05, z: leaf.z },
    half: { x: leaf.length / 2 - 0.04, y: h / 2, z: Math.max(GATES.leafThickness, 0.12) },
  };
}

/** Collider boxes of the fence runs. */
export function fenceBoxes(): Array<{ center: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } }> {
  return fenceRuns().map((r) => ({
    center: { x: (r.x0 + r.x1) / 2, y: GATES.fenceHeight / 2, z: r.z },
    half: { x: (r.x1 - r.x0) / 2, y: GATES.fenceHeight / 2, z: 0.08 },
  }));
}

/**
 * Leaf geometry in the leaf's local frame: hinge at the origin, leaf along +x (length `len`), ground at y = 0.
 * `frame` = tube frame, brace, latch and a hazard band; `mesh` = the chain-link panel (UV in metres).
 */
export function leafGeometry(len: number): { frame: BufferGeometry; mesh: BufferGeometry; band: BufferGeometry } {
  const h = GATES.fenceHeight - 0.15;
  const frame = new MeshBuilder();
  const mesh = new MeshBuilder();
  const band = new MeshBuilder();
  const y0 = 0.08;
  const y1 = h;
  frame.beam([0.03, y0, 0], [0.03, y1, 0], 0.045);
  frame.beam([len - 0.03, y0, 0], [len - 0.03, y1, 0], 0.045);
  frame.beam([0, y1, 0], [len, y1, 0], 0.04);
  frame.beam([0, y0, 0], [len, y0, 0], 0.04);
  frame.beam([0.05, y0 + 0.05, 0], [len - 0.05, y1 - 0.05, 0], 0.025);
  // hinges and latch
  for (const y of [y0 + 0.25, y1 - 0.25]) frame.box(0.0, y, 0, 0.05, 0.06, 0.05);
  frame.box(len - 0.04, (y0 + y1) / 2, 0, 0.04, 0.08, 0.06);
  mesh.quad([0, y0, 0], [len, y0, 0], [len, y1, 0], [0, y1, 0], [0, 0, len, y1 - y0]);
  // hazard band across the middle (both faces)
  const by = (y0 + y1) / 2;
  band.box(len / 2, by, 0, len / 2 - 0.05, 0.09, 0.012);
  return { frame: frame.build(), mesh: mesh.build(), band: band.build() };
}
