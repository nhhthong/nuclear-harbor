import {
  CanvasTexture,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import { WORLD } from '@/config/tunables';
import { MeshBuilder } from './meshBuilder';

const L = WORLD.container.length;
const H = WORLD.container.height;
const W = WORLD.container.width;

/** Shared GLSL: value noise + fbm on world positions (no textures, no tiling). */
export const PAINT_GLSL = /* glsl */ `
varying vec3 vPaintW;
varying vec3 vPaintL;
varying vec3 vPaintN;
float pHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1,0,0)), f.x), mix(pHash(i + vec3(0,1,0)), pHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0,0,1)), pHash(i + vec3(1,0,1)), f.x), mix(pHash(i + vec3(0,1,1)), pHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float pFbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * pNoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
`;

/**
 * Painted, weathered steel: chips that expose primer and bare metal, rust that gathers low down and
 * runs downwards, vertical grime streaks and a wet sheen on upward faces. Patches a standard material
 * so lighting, shadows, fog and instancing keep working. `bottomY`/`height` describe the object's
 * local vertical extent (rust bias).
 */
export function applyWeatheredPaint(material: MeshStandardMaterial, opts: { bottomY: number; height: number; wear?: number; key: string }): void {
  const wear = opts.wear ?? 1;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: [opts.bottomY, opts.height, wear] };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintW;\nvarying vec3 vPaintL;\nvarying vec3 vPaintN;')
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `#include <worldpos_vertex>
        vPaintL = position;
        #ifdef USE_INSTANCING
          vPaintW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vPaintN = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
        #else
          vPaintW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vPaintN = mat3(modelMatrix) * normal;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uPaint;\n${PAINT_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float pY = clamp((vPaintL.y - uPaint.x) / uPaint.y, 0.0, 1.0);           // 0 bottom .. 1 top
        float pBig = pFbm(vPaintW * 0.55);
        float pMid = pFbm(vPaintW * 2.6 + 3.0);
        float pFine = pNoise(vPaintW * 34.0);
        // faded, uneven paint
        diffuseColor.rgb *= 0.72 + 0.5 * pBig;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.33))), 0.18 * pMid);
        // grime streaks running down
        float streak = pNoise(vec3(vPaintW.x * 7.0, vPaintW.y * 0.5, vPaintW.z * 7.0));
        diffuseColor.rgb *= 1.0 - 0.38 * smoothstep(0.55, 0.9, streak) * (0.4 + 0.6 * (1.0 - pY));
        // rust: more near the bottom edge and where the big noise is high
        float rustBias = (1.0 - pY) * (1.0 - pY) * 0.34 + smoothstep(0.93, 1.0, pY) * 0.12;
        float rust = smoothstep(0.6, 0.72, pMid * 0.75 + pBig * 0.3 + rustBias * uPaint.z + (pFine - 0.5) * 0.12);
        vec3 rustCol = mix(vec3(0.16, 0.06, 0.025), vec3(0.34, 0.15, 0.05), pFine);
        // chips: small sharp flakes down to primer / steel
        float chip = smoothstep(0.80, 0.84, pNoise(vPaintW * 9.0) * 0.7 + pFine * 0.3 + rust * 0.12) * uPaint.z;
        diffuseColor.rgb = mix(diffuseColor.rgb, rustCol, rust * 0.92);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.20, 0.17, 0.15), rustCol, 0.5), chip);
        float pRust = max(rust, chip);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `float roughnessFactor = roughness;
        roughnessFactor = mix(roughnessFactor * (0.8 + 0.4 * pFine), 0.92, pRust);
        // rain: upward faces are wetter (smoother), everything gets a thin film
        roughnessFactor = mix(roughnessFactor, 0.14, smoothstep(0.5, 0.95, normalize(vPaintN).y) * (1.0 - 0.6 * pRust));
        roughnessFactor = clamp(roughnessFactor - 0.1 * pBig, 0.08, 1.0);`,
      )
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * (1.0 - pRust);');
  };
  material.customProgramCacheKey = () => `weathered-${opts.key}`;
}

export interface ContainerGeometry {
  /** Painted body: frame, corrugated walls and roof, doors. Tinted by the instance colour. */
  body: BufferGeometry;
  /** Galvanised hardware and rubber: locking bars, hinges, corner castings. Not tinted. */
  hardware: BufferGeometry;
}

/**
 * One 20 ft ISO container modelled as geometry instead of a textured box: corner posts and rails,
 * corrugated side walls, front wall and roof, a floor, two doors with locking bars, cam keepers,
 * handles and hinges, and the eight corner castings. About 1.6k triangles, shared by every instance.
 */
export function buildContainerGeometry(): ContainerGeometry {
  const body = new MeshBuilder();
  const hw = new MeshBuilder();
  const hx = L / 2;
  const hy = H / 2;
  const hz = W / 2;
  const post = 0.14;
  const rail = 0.13;
  const inset = 0.035;
  const ribDepth = 0.034;

  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.box(sx * (hx - post / 2), 0, sz * (hz - post / 2), post / 2, hy, post / 2);
  // top and bottom side rails, end headers and sills
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) body.box(0, sy * (hy - rail / 2), sz * (hz - post / 2), hx - post, rail / 2, post / 2);
    for (const sx of [-1, 1]) body.box(sx * (hx - post / 2), sy * (hy - rail / 2), 0, post / 2, rail / 2, hz - post);
  }
  // floor
  body.box(0, -hy + 0.06, 0, hx - post, 0.06, hz - post);

  const wallH = H - 2 * rail;
  const wallL = L - 2 * post;
  // side walls (u x v must equal the outward normal)
  body.corrugated([-hx + post, -hy + rail, hz - inset - ribDepth], [1, 0, 0], [0, 1, 0], [0, 0, 1], wallL, wallH, 0.275, ribDepth);
  body.corrugated([hx - post, -hy + rail, -hz + inset + ribDepth], [-1, 0, 0], [0, 1, 0], [0, 0, -1], wallL, wallH, 0.275, ribDepth);
  // front wall (-x)
  const endW = W - 2 * post;
  body.corrugated([-hx + inset + ribDepth, -hy + rail, -hz + post], [0, 0, 1], [0, 1, 0], [-1, 0, 0], endW, wallH, 0.25, ribDepth);
  // roof: shallow ribs across the width (u along x, v along -z gives +y)
  body.corrugated([-hx + post, hy - 0.03 - 0.018, hz - post], [1, 0, 0], [0, 0, -1], [0, 1, 0], wallL, endW, 0.21, 0.018);

  // doors (+x): two leaves with a centre gap and three pressed horizontal ribs each
  const doorX = hx - inset;
  const leafW = endW / 2 - 0.012;
  for (const s of [-1, 1]) {
    const cz = s * (leafW / 2 + 0.012);
    body.box(doorX - 0.02, 0, cz, 0.02, wallH / 2, leafW / 2);
    for (const ry of [-0.72, 0, 0.72]) body.box(doorX + 0.008, ry, cz, 0.008, 0.11, leafW / 2 - 0.07);
    // two locking bars per leaf with cam keepers top and bottom, a handle and its catch
    for (const b of [-0.27, 0.27]) {
      const bz = cz + b;
      hw.box(doorX + 0.035, 0, bz, 0.017, wallH / 2 + 0.05, 0.017);
      for (const ky of [-1, 1]) hw.box(doorX + 0.03, ky * (wallH / 2 + 0.01), bz, 0.03, 0.045, 0.05);
      hw.box(doorX + 0.03, -0.12, bz, 0.026, 0.03, 0.04);
      hw.box(doorX + 0.055, -0.28, bz + 0.12, 0.012, 0.022, 0.16);
      hw.box(doorX + 0.04, -0.28, bz + 0.27, 0.02, 0.04, 0.03);
    }
    // hinges on the outer edge
    for (const hyy of [-0.95, -0.32, 0.32, 0.95]) hw.box(doorX + 0.012, hyy, s * (endW / 2 - 0.02), 0.022, 0.06, 0.045);
  }
  // rubber gasket line between the leaves
  hw.box(doorX + 0.004, 0, 0, 0.006, wallH / 2, 0.014);

  // corner castings: slightly proud blocks with the usual chamfer-free look
  const cc = 0.089;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    hw.box(sx * (hx - cc + 0.006), sy * (hy - cc * 0.66 + 0.004), sz * (hz - cc + 0.006), cc, cc * 0.66, cc);
  }
  return { body: body.build(), hardware: hw.build() };
}

export interface ContainerInstanceSpec {
  x: number;
  y: number;
  z: number;
  yaw: number;
  color: number;
  /** 0..1 pseudo random, picks the livery and flips the doors' side. */
  seed: number;
}

const LIVERIES = ['NORDHAVN', 'KESTREL LINE', 'ORION CARGO', 'HALCYON', 'TRIDENT SEA', 'VANTA FREIGHT'] as const;

/** Stencil atlas: one livery wordmark per row, white on transparent, with a small ID line. */
function createLiveryAtlas(): CanvasTexture {
  const rowH = 128;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = rowH * LIVERIES.length;
  const g = canvas.getContext('2d');
  if (g) {
    g.clearRect(0, 0, canvas.width, canvas.height);
    LIVERIES.forEach((name, i) => {
      const y = i * rowH;
      g.fillStyle = 'rgba(238,236,228,0.94)';
      g.font = '900 78px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
      g.textBaseline = 'middle';
      g.fillText(name, 18, y + 50, 990);
      g.font = '600 22px "Courier New", monospace';
      const id = `${name.slice(0, 3)}U ${100000 + ((i * 271828) % 899999)} ${(i * 3) % 10}   22G1   MAX GROSS 30,480 KG   TARE 2,230 KG`;
      g.fillText(id, 22, y + 108, 990);
      // scuffs: knock holes into the stencil
      g.globalCompositeOperation = 'destination-out';
      let seed = 97 + i * 131;
      for (let k = 0; k < 220; k++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const sx = (seed >>> 8) % 1024;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const sy = y + ((seed >>> 8) % rowH);
        seed = (seed * 1664525 + 1013904223) >>> 0;
        g.fillStyle = `rgba(0,0,0,${0.25 + ((seed >>> 8) % 60) / 100})`;
        g.fillRect(sx, sy, 2 + ((seed >>> 4) % 14), 1 + ((seed >>> 12) % 3));
      }
      g.globalCompositeOperation = 'source-over';
    });
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export interface ContainerMeshes {
  body: InstancedMesh;
  hardware: InstancedMesh;
  liveries: InstancedMesh;
}

/** Three instanced meshes for every container of the level (3 draw calls + shadow passes). */
export function createContainerMeshes(specs: readonly ContainerInstanceSpec[]): ContainerMeshes {
  const geo = buildContainerGeometry();
  const bodyMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.25 });
  applyWeatheredPaint(bodyMat, { bottomY: -H / 2, height: H, key: 'container' });
  const hardwareMat = new MeshStandardMaterial({ color: 0x8b8f92, roughness: 0.38, metalness: 0.85 });
  applyWeatheredPaint(hardwareMat, { bottomY: -H / 2, height: H, wear: 0.7, key: 'hardware' });

  const body = new InstancedMesh(geo.body, bodyMat, specs.length);
  const hardware = new InstancedMesh(geo.hardware, hardwareMat, specs.length);
  body.name = 'containers';
  hardware.name = 'container-hardware';

  // livery decals: one quad on each long side
  const atlas = createLiveryAtlas();
  const decalGeo = new PlaneGeometry(L * 0.62, 0.62);
  const rows = new Float32Array(specs.length * 2);
  decalGeo.setAttribute('aRow', new InstancedBufferAttribute(rows, 1));
  const decalMat = new MeshStandardMaterial({ map: atlas, transparent: true, alphaTest: 0.08, roughness: 0.5, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  decalMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRow;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvMapUv.y = (vMapUv.y + aRow) / ${LIVERIES.length.toFixed(1)};`);
  };
  decalMat.customProgramCacheKey = () => 'container-livery';
  const liveries = new InstancedMesh(decalGeo, decalMat, specs.length * 2);
  liveries.name = 'container-liveries';

  const obj = new Object3D();
  const side = new Object3D();
  const m = new Matrix4();
  const color = new Color();
  specs.forEach((c, i) => {
    obj.position.set(c.x, c.y, c.z);
    // doors face either end
    obj.rotation.set(0, c.yaw + (c.seed > 0.5 ? Math.PI : 0), 0);
    obj.updateMatrix();
    body.setMatrixAt(i, obj.matrix);
    hardware.setMatrixAt(i, obj.matrix);
    body.setColorAt(i, color.setHex(c.color));
    const row = LIVERIES.length - 1 - Math.floor(c.seed * 977) % LIVERIES.length;
    for (const s of [0, 1]) {
      side.position.set(0, 0.42, (s === 0 ? 1 : -1) * (W / 2 - 0.0 + 0.004));
      side.rotation.set(0, s === 0 ? 0 : Math.PI, 0);
      side.updateMatrix();
      m.multiplyMatrices(obj.matrix, side.matrix);
      liveries.setMatrixAt(i * 2 + s, m);
      rows[i * 2 + s] = row;
    }
  });
  body.instanceMatrix.needsUpdate = true;
  hardware.instanceMatrix.needsUpdate = true;
  liveries.instanceMatrix.needsUpdate = true;
  if (body.instanceColor) body.instanceColor.needsUpdate = true;
  for (const mesh of [body, hardware]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
  }
  liveries.computeBoundingSphere();
  return { body, hardware, liveries };
}
