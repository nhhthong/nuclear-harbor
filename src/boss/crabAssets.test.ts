import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ARM_NAMES, LEG_NAMES, crabFrom, droneFrom, fallbackBones, loadBossAssets } from './crabAssets';

function fakeCrab(skip?: string): { scene: Object3D } {
  const scene = new Group();
  const add = (name: string, x: number, y: number, z: number, mesh = true): void => {
    if (name === skip) return;
    const o: Object3D = mesh ? new Mesh(new BoxGeometry(2, 0.5, 1), new MeshBasicMaterial()) : new Object3D();
    o.name = name;
    o.position.set(x, y, z);
    scene.add(o);
  };
  add('crab_body', 0, 0, 0);
  LEG_NAMES.forEach((n, i) => add(n, i < 3 ? -1 : 1, 4, (i % 3) - 1));
  ARM_NAMES.forEach((n, i) => add(n, i === 0 ? -1.7 : 1.7, 4.8, -1.2));
  add('muzzle_L', -2.6, 3.7, -9.4, false);
  add('muzzle_R', 2.6, 3.7, -9.4, false);
  add('mortar', 0, 8, 3, false);
  add('bay', 0, 7.5, 3, false);
  return { scene };
}

describe('crab assets', () => {
  it('reads pivots, bones and arms from the GLB nodes', () => {
    const c = crabFrom(fakeCrab());
    expect(c.bones.size).toBe(6);
    expect(c.arms.size).toBe(2);
    expect(c.mortar.y).toBe(8);
    const left = c.bones.get('crab_legL0');
    expect(left?.hip.x).toBe(-1);
    expect((left?.foot.x ?? 0) < (left?.hip.x ?? 0)).toBe(true);
    const right = c.bones.get('crab_legR2');
    expect((right?.foot.x ?? 0) > (right?.hip.x ?? 0)).toBe(true);
  });

  it('throws when a part is missing', () => {
    expect(() => crabFrom(fakeCrab('crab_legR1'))).toThrow(/crab_legR1/);
    expect(() => crabFrom(fakeCrab('mortar'))).toThrow(/mortar/);
  });

  it('takes the first mesh of the drone GLB in world space', () => {
    const scene = new Group();
    const m = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    m.position.set(0, 2, 0);
    scene.add(m);
    const d = droneFrom({ scene });
    d.geometry.computeBoundingBox();
    expect(d.geometry.boundingBox?.min.y).toBeCloseTo(1.5, 6);
    expect(() => droneFrom({ scene: new Group() })).toThrow();
  });

  it('resolves to null parts (procedural fallback) when a load fails, never rejects', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loader = (url: string): Promise<{ scene: Object3D }> => (url.includes('crab') ? Promise.reject(new Error('offline')) : Promise.resolve({ scene: new Group() }));
    return loadBossAssets(loader).then((a) => {
      expect(a.crab).toBeNull();
      expect(a.drone).toBeNull(); // empty scene has no mesh
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('has fallback bones for six legs', () => {
    const b = fallbackBones();
    expect([...b.keys()]).toEqual([...LEG_NAMES]);
  });
});
