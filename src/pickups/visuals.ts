import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PickupKind } from '@/core/types';
import { box, createVertexColorMaterial, cylX, cylZ, Parts } from '@/enemies/duck/modelKit';
import { PICKUP } from './tunables';

/** Steel ammunition case: ribbed olive shell, hinged lid, latches, carry handle, a belt of brass on top. */
function buildAmmoCase(): BufferGeometry {
  const p = new Parts();
  const olive = 0x56622e;
  const oliveDark = 0x3c4520;
  const steel = 0x9aa0a4;
  const black = 0x15171a;
  const brass = 0xd9a441;
  const hazard = 0xf2c200;
  p.add(box(0.56, 0.3, 0.36, 0.035), olive, [0, -0.03, 0]);
  p.add(box(0.58, 0.07, 0.38, 0.025), oliveDark, [0, 0.15, 0]);
  // pressed ribs on the long faces and a hazard band
  for (const z of [-0.182, 0.182]) {
    for (const x of [-0.2, -0.1, 0.1, 0.2]) p.add(box(0.035, 0.22, 0.012), oliveDark, [x, -0.04, z]);
    p.add(box(0.1, 0.24, 0.014), hazard, [0, -0.04, z]);
    p.add(box(0.1, 0.035, 0.016), black, [0, -0.04, z]);
  }
  // corner bumpers
  for (const x of [-0.27, 0.27]) for (const z of [-0.17, 0.17]) p.add(box(0.05, 0.36, 0.05, 0.015), black, [x, 0, z]);
  // latches on the short faces, hinge pins
  for (const x of [-0.285, 0.285]) {
    p.add(box(0.014, 0.12, 0.1, 0.006), steel, [x, 0.08, 0]);
    p.add(cylZ(0.014, 0.12, 6), steel, [x, 0.14, 0]);
  }
  // folding handle
  for (const x of [-0.11, 0.11]) p.add(box(0.02, 0.06, 0.02), steel, [x, 0.21, 0]);
  p.add(cylX(0.016, 0.26, 8), black, [0, 0.245, 0]);
  // belt of rounds lying across the lid
  for (let i = 0; i < 9; i++) {
    const x = -0.2 + i * 0.05;
    p.add(cylZ(0.017, 0.12, 8), brass, [x, 0.2, 0.1]);
    p.add(cylZ(0.011, 0.05, 6), 0xb5562a, [x, 0.2, 0.18]);
  }
  p.add(box(0.44, 0.012, 0.035), black, [0, 0.2, 0.08]);
  return p.merge();
}

/** Trauma kit: rounded white hard case, green cross inlays, orange seal strip, latches and a handle. */
function buildMedkit(): BufferGeometry {
  const p = new Parts();
  const white = 0xeceff1;
  const grey = 0x9ea4a8;
  const green = 0x17c653;
  const black = 0x15171a;
  const orange = 0xff6a1f;
  p.add(box(0.5, 0.15, 0.34, 0.04), white, [0, -0.085, 0]);
  p.add(box(0.5, 0.15, 0.34, 0.04), white, [0, 0.085, 0]);
  p.add(box(0.51, 0.025, 0.35, 0.008), orange, [0, 0, 0]);
  // crosses: top and both long faces
  p.add(box(0.26, 0.012, 0.085), green, [0, 0.162, 0]);
  p.add(box(0.085, 0.012, 0.26), green, [0, 0.162, 0]);
  for (const z of [-0.172, 0.172]) {
    p.add(box(0.2, 0.065, 0.012), green, [0, 0.085, z]);
    p.add(box(0.065, 0.13, 0.012), green, [0, 0.085, z]);
  }
  // rubber corners, latches, hinge, handle
  for (const x of [-0.24, 0.24]) for (const z of [-0.16, 0.16]) p.add(box(0.05, 0.33, 0.05, 0.02), black, [x, 0, z]);
  for (const x of [-0.13, 0.13]) {
    p.add(box(0.06, 0.09, 0.016, 0.006), grey, [x, 0, 0.178]);
    p.add(cylX(0.012, 0.07, 6), black, [x, 0.045, 0.186]);
    p.add(cylX(0.014, 0.08, 6), grey, [x, 0, -0.176]);
  }
  for (const x of [-0.09, 0.09]) p.add(box(0.02, 0.05, 0.02), grey, [x, 0.185, -0.1]);
  p.add(cylX(0.015, 0.22, 8), black, [0, 0.215, -0.1]);
  return p.merge();
}

