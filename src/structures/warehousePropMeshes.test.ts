import { readFileSync, statSync } from 'node:fs';
import { Box3, Texture, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { buildWarehousePropMeshes, buildWarehouseStatic, loadWarehousePropModels, warehousePropModelsFrom } from './warehousePropMeshes';
import { CREDITS } from '@/ui/credits';
import { WAREHOUSE_GLB_KINDS, WAREHOUSE_PROP_SIZE, layoutWarehouseProps } from './warehouseProps';

const FILE = new URL('../../public/assets/props/warehouse.glb', import.meta.url);

function parseShipped(): Promise<{ scene: Object3D }> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve(g), reject));
}

const layout = layoutWarehouseProps();

describe('shipped warehouse props GLB', () => {
  it('stays at about 2 MB', () => {
    expect(statSync(FILE).size).toBeLessThan(2.1 * 1024 * 1024);
  });

  it('has exactly the kinds of the placement table, at the sizes the layout assumes', async () => {
    const gltf = await parseShipped();
    const nodes = gltf.scene.children.map((c) => c.name).sort();
    expect(nodes).toEqual([...WAREHOUSE_GLB_KINDS].sort());
    const placed = new Set(layout.props.map((p) => p.kind).filter((k) => k !== 'workbench'));
    expect([...placed].sort()).toEqual([...WAREHOUSE_GLB_KINDS].sort());
    const models = warehousePropModelsFrom(gltf);
    const size = new Vector3();
    let tris = 0;
    for (const kind of WAREHOUSE_GLB_KINDS) {
      const parts = models.get(kind);
      expect(parts?.length, kind).toBeGreaterThan(0);
      const box = new Box3();
      for (const p of parts!) {
        box.union(new Box3().setFromBufferAttribute(p.geometry.getAttribute('position') as never));
        tris += (p.geometry.getIndex()?.count ?? 0) / 3;
      }
      box.getSize(size);
      const s = WAREHOUSE_PROP_SIZE[kind];
      expect(Math.abs(size.x - s.w), `${kind} width`).toBeLessThan(0.03);
      expect(Math.abs(size.y - s.h), `${kind} height`).toBeLessThan(0.03);
      expect(Math.abs(size.z - s.d), `${kind} depth`).toBeLessThan(0.03);
      expect(Math.abs(box.min.y), `${kind} origin on the ground`).toBeLessThan(0.01);
    }
    expect(tris).toBeLessThan(25000);
    expect(models.get('lamp')!.some((p) => p.glow)).toBe(true);
  });
});

describe('warehouse prop meshes', () => {
  it('draw one instanced mesh per kind with every placement', async () => {
    const models = warehousePropModelsFrom(await parseShipped());
    const meshes = buildWarehousePropMeshes(models, layout);
    const nonBench = layout.props.filter((p) => p.kind !== 'workbench').length;
    const lampExtra = layout.props.filter((p) => p.kind === 'lamp').length;
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(nonBench + lampExtra);
    // draw-call budget: one call per kind (+ lamp glass), racks and wraps are two more
    expect(meshes.length).toBeLessThanOrEqual(WAREHOUSE_GLB_KINDS.length + 1);
  });

  it('fall back to boxes and cylinders when the model cannot load', async () => {
    const models = await loadWarehousePropModels(() => Promise.reject(new Error('offline')));
    expect(models.size).toBe(0);
    const meshes = buildWarehousePropMeshes(models, layout);
    expect(meshes.length).toBe(WAREHOUSE_GLB_KINDS.length + 1);
    for (const m of meshes) expect(m.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('merge racks and workbench into one mesh inside the warehouse', () => {
    const { steel, wraps } = buildWarehouseStatic(layout);
    expect(Array.isArray(steel.material)).toBe(false);
    expect(steel.geometry.getAttribute('color')).toBeTruthy();
    const b = steel.geometry.boundingBox!;
    expect(b.min.x).toBeGreaterThanOrEqual(8);
    expect(b.max.x).toBeLessThanOrEqual(34);
    expect(b.max.y).toBeLessThanOrEqual(9);
    expect(wraps!.count).toBe(layout.wraps.length);
  });
});

describe('warehouse prop credits', () => {
  it('names every CC-BY author and Poly Haven in the in-game credits', () => {
    const names = CREDITS.map((c) => c.name);
    for (const author of ['Monke (cosmiccobra)', 'DartleDyan', 'YadroGames', 'Glowbox 3D', 'Poly Haven']) expect(names).toContain(author);
  });
});
