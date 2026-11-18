import { readFileSync, statSync } from 'node:fs';
import { Box3, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { VEHICLE_SIZE, VEHICLES, type VehicleKind } from './layout';
import { buildVehicleMeshes, geometriesFrom, loadVehicleGeometries } from './vehicles';

const FILE = new URL('../../public/assets/props/vehicles.glb', import.meta.url);

function parseShipped(): Promise<{ scene: Mesh['parent'] & object }> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve(g as never), reject));
}

describe('shipped vehicle GLB', () => {
  it('stays within the 6 MB vehicle budget', () => {
    expect(statSync(FILE).size).toBeLessThan(6 * 1024 * 1024);
  });

  it('has every kind at the size the colliders assume, with textured PBR materials', async () => {
    const models = geometriesFrom((await parseShipped()) as never);
    const size = new Vector3();
    for (const kind of Object.keys(VEHICLE_SIZE) as VehicleKind[]) {
      const parts = models.get(kind);
      expect(parts?.length, kind).toBeGreaterThan(0);
      const box = new Box3();
      for (const p of parts ?? []) {
        expect(p.geometry.getAttribute('normal'), kind).toBeTruthy();
        box.union(new Box3().setFromBufferAttribute(p.geometry.getAttribute('position') as never));
      }
      expect(parts?.some((p) => (p.material as MeshStandardMaterial).map), `${kind} textured`).toBe(true);
      box.getSize(size);
      const s = VEHICLE_SIZE[kind];
      expect(size.x, `${kind} width`).toBeCloseTo(s.hx * 2, 1);
      expect(size.z, `${kind} length`).toBeCloseTo(s.hz * 2, 1);
      expect(size.y, `${kind} height`).toBeCloseTo(s.h, 1);
      expect(box.min.y, `${kind} on the ground`).toBeCloseTo(0, 2);
    }
  });

  it('keeps every vehicle game-ready (triangle budget)', async () => {
    const models = geometriesFrom((await parseShipped()) as never);
    for (const [kind, parts] of models) {
      const tris = parts.reduce((n, p) => n + (p.geometry.index?.count ?? 0) / 3, 0);
      expect(tris, kind).toBeLessThanOrEqual(kind === 'crane_truck' ? 30000 : 20000);
    }
  });
});

describe('vehicle meshes', () => {
  it('draw one instanced mesh per kind with one instance per parked vehicle', () => {
    const meshes = buildVehicleMeshes(new Map());
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(VEHICLES.length);
    expect(new Set(meshes.map((m) => m.name)).size).toBe(meshes.length);
  });

  it('fall back to boxes when the model cannot load', async () => {
    const geos = await loadVehicleGeometries(() => Promise.reject(new Error('offline')));
    expect(geos.size).toBe(0);
    const meshes = buildVehicleMeshes(geos);
    expect(meshes.length).toBe(new Set(VEHICLES.map((v) => v.kind)).size);
  });
});