/** Two crossed vertical planes: a soft light column so a pickup reads from across the yard. */
function buildHaloGeometry(): BufferGeometry {
  const a = new PlaneGeometry(0.9, 2.2).translate(0, 0.75, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const ring = new PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2).translate(0, -0.5, 0);
  // the ground disc is marked by uv.y > 1 so the shader can tell it from the column
  const uv = ring.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) + 2);
  const merged = mergeGeometries([a, b, ring], false);
  a.dispose();
  b.dispose();
  ring.dispose();
  if (!merged) throw new Error('pickups: halo merge failed');
  return merged;
}

function haloMaterial(color: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float a;
        if (vUv.y > 1.5) {
          // ground disc: a soft ring
          float r = length(vec2(vUv.x, vUv.y - 2.0) - 0.5) * 2.0;
          a = smoothstep(1.0, 0.72, r) * smoothstep(0.35, 0.72, r) * 0.55 + smoothstep(0.6, 0.0, r) * 0.18;
        } else {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          a = pow(max(across, 0.0), 2.5) * pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.08, vUv.y) * 0.5;
        }
        gl_FragColor = vec4(uColor * a * 1.6, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    fog: false,
  });
}

const Y_AXIS = new Vector3(0, 1, 0);

/**
 * Instanced meshes with shared geometry and material: one model and one light column per kind, four
 * draw calls for every pickup. Instances are rewritten each frame in a compact order via `begin / push / end`.
 */
export class PickupRenderer {
  readonly meshes: Record<PickupKind, InstancedMesh>;
  readonly halos: Record<PickupKind, InstancedMesh>;
  private readonly counts: Record<PickupKind, number> = { ammo: 0, medkit: 0 };
  private readonly quat = new Quaternion();
  private readonly pos = new Vector3();
  private readonly unit = new Vector3(1, 1, 1);
  private readonly matrix = new Matrix4();

  constructor() {
    const ammo = new InstancedMesh(
      buildAmmoCase(),
      createVertexColorMaterial(0.5, 0.45, { key: 'ammo', wear: 0.6, bottomY: -0.2, height: 0.45, detail: 5 }),
      PICKUP.capacityPerKind,
    );
    const medkit = new InstancedMesh(
      buildMedkit(),
      createVertexColorMaterial(0.38, 0.05, { key: 'medkit', wear: 0.12, bottomY: -0.2, height: 0.45, detail: 5 }),
      PICKUP.capacityPerKind,
    );
    const haloGeo = buildHaloGeometry();
    const ammoHalo = new InstancedMesh(haloGeo, haloMaterial(0xffb637), PICKUP.capacityPerKind);
    const medkitHalo = new InstancedMesh(haloGeo, haloMaterial(0x39ff8a), PICKUP.capacityPerKind);
    for (const mesh of [ammo, medkit, ammoHalo, medkitHalo]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }
    for (const halo of [ammoHalo, medkitHalo]) {
      halo.renderOrder = 5;
      halo.userData.noReflect = true;
    }
    ammoHalo.name = 'pickups-ammo-halo';
    medkitHalo.name = 'pickups-medkit-halo';
    this.halos = { ammo: ammoHalo, medkit: medkitHalo };
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
    this.halos[kind].setMatrixAt(i, this.matrix);
    this.counts[kind] = i + 1;
    return true;
  }

  end(): void {
    for (const kind of ['ammo', 'medkit'] as const) {
      const mesh = this.meshes[kind];
      mesh.count = this.counts[kind];
      mesh.instanceMatrix.needsUpdate = true;
      const halo = this.halos[kind];
      halo.count = this.counts[kind];
      halo.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of [...Object.values(this.meshes), ...Object.values(this.halos)]) {
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial | ShaderMaterial).dispose();
      mesh.dispose();
      mesh.removeFromParent();
    }
  }
}
