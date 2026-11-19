/**
 * Warehouse interior props (spec 29, stream C): meshes, GLB loading with procedural fallback, and colliders.
 * Placement comes from `warehouseProps.ts`. One InstancedMesh per prop kind (per primitive), the racks and the
 * workbench merged into one vertex-coloured mesh, the shrink-wrapped loads in one instanced translucent box.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { GameContext } from '@/core/GameContext';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import {
  WAREHOUSE_GLB_KINDS,
  WAREHOUSE_PROP_SIZE,
  layoutWarehouseProps,
  rackSides,
  type PlacedProp,
  type RackRow,
  type WarehouseGlbKind,
  type WarehousePropLayout,
} from './warehouseProps';
import { WAREHOUSE_PROPS } from './warehousePropsTunables';

interface LoadedGltf {
  scene: Object3D;
}
export type WarehousePropLoader = (url: string) => Promise<LoadedGltf>;
const defaultLoader: WarehousePropLoader = (url) => new GLTFLoader().loadAsync(url);

/** One primitive of a prop kind (most kinds have one; the lamp has its shade and its glass). */
export interface PropPart {
  geometry: BufferGeometry;
  material: Material;
  /** Lamp glass: drawn with the glow material. */
  glow?: boolean;
}

const KIND_SET = new Set<string>(WAREHOUSE_GLB_KINDS);

/** Parts per kind from the GLB scene (node name = kind; multi-material nodes are a group of meshes). */
export function warehousePropModelsFrom(gltf: LoadedGltf): Map<WarehouseGlbKind, PropPart[]> {
  const out = new Map<WarehouseGlbKind, PropPart[]>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const name = KIND_SET.has(o.name) ? o.name : o.parent && KIND_SET.has(o.parent.name) ? o.parent.name : null;
    if (!name) return;
    const kind = name as WarehouseGlbKind;
    const geometry = (o.geometry as BufferGeometry).clone();
    geometry.applyMatrix4(o.matrixWorld);
    geometry.computeBoundingSphere();
    const material = (Array.isArray(o.material) ? o.material[0] : o.material) as Material;
    const parts = out.get(kind) ?? [];
    parts.push({ geometry, material, glow: kind === 'lamp' && /glass/i.test(material.name) });
    out.set(kind, parts);
  });
  return out;
}

/** Loads the GLB; on failure every kind falls back to a box or cylinder. */
export async function loadWarehousePropModels(loader: WarehousePropLoader = defaultLoader): Promise<Map<WarehouseGlbKind, PropPart[]>> {
  try {
    return warehousePropModelsFrom(await loader(WAREHOUSE_PROPS.url));
  } catch (err) {
    console.warn('[structures] warehouse props unavailable, using boxes', WAREHOUSE_PROPS.url, err);
    return new Map();
  }
}

const ROUND = new Set<WarehouseGlbKind>(['barrel', 'propane_tank', 'extinguisher', 'trash_can', 'lamp']);
const FALLBACK_COLOR: Partial<Record<WarehouseGlbKind, number>> = {
  cardboard_box: 0xa98656,
  wooden_crate: 0x8a6a45,
  long_crate: 0x8a6a45,
  pallet: 0x9b7b52,
  plastic_crate: 0x2f6aa8,
  barrel: 0x1f4f8a,
  ibc_tank: 0xd8d8d0,
  propane_tank: 0xb03a2e,
  extinguisher: 0xc0281e,
  pallet_jack: 0xc0392b,
  wet_floor_sign: 0xe7c21b,
};

/** Procedural stand-in for a kind the GLB did not provide. */
export function fallbackParts(kind: WarehouseGlbKind): PropPart[] {
  const s = WAREHOUSE_PROP_SIZE[kind];
  const material = new MeshStandardMaterial({ color: FALLBACK_COLOR[kind] ?? 0x6f757a, roughness: 0.7, metalness: 0.2 });
  if (kind === 'lamp') {
    const shade = new CylinderGeometry(0.08, s.w / 2, 0.35, 12);
    shade.translate(0, 0.35 / 2 + 0.05, 0);
    const glass = new CylinderGeometry(s.w / 2 - 0.04, s.w / 2 - 0.04, 0.05, 12);
    glass.translate(0, 0.025, 0);
    return [
      { geometry: shade, material },
      { geometry: glass, material: new MeshBasicMaterial({ color: 0xffffff }), glow: true },
    ];
  }
  const g = ROUND.has(kind) ? new CylinderGeometry(s.w / 2, s.w / 2, s.h, 14) : new BoxGeometry(s.w, s.h, s.d);
  g.translate(0, s.h / 2, 0);
  return [{ geometry: g, material }];
}

const m4 = new Matrix4();
const q = new Quaternion();
const e = new Euler(0, 0, 0, 'YXZ');
const pos = new Vector3();
const ONE = new Vector3(1, 1, 1);

