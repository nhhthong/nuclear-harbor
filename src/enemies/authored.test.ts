import { readFileSync, statSync } from 'node:fs';
import { Box3, Mesh, Texture, Vector3, type BufferGeometry, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTHORED,
  authoredModel,
  buildAuthored,
  disposeAuthored,
  instantiate,
  loadAllAuthored,
  loadAuthored,
  setAuthoredModel,
  type AuthoredKind,
  type AuthoredSource,
} from './authored';
import { BIPED } from './biped/tunables';

const FILES: Record<AuthoredKind, URL> = {
  biped: new URL('../../public/assets/enemies/biped.glb', import.meta.url),
  striker: new URL('../../public/assets/enemies/striker.glb', import.meta.url),
  spot: new URL('../../public/assets/enemies/spot.glb', import.meta.url),
};

function parse(kind: AuthoredKind): Promise<AuthoredSource> {
  const buf = readFileSync(FILES[kind]);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'test_stub_textures', loadTexture: () => Promise.resolve(new Texture()) }));
  return new Promise((resolve, reject) => loader.parse(ab, '', (g) => resolve({ scene: g.scene, animations: g.animations }), reject));
}

function triangles(root: Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof Mesh) {
      const g = o.geometry as BufferGeometry;
      n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return n;
}

/** World bounds of the skinned meshes with `clip` sampled at `t` seconds (the clips of a merged model play together). */
function poseBounds(src: AuthoredSource, clips: string[], t: number): Box3 {
  const model = buildAuthored(src, AUTHORED.spot.merge && clips.includes('walk') && !src.animations.some((a) => a.name === 'walk') ? AUTHORED.spot.merge : undefined);
  const inst = instantiate(model);
  for (const c of clips) inst.player.play(c, { fade: 0 });
  inst.player.mixer.setTime(t);
  inst.root.updateMatrixWorld(true);
  const box = new Box3();
  for (const m of inst.meshes) {
    m.skeleton.update();
    box.union(new Box3().setFromObject(m, true));
  }
  inst.dispose();
  return box;
}

afterEach(() => {
  for (const k of Object.keys(FILES) as AuthoredKind[]) setAuthoredModel(k, null);
});

describe('shipped robot GLBs', () => {
  it('stay small: at most 1.2 MB each and 3.5 MB together', () => {
    let total = 0;
    for (const f of Object.values(FILES)) {
      const size = statSync(f).size;
      expect(size).toBeLessThanOrEqual(1.2 * 1024 * 1024);
      total += size;
    }
    expect(total).toBeLessThanOrEqual(3.5 * 1024 * 1024);
  });

  it('have at most 8k triangles each, skinned, with the clips the robots ask for', async () => {
    const want: Record<AuthoredKind, string[]> = {
      biped: ['idle', 'run', 'crouch', 'leap', 'claw'],
      striker: ['idle', 'walk', 'run'],
      spot: ['walk'],
    };
    for (const kind of Object.keys(FILES) as AuthoredKind[]) {
      const src = await parse(kind);
      expect(triangles(src.scene), kind).toBeLessThanOrEqual(8000);
      expect(triangles(src.scene), kind).toBeGreaterThan(4000);
      const model = buildAuthored(src, AUTHORED[kind].merge);
      for (const c of want[kind]) expect(model.clips.has(c), `${kind} clip ${c}`).toBe(true);
      let skinned = 0;
      src.scene.traverse((o) => {
        if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned++;
      });
      expect(skinned, kind).toBeGreaterThan(0);
    }
  });

  it('stand on the ground at real-world scale, without stray bases', async () => {
    const biped = poseBounds(await parse('biped'), ['idle'], 0.4);
    expect(biped.max.y - biped.min.y).toBeGreaterThan(2.0);
    expect(biped.max.y - biped.min.y).toBeLessThan(2.4);
    expect(Math.abs(biped.min.y)).toBeLessThan(0.1);
    // the 117 x 117 unit display base is gone: nothing wider than the arms
    expect(biped.max.x - biped.min.x).toBeLessThan(1.6);

    const striker = poseBounds(await parse('striker'), ['idle'], 1);
    expect(striker.max.y - striker.min.y).toBeGreaterThan(3.3);
    expect(striker.max.y - striker.min.y).toBeLessThan(3.8);
    expect(Math.abs(striker.min.y)).toBeLessThan(0.12);
    expect(striker.max.x - striker.min.x).toBeLessThan(3);

    const spot = poseBounds(await parse('spot'), ['walk'], 1);
    expect(spot.max.y - spot.min.y).toBeGreaterThan(1.0);
    expect(spot.max.y - spot.min.y).toBeLessThan(1.5);
    expect(Math.abs(spot.min.y)).toBeLessThan(0.1);
  });

  it('keep their feet down and their limbs together through the animation (no exploded vertices)', async () => {
    const sources: Array<[AuthoredKind, string[], number]> = [
      ['biped', ['run'], 1.04],
      ['biped', ['crouch'], 0.54],
      ['biped', ['leap'], 0.54],
      ['biped', ['claw'], 0.67],
      ['striker', ['walk'], 1],
      ['striker', ['run'], 1.25],
      ['spot', ['walk'], 6.29],
    ];
    const limits: Record<AuthoredKind, { height: number; width: number; depth: number }> = {
      biped: { height: 2.5, width: 2.2, depth: 2.6 },
      striker: { height: 3.8, width: 3.2, depth: 3.4 },
      spot: { height: 1.6, width: 1.3, depth: 2.9 },
    };
    for (const [kind, clips, dur] of sources) {
      const src = await parse(kind);
      for (const f of [0, 0.25, 0.5, 0.75]) {
        const b = poseBounds(src, clips, f * dur);
        const size = b.getSize(new Vector3());
        const lim = limits[kind];
        expect(size.y, `${kind} ${clips} ${f}`).toBeLessThan(lim.height);
        expect(size.x, `${kind} ${clips} ${f}`).toBeLessThan(lim.width);
        expect(size.z, `${kind} ${clips} ${f}`).toBeLessThan(lim.depth);
        expect(b.min.y, `${kind} ${clips} ${f}`).toBeGreaterThan(-0.2);
      }
    }
  });

  it('face -Z: the biped reaches forward with its claws and leaps forward', async () => {
    const claw = poseBounds(await parse('biped'), ['claw'], 0.25);
    expect(claw.min.z).toBeLessThan(-0.55);
    expect(claw.max.z).toBeLessThan(0.45);
    const leap = poseBounds(await parse('biped'), ['leap'], 0.5);
    expect(leap.min.z).toBeLessThan(-0.6);
  });
});

