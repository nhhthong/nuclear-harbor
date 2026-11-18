import { readFileSync, statSync } from 'node:fs';
import { Box3, Texture, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSamuraiSkin, samuraiSkin, setSamuraiSkin, skinFrom } from './skin';
import { SAMURAI } from './tunables';

const FILE = new URL('../../../public/assets/enemies/samurai.glb', import.meta.url);

function parseShipped(): Promise<{ scene: Object3D }> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve(g), reject));
}

afterEach(() => setSamuraiSkin(null));

describe('shipped samurai GLB', () => {
  it('stays small', () => {
    expect(statSync(FILE).size).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('splits into rig-ready parts with the pivots the procedural rig expects', async () => {
    const { model } = skinFrom(await parseShipped());
    // same hip height as the procedural samurai (1.62 m) so gait numbers stay valid
    expect(model.hip.y + SAMURAI.centerHeight).toBeCloseTo(1.62, 1);
    expect(model.hip.x).toBeGreaterThan(0.15);
    expect(model.hip.x).toBeLessThan(0.4);
    expect(model.thighLength).toBeGreaterThan(0.4);
    expect(model.shinLength).toBeGreaterThan(0.7);
    expect(model.thighLength + model.shinLength).toBeCloseTo(1.62, 1);
    // body spans the figure from the hips up to the horned helmet (about 3.1 m)
    const body = new Box3().setFromBufferAttribute(model.body.getAttribute('position') as never);
    const top = body.max.y + SAMURAI.centerHeight;
    expect(top).toBeGreaterThan(2.8);
    expect(top).toBeLessThan(3.5);
  });

  it('points the naginata forward from the wrist, about its grip, at spear length', async () => {
    const { model } = skinFrom(await parseShipped());
    const box = new Box3().setFromBufferAttribute(model.weapon.getAttribute('position') as never);
    const size = box.getSize(new Vector3());
    expect(size.z).toBeGreaterThan(2.5); // length now runs along z (forward is -z)
    expect(size.z).toBeLessThan(2.9);
    expect(size.x).toBeLessThan(0.4);
    // blade end in front (-z), butt behind, grip in between
    expect(box.min.z).toBeLessThan(-1.0);
    expect(box.max.z).toBeGreaterThan(0.5);
    expect(model.grip.x).toBeGreaterThan(0.3); // right hand
  });
});

describe('skin loading', () => {
  it('installs the skin, and falls back to null when the file cannot load', async () => {
    const gltf = await parseShipped();
    expect(await loadSamuraiSkin(() => Promise.resolve(gltf))).not.toBeNull();
    expect(samuraiSkin()).not.toBeNull();
    setSamuraiSkin(null);
    expect(await loadSamuraiSkin(() => Promise.reject(new Error('offline')))).toBeNull();
    expect(samuraiSkin()).toBeNull();
  });
});
