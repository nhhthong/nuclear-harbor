import { readFileSync, statSync } from 'node:fs';
import { Mesh, SkinnedMesh, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { ResourceTracker } from '@/assets/ResourceTracker';
import { GlbViewModel, type LoadedModel } from './GlbViewModel';
import { mapClips } from './glbClips';

const FILE = new URL('../../../public/assets/weapons/g36c/g36c.glb', import.meta.url);

/** Parse the shipped GLB in Node; textures are stubbed because Node has no image decoding. */
function parseShipped(): Promise<LoadedModel> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve(g), reject));
}

describe('shipped G36C GLB', () => {
  it('stays modest in size', () => {
    expect(statSync(FILE).size).toBeLessThan(4 * 1024 * 1024);
  });

  it('parses with a skeleton, one skinned mesh and every state clip', async () => {
    const gltf = await parseShipped();
    const meshes: Mesh[] = [];
    gltf.scene.traverse((n) => {
      if ((n as Mesh).isMesh) meshes.push(n as Mesh);
    });
    expect(meshes.length).toBe(1); // one draw call (limit: 6)
    expect(meshes[0]).toBeInstanceOf(SkinnedMesh);
    expect((meshes[0] as SkinnedMesh).skeleton.bones.length).toBe(46);
    const map = mapClips(gltf.animations.map((a) => a.name));
    expect(map.idle).toBe('idle');
    expect(map.draw).toBe('draw');
    expect(map.reload).toBe('reload');
    expect(map.fire).toEqual(['shoot1', 'shoot2', 'shoot3']);
    expect(gltf.scene.getObjectByName('muzzle')).toBeTruthy();
  });

  it('builds a view model: metric size, muzzle ahead (-Z), clips follow weapon calls', async () => {
    const gltf = await parseShipped();
    const vm = new GlbViewModel(gltf, new ResourceTracker('t').scope('weapon'));
    expect(vm.animated).toBe(true);
    const state = { speed: 0, sprinting: false, time: 0 };
    vm.update(1 / 60, state);
    expect(vm.lastClip).toBe('draw');
    // muzzle: in front of the eye (-Z), within a metre, finite
    expect(vm.muzzleLocalPosition.z).toBeLessThan(-0.2);
    expect(vm.muzzleLocalPosition.z).toBeGreaterThan(-1.2);
    expect(Math.abs(vm.muzzleLocalPosition.y)).toBeLessThan(0.5);
    expect(vm.ejectionLocalPosition.z).toBeLessThan(0.2);
    vm.playFire();
    expect(vm.lastClip).toBe('shoot1');
    vm.playFire();
    expect(vm.lastClip).toBe('shoot2');
    vm.playReload(1.8);
    expect(vm.lastClip).toBe('reload');
    for (let i = 0; i < 600; i++) vm.update(1 / 60, state); // reload (3.3 s clip at ~1.8 s) ends
    expect(vm.lastClip).toBe('idle');
    vm.dispose();
  });
});
