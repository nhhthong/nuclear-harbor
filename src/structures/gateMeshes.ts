import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  Vector3,
  type Material,
} from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import type { GameContext } from '@/core/GameContext';
import { Groups } from '@/physics/groups';
import { buildFence } from './models';
import { GateSystem, fenceBoxes, fenceRuns, leafBox, leafGeometry, type GateState, type Leaf } from './gates';
import { GATES } from './tunables';

type Scope = ReturnType<GameContext['resources']['scope']>;

function createChainLinkTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    g.clearRect(0, 0, size, size);
    g.strokeStyle = 'rgba(190,196,200,1)';
    g.lineWidth = 5;
    // two diagonal wire families = diamond mesh, 2 diamonds per tile
    for (let i = -2; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64 + size, size);
      g.stroke();
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64 - size, size);
      g.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 8;
  return tex;
}

interface LeafRuntime {
  readonly gate: GateState;
  readonly leaf: Leaf;
  readonly pivot: Object3D;
  readonly collider: Collider;
}

/**
 * Builds the fences and gates (spec 30): fence meshes and world colliders, one pivot per leaf with its
 * frame, chain-link panel and hazard band, and one GATE-group collider per leaf. Returns the per-step driver.
 */
export function mountGates(ctx: GameContext, scope: Scope, galvanised: Material): { update(dt: number): void; summary(): unknown } {
  const add = <T extends Object3D>(o: T): T => {
    ctx.scene.add(scope.track(o));
    return o;
  };
  const chain = createChainLinkTexture();
  const meshMat = new MeshStandardMaterial({ map: chain, alphaTest: 0.45, side: DoubleSide, roughness: 0.45, metalness: 0.9, color: 0xaab0b4 });
  if (!chain) meshMat.visible = false;
  const bandMat = new MeshStandardMaterial({ color: 0xd9a514, roughness: 0.5, metalness: 0.3 });

  // fence runs: one merged frame + one merged chain-link mesh
  const fence = buildFence(
    fenceRuns().map((r) => ({ x0: r.x0, z0: r.z, x1: r.x1, z1: r.z })),
    0,
    GATES.fenceHeight,
  );
  const frame = add(new Mesh(fence.frame, galvanised));
  frame.name = 'gate-fence-frame';
  frame.castShadow = true;
  const panel = add(new Mesh(fence.mesh, meshMat));
  panel.name = 'gate-fence-mesh';

  const colliders: Collider[] = [];
  for (const b of fenceBoxes()) colliders.push(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.half, meta: { kind: 'static' } }));

  const system = new GateSystem();
  const leaves: LeafRuntime[] = [];
  const geoCache = new Map<number, ReturnType<typeof leafGeometry>>();
  for (const gate of system.gates) {
    for (const leaf of gate.def.leaves) {
      const key = Math.round(leaf.length * 100);
      let geo = geoCache.get(key);
      if (!geo) {
        geo = leafGeometry(leaf.length);
        geoCache.set(key, geo);
      }
      const pivot = add(new Object3D());
      pivot.name = `gate-${gate.def.id}`;
      pivot.position.set(leaf.hx, 0, leaf.z);
      pivot.rotation.y = leaf.dir === -1 ? Math.PI : 0;
      const f = new Mesh(geo.frame, galvanised);
      f.castShadow = true;
      pivot.add(f, new Mesh(geo.mesh, meshMat), new Mesh(geo.band, bandMat));
      scope.track(pivot);
      const box = leafBox(leaf);
      const collider = ctx.physics.addStaticBox({ center: box.center, halfExtents: box.half, groups: Groups.gate, meta: { kind: 'static' } });
      colliders.push(collider);
      leaves.push({ gate, leaf, pivot, collider });
    }
  }
  scope.onDispose(() => {
    for (const c of colliders) {
      try {
        ctx.physics.removeCollider(c);
      } catch {
        // physics world may already be gone
      }
    }
    for (const g of geoCache.values()) {
      g.frame.dispose();
      g.mesh.dispose();
      g.band.dispose();
    }
  });

  const pos = new Vector3();
  const walkers: Array<{ x: number; z: number }> = [];
  return {
    update(dt: number) {
      walkers.length = 0;
      for (const e of ctx.enemies.alive()) {
        if (e.type === 'drone') continue; // drones fly over the fences
        walkers.push({ x: e.position.x, z: e.position.z });
      }
      const p = ctx.player.alive ? { x: ctx.player.position.x, z: ctx.player.position.z } : null;
      for (const { gate, event } of system.update(dt, p, walkers)) {
        pos.set(gate.def.x, 1.2, gate.def.z);
        ctx.events.emit('world:gateMoved', { id: gate.def.id, position: pos.clone(), open: event === 'opened' });
      }
      for (const l of leaves) {
        l.pivot.rotation.y = (l.leaf.dir === -1 ? Math.PI : 0) + l.gate.leafYaw(l.leaf);
        const enabled = !l.gate.passable;
        if (l.collider.isEnabled() !== enabled) l.collider.setEnabled(enabled);
      }
    },
    summary: () => ({
      gates: system.gates.map((g) => ({ id: g.def.id, phase: g.phase, angle: +g.angle.toFixed(2) })),
      fenceRuns: fenceRuns().length,
    }),
  };
}
