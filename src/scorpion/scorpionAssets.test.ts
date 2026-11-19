import { readFileSync, statSync } from 'node:fs';
import { BoxGeometry, Box3, Group, Mesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { createPose, createScorpionAssets } from './ScorpionModel';
import { createAuthoredRig } from './ScorpionSkin';
import { LEG_NODES, MATERIAL_GLOW, NODE_BODY, NODE_HEAD, NODE_NOZZLE, TAIL_NODES, loadScorpionModel, scorpionFrom } from './scorpionAssets';
import { SCORPION } from './tunables';

const FILE = new URL('../../public/assets/enemies/scorpion.glb', import.meta.url);

function parseShipped(): Promise<{ scene: Object3D }> {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', (g) => resolve(g), reject));
}

function fake(skip?: string, glow = true): { scene: Object3D } {
  const scene = new Group();
  const add = (name: string, x: number, y: number, z: number, mesh = true): void => {
    if (name === skip) return;
    const mat = new MeshStandardMaterial();
    mat.name = name === NODE_BODY && glow ? MATERIAL_GLOW : 'sc_armor';
    const o: Object3D = mesh ? new Mesh(new BoxGeometry(1, 1, 1), mat) : new Object3D();
    o.name = name;
    o.position.set(x, y, z);
    scene.add(o);
  };
  add(NODE_BODY, 0, 1, 0);
  LEG_NODES.forEach((n, i) => add(n, i < 2 ? -1 : 1, 1, i % 2 ? 0.6 : -0.6));
  TAIL_NODES.forEach((n, i) => add(n, 0, 2 + i, 1));
  add(NODE_HEAD, 0, 1, -2, false);
  add(NODE_NOZZLE, 0, 2, -1, false);
  return { scene };
}

describe('scorpion assets (loader)', () => {
  it('reads hit volumes and joints from the nodes', () => {
    const a = scorpionFrom(fake());
    // body + head + 4 legs + 4 tail segments
    expect(a.colliders).toHaveLength(10);
    expect(a.colliders.filter((c) => c.zone === 'critical')).toHaveLength(2);
    expect(a.head.z).toBe(-2);
    expect(a.nozzle.y).toBe(2);
  });

  it('throws when a node or the glow material is missing', () => {
    expect(() => scorpionFrom(fake(NODE_NOZZLE))).toThrow(/sc_nozzle/);
    expect(() => scorpionFrom(fake('sc_tail2'))).toThrow(/sc_tail2/);
    expect(() => scorpionFrom(fake(undefined, false))).toThrow(/sc_glow/);
  });

  it('a failed load resolves to null instead of rejecting (procedural fallback)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await loadScorpionModel(() => Promise.reject(new Error('404')))).toBeNull();
    expect(await loadScorpionModel(() => Promise.resolve({ scene: new Group() }))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('the procedural fallback keeps its eight hit volumes and two critical zones', () => {
    const p = createScorpionAssets(null);
    expect(p.kind).toBe('procedural');
    expect(p.colliders).toHaveLength(8);
    expect(p.colliders.filter((c) => c.zone === 'critical')).toHaveLength(2);
    p.dispose();
  });
});

describe('shipped scorpion GLB', () => {
  it('stays small and light', () => {
    expect(statSync(FILE).size).toBeLessThan(1.2 * 1024 * 1024);
  });

  it('has every joint, about 16k triangles and the two materials', async () => {
    const gltf = await parseShipped();
    const a = scorpionFrom(gltf);
    let tris = 0;
    const mats = new Set<string>();
    a.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      tris += (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3;
      mats.add((m.material as MeshStandardMaterial).name);
    });
    expect(tris).toBeGreaterThan(12000);
    expect(tris).toBeLessThan(16500);
    expect([...mats].sort()).toEqual(['sc_armor', 'sc_glow']);
  });

  it('is gunmetal with a green emissive accent material', async () => {
    const a = scorpionFrom(await parseShipped());
    let armor: MeshStandardMaterial | null = null;
    let glow: MeshStandardMaterial | null = null;
    a.scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = m.material as MeshStandardMaterial;
      if (mat.name === 'sc_armor') armor = mat;
      if (mat.name === 'sc_glow') glow = mat;
    });
    const am = armor as unknown as MeshStandardMaterial;
    const gm = glow as unknown as MeshStandardMaterial;
    expect(am.metalness).toBeCloseTo(0.85, 2);
    expect(am.roughness).toBeCloseTo(0.4, 2);
    expect(am.color.r).toBeLessThan(0.2);
    expect(am.color.b).toBeGreaterThan(am.color.r);
    expect(gm.emissive.g).toBeGreaterThan(0.9);
    expect(gm.emissive.r).toBeLessThan(0.2);
    expect(gm.emissive.b).toBeLessThan(0.3);
  });

  it('stands on the ground, faces -Z and has the size of the old scorpion', async () => {
    const a = scorpionFrom(await parseShipped());
    a.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(a.scene);
    expect(box.min.y).toBeGreaterThan(-0.05);
    expect(box.min.y).toBeLessThan(0.05);
    const size = box.getSize(new Vector3());
    expect(size.y).toBeGreaterThan(3.6);
    expect(size.y).toBeLessThan(SCORPION.heightM + 0.2);
    expect(size.z).toBeGreaterThan(5.5);
    expect(size.z).toBeLessThan(7.5);
    // the eye drum is the front-most thing, the tail base the rear
    expect(a.head.z).toBeLessThan(-1.5);
    expect(a.head.y).toBeGreaterThan(0.5);
    expect(a.head.y).toBeLessThan(1.8);
    expect(Math.abs(a.head.x)).toBeLessThan(0.05);
    // the stinger mouth is above the head, in front of the body centre, pointing down towards the front
    expect(a.nozzle.y).toBeGreaterThan(2);
    expect(a.nozzle.z).toBeLessThan(0);
    // centred between the legs
    const centre = box.getCenter(new Vector3());
    expect(Math.abs(centre.x)).toBeLessThan(0.05);
  });

  it('puts the hit volumes where the head and the stinger are, and the critical ones only there', async () => {
    const a = scorpionFrom(await parseShipped());
    const crit = a.colliders.filter((c) => c.zone === 'critical');
    expect(crit).toHaveLength(2);
    const [headBox, stingerBox] = crit as [(typeof crit)[0], (typeof crit)[0]];
    expect(headBox.center.distanceTo(a.head)).toBeLessThan(0.01);
    expect(stingerBox.center.distanceTo(a.nozzle)).toBeLessThan(1.0);
    expect(stingerBox.center.y).toBeGreaterThan(2);
    // everything is inside the model's overall bounds (give or take the shrink) and above the ground
    for (const c of a.colliders) {
      expect(c.center.y - c.half.y).toBeGreaterThan(-0.1);
      expect(c.center.y + c.half.y).toBeLessThan(SCORPION.heightM);
      expect(Math.abs(c.center.x) + c.half.x).toBeLessThan(3.2);
      expect(Math.abs(c.center.z) + c.half.z).toBeLessThan(4.3);
    }
  });

  it('legs hang off the body: hips at the body, four of them, two per side', async () => {
    const a = scorpionFrom(await parseShipped());
    const hips = LEG_NODES.map((n) => (a.scene.getObjectByName(n) as Object3D).getWorldPosition(new Vector3()));
    expect(hips.filter((h) => h.x < 0)).toHaveLength(2);
    expect(hips.filter((h) => h.z < 0)).toHaveLength(2);
    for (const h of hips) {
      expect(Math.abs(h.x)).toBeLessThan(1);
      expect(h.y).toBeGreaterThan(0.6);
    }
  });

  it('tail is a chain: each segment is a child of the previous one, the nozzle hangs off the last', async () => {
    const a = scorpionFrom(await parseShipped());
    for (let i = 1; i < TAIL_NODES.length; i++) {
      const child = a.scene.getObjectByName(TAIL_NODES[i] as string) as Object3D;
      expect(child.parent?.name).toBe(TAIL_NODES[i - 1]);
    }
    expect((a.scene.getObjectByName(NODE_NOZZLE) as Object3D).parent?.name).toBe(TAIL_NODES[3]);
  });
});

