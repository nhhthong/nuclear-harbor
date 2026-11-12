import { Group, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceTracker } from '@/assets/ResourceTracker';
import { createViewModel, wantsGlb } from './createViewModel';
import { GlbViewModel } from './GlbViewModel';
import { ProceduralViewModel } from './ProceduralViewModel';
import type { ViewModel } from './ViewModel';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const tracker = () => new ResourceTracker('test').scope('weapon');

describe('createViewModel', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is procedural by default and never touches the loader', () => {
    const loader = vi.fn();
    const vm = createViewModel(tracker(), new URLSearchParams(''), { loader });
    expect(vm).toBeInstanceOf(ProceduralViewModel);
    expect(loader).not.toHaveBeenCalled();
    expect(wantsGlb(new URLSearchParams('viewmodel=glb'))).toBe(true);
    expect(wantsGlb(new URLSearchParams('viewmodel=other'))).toBe(false);
  });

  it('keeps the procedural model and reports once when the load rejects', async () => {
    const onFallback = vi.fn();
    const vm = createViewModel(tracker(), new URLSearchParams('viewmodel=glb'), {
      loader: () => Promise.reject(new Error('404')),
      onFallback,
    });
    await flush();
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(vm.object3d.children.length).toBe(1);
    expect(() => {
      vm.update(1 / 60, { speed: 0, sprinting: false, time: 0 });
      vm.playFire();
      vm.playReload(1.8);
    }).not.toThrow();
    expect(Number.isFinite(vm.muzzleLocalPosition.z)).toBe(true);
  });

  it('keeps the procedural model when the loader throws synchronously or returns garbage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createViewModel(tracker(), new URLSearchParams('viewmodel=glb'), {
      loader: () => {
        throw new Error('boom');
      },
    });
    const vm = createViewModel(tracker(), new URLSearchParams('viewmodel=glb'), {
      loader: () => Promise.resolve({ scene: undefined, animations: [] } as never),
    });
    await flush();
    expect(warn).toHaveBeenCalledTimes(2); // one per failed instance, never repeated
    expect(vm.object3d.children.length).toBe(1);
  });

  it('discards a model that finishes loading after dispose', async () => {
    let resolve!: (m: { scene: Group; animations: never[] }) => void;
    const vm = createViewModel(tracker(), new URLSearchParams('viewmodel=glb'), {
      loader: () => new Promise((r) => (resolve = r)),
    });
    vm.dispose();
    resolve({ scene: new Group(), animations: [] });
    await flush();
    expect(vm.object3d.parent).toBeNull();
    expect(vm.object3d.children.length).toBe(0);
  });

  it('swaps to the GLB model when the load succeeds and exposes muzzle points in wrapper space', async () => {
    const scene = new Group();
    const muzzle = new Group();
    muzzle.name = 'muzzle';
    muzzle.position.set(0, 0.1, -0.5);
    scene.add(muzzle);
    const vm = createViewModel(tracker(), new URLSearchParams('viewmodel=glb'), {
      loader: () => Promise.resolve({ scene, animations: [] }),
    });
    await flush();
    const glb = (vm as unknown as { active: ViewModel }).active;
    expect(glb).toBeInstanceOf(GlbViewModel);
    expect((glb as GlbViewModel).animated).toBe(false);
    vm.update(1 / 60, { speed: 0, sprinting: false, time: 0 });
    expect(vm.muzzleLocalPosition.distanceTo(new Vector3(0, 0.1, -0.5).add(glb.object3d.position))).toBeLessThan(1e-5);
  });
});
