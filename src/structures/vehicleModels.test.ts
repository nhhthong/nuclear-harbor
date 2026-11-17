import { readFileSync, statSync } from 'node:fs';
import { Box3, BufferGeometry, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { buildFireMesh } from './fire';
import { VEHICLE_SIZE, VEHICLES, vehicleFires, vehicleSolid, type VehicleKind } from './layout';
import { buildVehicleMeshes, geometriesFrom, loadVehicleGeometries, vehicleMatrix } from './vehicles';

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

describe('wrecks', () => {
  const wrecks = VEHICLES.filter((v) => v.wreck);
  it('exist, burn, and rest on the ground inside their collider', () => {
    expect(wrecks.length).toBeGreaterThanOrEqual(3);
    const m = new Matrix4();
    for (const v of wrecks) {
      const s = VEHICLE_SIZE[v.kind];
      const box = new Box3(new Vector3(-s.hx, 0, -s.hz), new Vector3(s.hx, s.h, s.hz)).applyMatrix4(vehicleMatrix(v, m));
      const solid = vehicleSolid(v);
      expect(box.min.y, v.kind).toBeCloseTo(0, 5);
      expect(box.max.y).toBeCloseTo(solid.half.y * 2, 5);
      expect(box.min.x).toBeCloseTo(solid.center.x - solid.half.x, 5);
      expect(box.max.z).toBeCloseTo(solid.center.z + solid.half.z, 5);
      if (v.burning) {
        const fires = vehicleFires(v);
        expect(fires.length).toBe(2);
        for (const f of fires) {
          expect(f.seed).toBeGreaterThanOrEqual(0);
          expect(f.seed).toBeLessThan(1);
          expect(f.y).toBeLessThan(box.max.y);
        }
      }
    }
  });

  it('draws every flame in one instanced mesh', () => {
    const spots = VEHICLES.flatMap(vehicleFires);
    expect(buildFireMesh(spots)?.count).toBe(spots.length);
    expect(buildFireMesh([])).toBeNull();
  });
});