describe('instances', () => {
  it('clone the skeleton per robot and share geometry and materials', async () => {
    const model = buildAuthored(await parse('biped'));
    const a = instantiate(model);
    const b = instantiate(model);
    expect(a.meshes.length).toBe(b.meshes.length);
    for (let i = 0; i < a.meshes.length; i++) {
      const ma = a.meshes[i]!;
      const mb = b.meshes[i]!;
      expect(ma.geometry).toBe(mb.geometry);
      expect(ma.material).toBe(mb.material);
      expect(ma.skeleton).not.toBe(mb.skeleton);
      expect(ma.skeleton.bones[0]).not.toBe(mb.skeleton.bones[0]);
    }
    // independent animation
    a.player.play('run', { fade: 0 });
    b.player.play('idle', { fade: 0 });
    a.player.update(0.3);
    b.player.update(0.3);
    const head = BIPED.skin.headBone;
    const pa = a.root.getObjectByName(head)!.quaternion;
    const pb = b.root.getObjectByName(head)!.quaternion;
    a.root.updateMatrixWorld(true);
    b.root.updateMatrixWorld(true);
    expect(pa === pb).toBe(false);
    a.dispose();
    b.dispose();
    expect(a.root.parent).toBeNull();
  });
});

describe('loading', () => {
  it('installs the models, merges the Spot leg clips into one walk clip, and falls back to null on failure', async () => {
    const sources = { biped: await parse('biped'), striker: await parse('striker'), spot: await parse('spot') };
    const byUrl = new Map(Object.entries(AUTHORED).map(([k, e]) => [e.url, sources[k as AuthoredKind]]));
    const results = await loadAllAuthored((url) => Promise.resolve(byUrl.get(url)!));
    expect(results.every((r) => r !== null)).toBe(true);
    expect(authoredModel('spot')!.clips.has('walk')).toBe(true);
    expect(authoredModel('spot')!.clips.size).toBe(1);
    // the merged clip carries the tracks of all four leg skeletons
    expect(authoredModel('spot')!.clips.get('walk')!.tracks.length).toBeGreaterThan(40);

    setAuthoredModel('biped', null);
    expect(await loadAuthored('biped', () => Promise.reject(new Error('offline')))).toBeNull();
    expect(authoredModel('biped')).toBeNull();
    expect(await loadAuthored('striker', () => Promise.resolve({ scene: sources.striker.scene, animations: [] }))).toBeNull();
    disposeAuthored();
    expect(authoredModel('spot')).toBeNull();
  });
});
