import {
  Color,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { LAND, ZONES } from '@/config/level';
import { WORLD_LOCAL } from './tunables';

/**
 * Planar mirror of the scene about y = 0 (the wet ground), rendered into a half-resolution HDR
 * target. The ground shader samples it projectively, so puddles show real reflections of lamps,
 * containers and robots instead of a static environment map.
 */
export class PlanarReflection {
  readonly target: WebGLRenderTarget;
  readonly textureMatrix = new Matrix4();
  private readonly virtual = new PerspectiveCamera();
  private readonly camPos = new Vector3();
  private readonly look = new Vector3();
  private readonly up = new Vector3();
  private readonly rot = new Matrix4();
  private readonly size = new Vector2();
  enabled = true;
  /** Render target size relative to the drawing buffer. */
  scale = 0.5;

  constructor() {
    this.target = new WebGLRenderTarget(4, 4, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true });
    this.target.texture.name = 'ground-reflection';
  }

  /** `hidden` are made invisible for the mirror pass (the ground itself, rain, first-person rig). */
  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, hidden: readonly Object3D[]): void {
    if (!this.enabled) return;
    camera.getWorldPosition(this.camPos);
    if (this.camPos.y <= 0.01) return;
    renderer.getDrawingBufferSize(this.size);
    const w = Math.max(2, Math.floor(this.size.x * this.scale));
    const h = Math.max(2, Math.floor(this.size.y * this.scale));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);

    // mirror the eye, the look-at point and the up vector about y = 0 (same construction as a mirror camera)
    this.rot.extractRotation(camera.matrixWorld);
    this.look.set(0, 0, -1).applyMatrix4(this.rot).add(this.camPos);
    this.up.set(0, 1, 0).applyMatrix4(this.rot);
    const v = this.virtual;
    v.position.set(this.camPos.x, -this.camPos.y, this.camPos.z);
    v.up.set(this.up.x, -this.up.y, this.up.z);
    v.lookAt(this.look.x, -this.look.y, this.look.z);
    v.near = camera.near;
    v.far = camera.far;
    v.updateMatrixWorld();
    v.projectionMatrix.copy(camera.projectionMatrix);
    v.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(v.projectionMatrix);
    this.textureMatrix.multiply(v.matrixWorldInverse);

    const was = hidden.map((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, v);
    renderer.setRenderTarget(prevTarget);
    hidden.forEach((o, i) => {
      o.visible = was[i] as boolean;
    });
  }

  dispose(): void {
    this.target.dispose();
  }
}

export interface WetGround {
  mesh: Mesh;
  material: MeshStandardMaterial;
  uniforms: { uTime: { value: number }; uReflOn: { value: number } };
}

const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform float uReflOn;
uniform sampler2D tRefl;
uniform mat4 uReflMatrix;
uniform vec4 uYard;   // minZ, maxZ of the container yard, lane half width, quay line z
uniform vec3 uLanes;  // x of the two N-S lanes, unused
varying vec3 vWPos;