export function propMatrix(p: PlacedProp, out = new Matrix4()): Matrix4 {
  e.set(p.tilt ?? 0, p.yaw, 0, 'YXZ');
  q.setFromEuler(e);
  return out.compose(pos.set(p.x, p.y, p.z), q, ONE);
}

// ---- procedural racks + workbench: one vertex-coloured merged geometry -------------------------------

export class BoxBatch {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];
  private static readonly unit = new BoxGeometry(1, 1, 1);
  private readonly c = new Color();
  private readonly v = new Vector3();
  private readonly mat = new Matrix4();
  private readonly nmat = new Matrix4();

  /** Box of size (sx, sy, sz) centred at (x, y, z), rotated by `rotZ` about its own Z then by `yaw` about +Y around (ox, oz). */
  add(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, rotZ = 0): void {
    q.setFromEuler(e.set(0, 0, rotZ, 'YXZ'));
    this.mat.compose(pos.set(x, y, z), q, new Vector3(sx, sy, sz));
    this.push(this.mat, color);
  }

  addMatrix(m: Matrix4, color: number): void {
    this.push(m, color);
  }

  private push(m: Matrix4, color: number): void {
    const g = BoxBatch.unit;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const base = this.pos.length / 3;
    this.nmat.copy(m).invert().transpose();
    this.c.setHex(color);
    for (let i = 0; i < p.count; i++) {
      this.v.fromBufferAttribute(p, i).applyMatrix4(m);
      this.pos.push(this.v.x, this.v.y, this.v.z);
      this.v.fromBufferAttribute(n, i).transformDirection(this.nmat);
      this.nor.push(this.v.x, this.v.y, this.v.z);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    const index = g.getIndex()!;
    for (let i = 0; i < index.count; i++) this.idx.push(base + index.getX(i));
  }

  get boxes(): number {
    return this.pos.length / 3 / 24;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Upright frames with diagonal bracing, step beams and wire decks for every rack row. */
export function addRackSteel(batch: BoxBatch, rows: readonly RackRow[]): void {
  const R = WAREHOUSE_PROPS.racks;
  const C = R.colors;
  const up = 0.08;
  for (const row of rows) {
    for (const sx of rackSides(row)) {
      const x0 = sx - R.depth / 2 + up / 2;
      const x1 = sx + R.depth / 2 - up / 2;
      for (let f = 0; f <= R.bays; f++) {
        const z = row.minZ + f * R.bayLength;
        batch.add(x0, R.uprightHeight / 2, z, up, R.uprightHeight, 0.07, C.upright);
        batch.add(x1, R.uprightHeight / 2, z, up, R.uprightHeight, 0.07, C.upright);
        // horizontal ties and zig-zag diagonals in the frame plane
        const span = x1 - x0;
        for (const yh of [0.15, R.uprightHeight - 0.15]) batch.add(sx, yh, z, span, 0.035, 0.035, C.upright);
        const segs = 5;
        const y0 = 0.15;
        const dy = (R.uprightHeight - 0.3) / segs;
        const len = Math.hypot(span, dy);
        const ang = Math.atan2(span, dy);
        for (let s = 0; s < segs; s++) batch.add(sx, y0 + (s + 0.5) * dy, z, 0.03, len, 0.03, C.upright, s % 2 ? ang : -ang);
      }
      for (let bay = 0; bay < R.bays; bay++) {
        const zc = row.minZ + (bay + 0.5) * R.bayLength;
        const len = R.bayLength - 0.07;
        for (const y of R.beamLevels) {
          const yc = y - R.beamHeight / 2;
          batch.add(sx - R.depth / 2 + 0.03, yc, zc, 0.05, R.beamHeight, len, C.beam);
          batch.add(sx + R.depth / 2 - 0.03, yc, zc, 0.05, R.beamHeight, len, C.beam);
          batch.add(sx, y - 0.015, zc, R.depth - 0.1, 0.02, len - 0.04, C.deck);
        }
      }
    }
  }
}

/** Workbench: steel legs and shelf, wooden top, pegboard at the back (local front faces -Z). */
export function addWorkbench(batch: BoxBatch, p: PlacedProp): void {
  const { w, d, h } = WAREHOUSE_PROPS.workbench;
  const steel = 0x3a3f44;
  const wood = 0x8a6a45;
  const board = 0x9c8f76;
  const local = new Matrix4();
  const world = propMatrix(p);
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number): void => {
    local.compose(pos.set(x, y, z), q.identity(), new Vector3(sx, sy, sz));
    batch.addMatrix(new Matrix4().multiplyMatrices(world, local), c);
  };
  box(0, h - 0.03, 0, w, 0.06, d - 0.05, wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (d / 2 - 0.08), 0.05, h - 0.06, 0.05, steel);
  box(0, 0.2, 0, w - 0.1, 0.03, d - 0.15, steel);
  box(0, h + 0.5, d / 2 - 0.03, w, 1.0, 0.03, board);
}

export interface WarehousePropMeshes {
  /** Instanced GLB / fallback props. */
  props: InstancedMesh[];
  /** Racks + workbench (one merged mesh). */
  steel: Mesh;
  /** Shrink-wrapped loads (instanced). */
  wraps: InstancedMesh | null;
}

/** Racks + workbench + wraps: independent of the GLB, so they show from the first frame. */
export function buildWarehouseStatic(layout: WarehousePropLayout): { steel: Mesh; wraps: InstancedMesh | null } {
  const batch = new BoxBatch();
  addRackSteel(batch, layout.racks);
  for (const p of layout.props) if (p.kind === 'workbench') addWorkbench(batch, p);
  const steel = new Mesh(batch.build(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }));
  steel.name = 'warehouse-racks';
  steel.castShadow = true;
  steel.receiveShadow = true;
  let wraps: InstancedMesh | null = null;
  if (layout.wraps.length > 0) {
    const g = new BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const mat = new MeshStandardMaterial({ color: 0xe9eef1, roughness: 0.25, metalness: 0, transparent: true, opacity: 0.82 });
    wraps = new InstancedMesh(g, mat, layout.wraps.length);
    layout.wraps.forEach((w, i) => wraps!.setMatrixAt(i, m4.compose(pos.set(w.x, w.y, w.z), q.identity(), new Vector3(w.w, w.h, w.d))));
    wraps.instanceMatrix.needsUpdate = true;
    wraps.computeBoundingSphere();
    wraps.receiveShadow = true;
    wraps.name = 'warehouse-wraps';
  }
  return { steel, wraps };
}