describe('authored rig', () => {
  it('builds from the shipped model, moves the joints, keeps the template untouched and disposes cleanly', async () => {
    const authored = scorpionFrom(await parseShipped());
    const assets = createScorpionAssets(authored);
    expect(assets.kind).toBe('authored');
    const rig = assets.makeRig();
    expect(rig.meshCount).toBeGreaterThan(10);
    expect(rig.meshCount).toBeLessThan(30);
    const pose = createPose();
    pose.tailLash = 0;
    rig.apply(pose);
    rig.group.updateMatrixWorld(true);
    const rest = rig.stingerWorld(new Vector3()).clone();
    expect(rest.distanceTo(authored.nozzle)).toBeLessThan(0.05);
    // a tail aim lifts the stinger, a strike drops it, the template's own nodes stay at rest
    pose.tailAim = 1;
    rig.apply(pose);
    rig.group.updateMatrixWorld(true);
    const aimed = rig.stingerWorld(new Vector3()).clone();
    expect(aimed.distanceTo(rest)).toBeGreaterThan(0.5);
    pose.tailAim = 0;
    pose.tailStrike = 1;
    rig.apply(pose);
    rig.group.updateMatrixWorld(true);
    const struck = rig.stingerWorld(new Vector3());
    expect(struck.y).toBeLessThan(rest.y - 0.5);
    expect((authored.scene.getObjectByName(TAIL_NODES[0]) as Object3D).rotation.x).toBe(0);
    // glow follows the pose and is a per-rig material
    pose.glow = 4;
    pose.tailStrike = 0;
    rig.apply(pose);
    expect(rig.glowMaterial.emissiveIntensity).toBeGreaterThan(1.5);
    expect(rig.glowMaterial.name).toBe(MATERIAL_GLOW);
    let templateGlow: MeshStandardMaterial | null = null;
    authored.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && (m.material as MeshStandardMaterial).name === MATERIAL_GLOW) templateGlow = m.material as MeshStandardMaterial;
    });
    expect(templateGlow).not.toBe(rig.glowMaterial);
    const rig2 = createAuthoredRig(authored);
    rig.dispose();
    rig2.dispose();
    assets.dispose();
  });

  it('feet stay on the ground while walking and crouching', async () => {
    const authored = scorpionFrom(await parseShipped());
    const rig = createScorpionAssets(authored).makeRig();
    const pose = createPose();
    pose.walk = 1;
    for (let p = 0; p < Math.PI * 2; p += 0.4) {
      pose.walkPhase = p;
      rig.apply(pose);
      rig.group.updateMatrixWorld(true);
      const box = new Box3().setFromObject(rig.group);
      expect(box.min.y).toBeGreaterThan(-0.25);
    }
    pose.walk = 0;
    pose.crouch = 0.8;
    rig.apply(pose);
    rig.group.updateMatrixWorld(true);
    const lowest = new Box3().setFromObject(rig.group).min.y;
    expect(lowest).toBeGreaterThan(-0.3);
    expect(lowest).toBeLessThan(0.35);
    rig.dispose();
  });
});
