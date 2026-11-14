import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineSegments,
  Points,
  ShaderMaterial,
  type Object3D,
} from 'three';
import { WORLD_LOCAL } from './tunables';

const streakVertex = /* glsl */ `
attribute vec3 aSeed;     // x, z in 0..1 of the box, phase
attribute float aEnd;     // 0 = head, 1 = tail of the streak
uniform vec3 uCam;
uniform float uTime;
uniform vec4 uBox;        // size, height, speed, length
uniform vec2 uWind;
varying float vFade;
void main() {
  float fall = uBox.z * (0.8 + 0.4 * aSeed.z);
  float y = mod(aSeed.z * 97.0 - uTime * fall, uBox.y);
  // wrap the column around the camera so the rain volume follows the player without popping
  vec2 xz = (aSeed.xy - 0.5) * uBox.x;
  vec2 drift = uWind * ((uBox.y - y) / fall);
  vec2 world = uCam.xz + mod(xz + drift - uCam.xz + uBox.x * 0.5, uBox.x) - uBox.x * 0.5;
  vec3 p = vec3(world.x, y, world.y);
  vec3 dir = normalize(vec3(uWind.x, -fall, uWind.y));
  p -= dir * uBox.w * aEnd;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float dist = length(mv.xyz);
  vFade = (1.0 - aEnd) * smoothstep(uBox.x * 0.5, uBox.x * 0.25, dist) * smoothstep(0.6, 2.5, dist);
  gl_Position = projectionMatrix * mv;
}
`;

const streakFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uFlash;
varying float vFade;
void main() {
  float a = vFade * (0.16 + 0.5 * uFlash);
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const splashVertex = /* glsl */ `
attribute vec3 aSeed;
uniform vec3 uCam;
uniform float uTime;
uniform float uBoxSize;
uniform float uPixel;
varying float vLife;
void main() {
  float rate = 1.6 + aSeed.z;
  float t = fract(uTime * rate + aSeed.z * 31.0);
  float cycle = floor(uTime * rate + aSeed.z * 31.0);
  // a new random spot every cycle
  vec2 jitter = fract(sin(vec2(cycle * 12.9898 + aSeed.x * 78.233, cycle * 39.346 + aSeed.y * 11.135)) * 43758.5453);
  vec2 xz = (jitter - 0.5) * uBoxSize;
  vec2 world = uCam.xz + mod(xz - uCam.xz + uBoxSize * 0.5, uBoxSize) - uBoxSize * 0.5;
  vec4 mv = viewMatrix * vec4(world.x, 0.03 + t * 0.09, world.y, 1.0);
  vLife = t;
  gl_PointSize = uPixel * (0.05 + 0.16 * t) / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const splashFragment = /* glsl */ `
uniform vec3 uColor;
varying float vLife;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  // a thin crown that widens and fades
  float ring = smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.85, 1.0, d));
  float a = ring * (1.0 - vLife) * 0.5;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Rain {
  objects: Object3D[];
  update(dt: number, camX: number, camY: number, camZ: number, flash: number, viewportHeight: number, fovDeg: number): void;
}

/**
 * Rain as two GPU-animated draw calls: wind-slanted streaks in a box that wraps around the camera
 * and splash crowns on the ground. Nothing is simulated on the CPU.
 */
export function createRain(): Rain {
  const cfg = WORLD_LOCAL.rain;
  let seed = 20261114;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed >>> 8) / 16777216;
  };

  const n = cfg.streaks;
  const seeds = new Float32Array(n * 2 * 3);
  const ends = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const x = rnd();
    const z = rnd();
    const ph = rnd();
    for (let k = 0; k < 2; k++) {
      seeds.set([x, z, ph], (i * 2 + k) * 3);
      ends[i * 2 + k] = k;
    }
  }
  const streakGeo = new BufferGeometry();
  streakGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 2 * 3), 3));
  streakGeo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 3));
  streakGeo.setAttribute('aEnd', new Float32BufferAttribute(ends, 1));
  const streakMat = new ShaderMaterial({
    vertexShader: streakVertex,
    fragmentShader: streakFragment,
    uniforms: {
      uCam: { value: [0, 0, 0] },
      uTime: { value: 0 },
      uBox: { value: [cfg.boxSize, cfg.boxHeight, cfg.speed, cfg.length] },
      uWind: { value: [cfg.windX, cfg.windZ] },
      uColor: { value: new Color(0xa9bcd6) },
      uFlash: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const streaks = new LineSegments(streakGeo, streakMat);
  streaks.name = 'rain-streaks';
  streaks.frustumCulled = false;
  streaks.renderOrder = 8;

  const m = cfg.splashes;
  const sSeeds = new Float32Array(m * 3);
  for (let i = 0; i < m * 3; i++) sSeeds[i] = rnd();
  const splashGeo = new BufferGeometry();
  splashGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(m * 3), 3));
  splashGeo.setAttribute('aSeed', new Float32BufferAttribute(sSeeds, 3));
  const splashMat = new ShaderMaterial({
    vertexShader: splashVertex,
    fragmentShader: splashFragment,
    uniforms: {
      uCam: { value: [0, 0, 0] },
      uTime: { value: 0 },
      uBoxSize: { value: cfg.boxSize * 0.7 },
      uPixel: { value: 800 },
      uColor: { value: new Color(0xc2d2e6) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const splashes = new Points(splashGeo, splashMat);
  splashes.name = 'rain-splashes';
  splashes.frustumCulled = false;
  splashes.renderOrder = 7;

  let time = 0;
  return {
    objects: [streaks, splashes],
    update(dt, camX, camY, camZ, flash, viewportHeight, fovDeg) {
      time += dt;
      const cam = [camX, camY, camZ];
      (streakMat.uniforms.uCam as { value: number[] }).value = cam;
      (streakMat.uniforms.uTime as { value: number }).value = time;
      (streakMat.uniforms.uFlash as { value: number }).value = flash;
      (splashMat.uniforms.uCam as { value: number[] }).value = cam;
      (splashMat.uniforms.uTime as { value: number }).value = time;
      // world size -> pixels for point sprites
      (splashMat.uniforms.uPixel as { value: number }).value = viewportHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
    },
  };
}