float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 gHash2(vec2 p) { return vec2(gHash(p), gHash(p + 19.19)); }
float gNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x), mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gFbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * gNoise(p); p = p * 2.02 + vec2(31.0, 17.0); a *= 0.5; }
  return v;
}
// distance to the nearest voronoi cell border (cracks)
float gCrack(vec2 p) {
  vec2 n = floor(p); vec2 f = fract(p);
  float d1 = 8.0; float d2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = gHash2(n + g);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
float gLine(float coord, float centre, float halfWidth) {
  float aa = fwidth(coord) * 1.2;
  return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, abs(coord - centre));
}
`;

/**
 * Wet quay surface as one plane: asphalt in the yard, concrete slabs on the quay, crane rails,
 * worn paint, cracks, still puddles and a planar reflection. Everything is evaluated
 * in the fragment shader from the world position, so there are no repeating tiles.
 */
export function createWetGround(reflection: PlanarReflection, lanesX: readonly number[]): WetGround {
  const w = LAND.maxX - LAND.minX;
  const d = LAND.maxZ - LAND.minZ;
  const geometry = new PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
  const material = new MeshStandardMaterial({ color: new Color(WORLD_LOCAL.ground.asphalt), roughness: 0.6, metalness: 0, envMapIntensity: 0.55 });
  const uniforms = {
    uTime: { value: 0 },
    uReflOn: { value: 1 },
    tRefl: { value: reflection.target.texture },
    uReflMatrix: { value: reflection.textureMatrix },
    uYard: { value: [ZONES.A.minZ, ZONES.A.maxZ, 3.0, ZONES.D.maxZ] },
    uLanes: { value: [lanesX[0] ?? -9, lanesX[1] ?? 9, 0] },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec2 gp = vWPos.xz;
        float quay = 1.0 - smoothstep(uYard.w - 0.15, uYard.w + 0.15, gp.y);   // 1 on the concrete quay
        float nLarge = gFbm(gp * 0.07);
        float nMid = gFbm(gp * 0.9 + 11.0);
        float nFine = gNoise(gp * 38.0);
        float speck = gHash(floor(gp * 160.0));
        // --- asphalt (yard, court, apron) ---
        vec3 asphalt = diffuseColor.rgb * (0.62 + 0.55 * nMid) * (0.82 + 0.3 * nFine);
        asphalt += vec3(0.05, 0.05, 0.048) * step(0.9, speck);                          // light aggregate
        float repair = smoothstep(0.58, 0.6, gNoise(floor(gp / vec2(7.0, 4.0)) * 1.7 + 3.0)) ; // repair patches
        asphalt *= mix(1.0, 0.72, repair);
        // --- concrete slabs (quay) ---
        vec2 slabUv = gp / 6.0;
        vec2 slabF = abs(fract(slabUv) - 0.5);
        float joint = smoothstep(0.492, 0.498, max(slabF.x, slabF.y));
        float slabTone = 0.85 + 0.3 * gHash(floor(slabUv) + 4.0);
        vec3 concrete = vec3(0.21, 0.21, 0.2) * slabTone * (0.75 + 0.45 * nMid) * (0.9 + 0.2 * nFine);
        concrete = mix(concrete, vec3(0.03), joint);
        vec3 base = mix(asphalt, concrete, quay);
        // --- cracks ---
        float crack = 1.0 - smoothstep(0.0, 0.035, gCrack(gp * 0.33 + gFbm(gp * 0.5) * 0.9));
        crack *= smoothstep(0.42, 0.7, gFbm(gp * 0.11 + 7.0));
        base = mix(base, vec3(0.012), crack * 0.85);
        // --- paint: lane edge lines in the yard, hazard hatching on the quay edge, stop bar at the gate ---
        float wear = smoothstep(0.25, 0.75, gFbm(gp * 1.7 + 23.0)) * (0.55 + 0.45 * nFine);
        float inYard = step(uYard.x - 1.0, gp.y) * step(gp.y, uYard.y + 1.0);
        float lines = 0.0;
        lines += gLine(gp.x, uLanes.x - uYard.z, 0.07) + gLine(gp.x, uLanes.x + uYard.z, 0.07);
        lines += gLine(gp.x, uLanes.y - uYard.z, 0.07) + gLine(gp.x, uLanes.y + uYard.z, 0.07);
        lines *= inYard;
        float dash = step(0.45, fract(gp.x / 3.0));
        lines += gLine(gp.y, uYard.y + 4.5, 0.09) * dash;
        vec3 paintCol = vec3(0.78, 0.6, 0.08);
        float hatchBand = step(gp.y, uYard.w - 31.6) ;                                    // last 2.4 m before the edge
        float hatch = step(0.5, fract((gp.x + gp.y) / 1.4)) * hatchBand;
        float paint = clamp(lines, 0.0, 1.0) * wear;
        base = mix(base, paintCol * (0.55 + 0.45 * nMid), paint * 0.9);
        base = mix(base, paintCol * 0.8, hatch * wear * 0.85);
        // --- crane rails (two steel strips along the quay) ---
        float rail = (gLine(gp.y, uYard.w - 20.0, 0.06) + gLine(gp.y, uYard.w - 30.0, 0.06)) * quay;
        base = mix(base, vec3(0.32, 0.31, 0.3), rail);
        // --- puddles: low ground from large noise, more of them in the yard lanes ---
        float low = gFbm(gp * 0.16 + vec2(5.0, 9.0)) + 0.18 * gNoise(gp * 0.9);
        float puddle = smoothstep(0.58, 0.66, low) * (1.0 - joint) ;
        puddle = max(puddle, crack * 0.5);
        float damp = smoothstep(0.42, 0.62, low);                                           // darker damp halo
        base *= mix(1.0, 0.55, damp);
        base *= mix(1.0, 0.45, puddle);
        diffuseColor.rgb = base;
        float gPuddle = puddle;
        float gRail = rail;
        float gPaint = max(paint, hatch * wear);
        float gMicro = nFine;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = mix(0.5, 0.34, damp);                 // everything is wet
        roughnessFactor = mix(roughnessFactor, 0.62, quay * (1.0 - damp));
        roughnessFactor = mix(roughnessFactor, 0.38, gPaint);
        roughnessFactor = mix(roughnessFactor, 0.2, gRail);
        roughnessFactor = mix(roughnessFactor, 0.035, gPuddle);
        roughnessFactor = clamp(roughnessFactor + (gMicro - 0.5) * 0.06 * (1.0 - gPuddle), 0.02, 1.0);
        `,
      )
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = gRail * 0.9;')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        // world-space normal: rough micro surface outside puddles, rain rings inside them
        float e = 0.02;
        float hx = gNoise((gp + vec2(e, 0.0)) * 9.0) - gNoise((gp - vec2(e, 0.0)) * 9.0);
        float hz = gNoise((gp + vec2(0.0, e)) * 9.0) - gNoise((gp - vec2(0.0, e)) * 9.0);
        vec2 bump = vec2(hx, hz) * 0.22 * (1.0 - gPuddle);
        // still water: a faint slow swell so reflections are not a perfect mirror
        bump += vec2(gNoise(gp * 1.3 + uTime * 0.25) - 0.5, gNoise(gp * 1.3 - uTime * 0.21 + 7.0) - 0.5) * 0.035 * gPuddle;
        vec3 nW = normalize(vec3(-bump.x, 1.0, -bump.y));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        `,
      )
      .replace(
        '#include <lights_fragment_end>',
        /* glsl */ `
        #include <lights_fragment_end>
        {
          vec3 V = normalize(cameraPosition - vWPos);
          float nv = clamp(dot(nW, V), 0.0, 1.0);
          float fres = 0.03 + 0.97 * pow(1.0 - nv, 5.0);
          vec4 rc = uReflMatrix * vec4(vWPos, 1.0);
          vec2 ruv = rc.xy / max(rc.w, 1e-4) + nW.xz * 0.045;
          vec3 refl = texture2D(tRefl, clamp(ruv, 0.001, 0.999)).rgb;
          float gloss = 1.0 - roughnessFactor;
          gloss = gloss * gloss;
          reflectedLight.indirectSpecular += refl * (fres * 0.92 + 0.02) * gloss * uReflOn;
        }
        `,
      );
  };
  material.customProgramCacheKey = () => 'wet-ground-v2';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ground';
  mesh.position.set((LAND.minX + LAND.maxX) / 2, 0, (LAND.minZ + LAND.maxZ) / 2);
  mesh.receiveShadow = true;
  return { mesh, material, uniforms };
}