/** One InstancedMesh per kind and primitive; kinds missing from `models` use procedural stand-ins. */
export function buildWarehousePropMeshes(models: Map<WarehouseGlbKind, PropPart[]>, layout: WarehousePropLayout): InstancedMesh[] {
  const byKind = new Map<WarehouseGlbKind, PlacedProp[]>();
  for (const p of layout.props) {
    if (p.kind === 'workbench') continue;
    const list = byKind.get(p.kind) ?? [];
    list.push(p);
    byKind.set(p.kind, list);
  }
  const glow = new MeshBasicMaterial({ color: 0xffffff });
  glow.color.setRGB(3, 2.6, 2.0); // lamp glass: glow only, no real light
  glow.name = 'warehouse-lamp-glow';
  const meshes: InstancedMesh[] = [];
  for (const [kind, items] of byKind) {
    const parts = models.get(kind) ?? fallbackParts(kind);
    parts.forEach((part, pi) => {
      const mesh = new InstancedMesh(part.geometry, part.glow ? glow : part.material, items.length);
      items.forEach((p, i) => mesh.setMatrixAt(i, propMatrix(p, m4)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      // indoors under a roof: props receive shadows but do not cast them (saves a shadow pass per kind)
      mesh.castShadow = false;
      mesh.receiveShadow = !part.glow;
      mesh.name = `warehouse-${kind}${pi ? `-${pi}` : ''}`;
      meshes.push(mesh);
    });
  }
  return meshes;
}

/**
 * Adds the interior props to the scene: colliders and racks right away (the nav bake sees them), GLB props
 * when the file has loaded (or boxes if it fails). Everything is tracked by `scope`.
 */
export function mountWarehouseProps(ctx: GameContext, scope: ResourceTracker, isLive: () => boolean): { summary: () => Record<string, number> } {
  const layout = layoutWarehouseProps();
  const add = <T extends Object3D>(o: T): T => {
    ctx.scene.add(scope.track(o));
    return o;
  };
  const { steel, wraps } = buildWarehouseStatic(layout);
  add(steel);
  if (wraps) add(wraps);
  let colliders: Collider[] = layout.colliders.map((c) => ctx.physics.addStaticBox({ center: c.center, halfExtents: c.half, meta: { kind: 'static' } }));
  let shown = 0;
  let drawCalls = 1 + (wraps ? 1 : 0);
  void loadWarehousePropModels().then((models) => {
    if (!isLive()) return;
    for (const mesh of buildWarehousePropMeshes(models, layout)) {
      add(mesh);
      shown += mesh.count;
      drawCalls++;
    }
    ctx.renderer.markShadowsDirty();
  });
  scope.onDispose(() => {
    for (const c of colliders) {
      try {
        ctx.physics.removeCollider(c);
      } catch {
        // physics world may already be gone during Game.dispose
      }
    }
    colliders = [];
  });
  return { summary: () => ({ props: layout.props.length, shown, wraps: layout.wraps.length, colliders: colliders.length, drawCalls }) };
}
