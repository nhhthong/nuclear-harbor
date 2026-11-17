import { readFileSync, statSync } from 'node:fs';
import { Box3, Texture, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { buildDressingMeshes, dressingMatrices, dressingModelsFrom, loadDressingModels } from './dressing';
import { DRESSING, DRESSING_FILE, DRESSING_SIZE, type DressingKind } from './layout';

const FILES = { industrial: new URL('../../public/assets/props/industrial.glb', import.meta.url), terminal: new URL('../../public/assets/props/terminal.glb', import.meta.url) };

function parseShipped(file: URL): Promise<{ scene: Object3D }> {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve(g), reject));
}

describe('shipped clutter GLB', () => {
  it('each file stays under 2.5 MB', () => {
    for (const f of Object.values(FILES)) expect(statSync(f).size).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('has every kind at the size the colliders assume', async () => {
    const models = new Map([...dressingModelsFrom(await parseShipped(FILES.industrial)), ...dressingModelsFrom(await parseShipped(FILES.terminal))]);
    const size = new Vector3();
    for (const kind of Object.keys(DRESSING_SIZE) as DressingKind[]) {
      const m = models.get(kind);
      expect(m, `${kind} in ${DRESSING_FILE[kind]}.glb`).toBeTruthy();
      new Box3().setFromBufferAttribute(m!.geometry.getAttribute('position') as never).getSize(size);
      const s = DRESSING_SIZE[kind];
      expect(Math.abs(size.x - s.hx * 2), `${kind} width`).toBeLessThan(0.06);
      expect(Math.abs(size.z - s.hz * 2), `${kind} depth`).toBeLessThan(0.06);
      expect(Math.abs(size.y - s.h), `${kind} height`).toBeLessThan(0.06);
    }
  });
});

describe('clutter meshes', () => {
  it('stack tyres and draw one instanced mesh per kind', () => {
    const tyres = DRESSING.filter((d) => d.kind === 'tyre' || d.kind === 'pallet');
    const expected = DRESSING.reduce((n, d) => n + dressingMatrices(d).length, 0);
    expect(expected).toBeGreaterThan(DRESSING.length);
    expect(tyres.reduce((n, d) => n + (d.stack ?? 1), 0)).toBe(tyres.reduce((n, d) => n + dressingMatrices(d).length, 0));
    const meshes = buildDressingMeshes(new Map());
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(expected);
  });

  it('fall back to boxes when the model cannot load', async () => {
    expect((await loadDressingModels(() => Promise.reject(new Error('offline')))).size).toBe(0);
  });
});
