import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from 'three';
import type { FireSpot } from './layout';

const VERTEX = /* glsl */ `
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

// Procedural flame: value-noise fbm scrolling upwards, shaped into a tongue that narrows to the top.
// Only the hot core goes slightly above 1 so the bloom adds a glow without washing the flame out; additive, so it needs no sorting.
const FRAGMENT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  float t = uTime * 1.7 + vSeed * 17.0;
  vec2 uv = vUv;
  float n = fbm(vec2(uv.x * 3.2 + vSeed * 5.0, uv.y * 2.4 - t * 1.9));
  float width = (1.0 - uv.y) * 0.55 + 0.08;
  float body = 1.0 - smoothstep(width * 0.6, width, abs(uv.x - 0.5) + (n - 0.5) * 0.28);
  float heat = body * (1.15 - uv.y * 1.25) + (n - 0.5) * 0.7;
  heat = clamp(heat, 0.0, 1.0);
  float a = smoothstep(0.12, 0.5, heat);
  if (a < 0.01) discard;
  vec3 col = mix(vec3(0.85, 0.15, 0.02), vec3(1.35, 0.8, 0.26), smoothstep(0.5, 0.95, heat));
  // three crossed quads overlap on screen, so each one stays faint
  gl_FragColor = vec4(col, a * 0.45);
}`;

/** Three vertical quads crossed at 60 degrees, 1 m wide and 1 m tall, standing on the origin. */
function crossedQuads(): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const cx = Math.cos(a) * 0.5;
    const cz = Math.sin(a) * 0.5;
    const base = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** All flames of the level in one instanced draw call; advance `uniforms.uTime` every frame. */
export function buildFireMesh(spots: readonly FireSpot[]): InstancedMesh | null {
  if (spots.length === 0) return null;
  const geo = crossedQuads();
  geo.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(spots.map((s) => s.seed)), 1));
  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new InstancedMesh(geo, material, spots.length);
  const m = new Matrix4();
  spots.forEach((s, i) => mesh.setMatrixAt(i, m.makeScale(s.w, s.h, s.w).setPosition(s.x, s.y, s.z)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.renderOrder = 5;
  mesh.name = 'vehicle-fires';
  return mesh;
}
