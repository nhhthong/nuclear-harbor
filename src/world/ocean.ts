import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import { SEA_LEVEL_Y } from '@/config/level';
import { WORLD } from '@/config/tunables';
import { WORLD_LOCAL } from './tunables';

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Two scrolling sine waves displace the normal; fresnel-ish blend between deep and shallow colour.
const fragment = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float t = uTime * uSpeed;
  vec2 d1 = normalize(vec2(1.0, 0.4));
  vec2 d2 = normalize(vec2(-0.3, 1.0));
  float f1 = 0.35;
  float f2 = 0.8;
  float ph1 = dot(p, d1) * f1 + t * 1.2;
  float ph2 = dot(p, d2) * f2 + t * 1.7;
  vec2 grad = d1 * cos(ph1) * 0.35 * f1 + d2 * cos(ph2) * 0.15 * f2;
  vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(uDeep, uShallow, clamp(fres * 0.9 + 0.12, 0.0, 1.0));
  vec3 h = normalize(uSunDir + v);
  col += pow(max(dot(n, h), 0.0), 90.0) * vec3(1.0, 0.9, 0.7) * 0.7;
  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Ocean {
  mesh: Mesh;
  material: ShaderMaterial;
}

export function createOcean(sunDir: Vector3, fogColor: Color): Ocean {
  const geometry = new PlaneGeometry(WORLD_LOCAL.ocean.size, WORLD_LOCAL.ocean.size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: WORLD_LOCAL.ocean.waveSpeed },
      uDeep: { value: new Color(WORLD_LOCAL.ocean.deep) },
      uShallow: { value: new Color(WORLD_LOCAL.ocean.shallow) },
      uSunDir: { value: sunDir.clone() },
      uFogColor: { value: fogColor.clone() },
      uFogNear: { value: WORLD.fogNear },
      uFogFar: { value: WORLD.fogFar },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'ocean';
  mesh.position.set(0, SEA_LEVEL_Y, 0);
  mesh.frustumCulled = false;
  return { mesh, material };
}
