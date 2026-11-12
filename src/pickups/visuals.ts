import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PickupKind } from '@/core/types';
import { PICKUP } from './tunables';

/** Part of a pickup model: a box with a flat vertex colour. */
interface Part {
  size: [number, number, number];
  offset: [number, number, number];
  color: number;
}

function buildGeometry(parts: readonly Part[]): BufferGeometry {
  const geos = parts.map((p) => {
    const g = new BoxGeometry(...p.size);
    g.translate(...p.offset);
    const color = new Color(p.color);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) throw new Error('pickups: geometry merge failed');
  return merged;
}

/** Olive crate with a yellow stripe. */
const AMMO_PARTS: readonly Part[] = [
  { size: [0.55, 0.36, 0.38], offset: [0, 0, 0], color: 0x5c6b2e },
  { size: [0.12, 0.38, 0.4], offset: [0, 0, 0], color: 0xf2c200 },
  { size: [0.57, 0.05, 0.4], offset: [0, 0.2, 0], color: 0x44511f },
];

/** White box with a green cross on top and on both long faces. */
const MEDKIT_PARTS: readonly Part[] = [
  { size: [0.5, 0.32, 0.34], offset: [0, 0, 0], color: 0xf2f2f2 },
  { size: [0.3, 0.02, 0.08], offset: [0, 0.165, 0], color: 0x1fbf4a },
  { size: [0.08, 0.02, 0.3], offset: [0, 0.165, 0], color: 0x1fbf4a },
  { size: [0.26, 0.08, 0.02], offset: [0, 0, 0.175], color: 0x1fbf4a },
  { size: [0.08, 0.26, 0.02], offset: [0, 0, 0.175], color: 0x1fbf4a },
  { size: [0.26, 0.08, 0.02], offset: [0, 0, -0.175], color: 0x1fbf4a },
  { size: [0.08, 0.26, 0.02], offset: [0, 0, -0.175], color: 0x1fbf4a },
];

const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Two instanced meshes (ammo, medkit) with shared geometry and material: two draw calls for every
 * pickup. Instances are rewritten each frame in a compact order via `begin / push / end`.
 */
export class PickupRenderer {
  readonly meshes: Record<PickupKind, InstancedMesh>;
  private readonly counts: Record<PickupKind, number> = { ammo: 0, medkit: 0 };
  private readonly quat = new Quaternion();
  private readonly pos = new Vector3();
  private readonly unit = new Vector3(1, 1, 1);
  private readonly matrix = new Matrix4();

  constructor() {
    const ammo = new InstancedMesh(
      buildGeometry(AMMO_PARTS),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, emissive: 0x3a4a14, emissiveIntensity: 0.6 }),
      PICKUP.capacityPerKind,
    );
    const medkit = new InstancedMesh(
      buildGeometry(MEDKIT_PARTS),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, emissive: 0x2f6a3c, emissiveIntensity: 0.6 }),
      PICKUP.capacityPerKind,
    );
    for (const mesh of [ammo, medkit]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    ammo.name = 'pickups-ammo';
    medkit.name = 'pickups-medkit';
    this.meshes = { ammo, medkit };
  }

  begin(): void {
    this.counts.ammo = 0;
    this.counts.medkit = 0;
  }

  /** Adds one visible instance; returns false when the per-kind capacity is exhausted. */
  push(kind: PickupKind, x: number, y: number, z: number, yaw: number): boolean {
    const mesh = this.meshes[kind];
    const i = this.counts[kind];
    if (i >= PICKUP.capacityPerKind) return false;
    this.quat.setFromAxisAngle(Y_AXIS, yaw);
    this.pos.set(x, y, z);
    this.matrix.compose(this.pos, this.quat, this.unit);
    mesh.setMatrixAt(i, this.matrix);
    this.counts[kind] = i + 1;
    return true;
  }

  end(): void {
    for (const kind of ['ammo', 'medkit'] as const) {
      const mesh = this.meshes[kind];
      mesh.count = this.counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh.dispose();
      mesh.removeFromParent();
    }
  }
}
