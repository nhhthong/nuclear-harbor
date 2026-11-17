import { readFileSync, statSync } from 'node:fs';
import { Box3, BufferGeometry, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { VEHICLE_SIZE, VEHICLES, type VehicleKind } from './layout';
import { buildVehicleMeshes, geometriesFrom, loadVehicleGeometries } from './vehicles';

const FILE = new URL('../../public/assets/props/vehicles.glb', import.meta.url);

function parseShipped(): Promise<{ scene: Mesh['parent'] & object }> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', (g) => resolve(g as never), reject));
}

describe('shipped vehicle GLB', () => {
  it('stays small', () => {
    expect(statSync(FILE).size).toBeLessThan(512 * 1024);
  });

  it('has every kind at the size the colliders assume, with baked colours', async () => {
    const geos = geometriesFrom((await parseShipped()) as never);
    const size = new Vector3();
    for (const kind of Object.keys(VEHICLE_SIZE) as VehicleKind[]) {
      const g = geos.get(kind) as BufferGeometry;
      expect(g, kind).toBeTruthy();
      expect(g.getAttribute('color'), kind).toBeTruthy();
      new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getSize(size);
      const s = VEHICLE_SIZE[kind];
      expect(size.x, `${kind} width`).toBeCloseTo(s.hx * 2, 0);
      expect(size.z, `${kind} length`).toBeCloseTo(s.hz * 2, 0);
      expect(size.y, `${kind} height`).toBeCloseTo(s.h, 0);
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
  });
});
