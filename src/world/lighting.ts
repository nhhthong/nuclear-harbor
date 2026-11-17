import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
} from 'three';
import type { GameContext } from '@/core/GameContext';
import { PERFORMANCE, type QualityPreset } from '@/config/tunables';
import { WORLD_LOCAL } from './tunables';

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Sunset after rain: warm horizon towards the sun, cooler violet band on the opposite side, deep
// blue zenith, broken cloud lit from below, sun disc with a wide glow.
const domeFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uAnti;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunTint;
uniform float uTime;
uniform float uCover;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float s = max(dot(d, uSunDir), 0.0);
  // azimuthal blend: sun side warm, far side cool
  // sun-side factor; it has no meaning straight up, so it fades to neutral near the zenith (otherwise the
  // sign flip of d.xz draws a hard seam there, which the wet ground mirrors)
  float horiz = length(d.xz);
  float side = dot(d.xz / max(horiz, 1e-4), normalize(uSunDir.xz)) * 0.5 + 0.5;
  side = mix(0.5, side, smoothstep(0.05, 0.45, horiz));
  vec3 horizon = mix(uAnti, uHorizon, smoothstep(0.0, 1.0, side));
  float up = smoothstep(0.0, 0.62, d.y);
  vec3 col = mix(horizon, uZenith, pow(up, 0.8));
  col += uSunTint * pow(s, 6.0) * 0.4;
  if (d.y > 0.01) {
    vec2 uv = d.xz / (d.y + 0.16) * 1.15 + vec2(uTime * 0.004, uTime * 0.0015);
    float deck = fbm(uv);
    // overcast deck: coverage moves the threshold, the sun only brightens the deck a little on its side
    float lo = mix(0.6, 0.18, uCover);
    float c = smoothstep(lo, lo + 0.3, deck);
    float fade = smoothstep(0.0, 0.16, d.y);
    vec3 lit = mix(uCloudLit, uCloudLit + uSunTint * 0.18, pow(side, 2.0) * pow(s, 2.0));
    vec3 cloud = mix(lit, uCloudShade, smoothstep(0.5, 0.95, deck) * 0.8);
    col = mix(col, cloud, c * fade * 0.95);
  }
  // pale sun smear behind the deck instead of a disc
  col += uSunTint * (pow(s, 24.0) * 0.18 + pow(s, 300.0) * 0.25) * (1.0 - 0.6 * uCover);
  col = mix(uGround, col, smoothstep(-0.1, 0.0, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Lighting {
  sun: DirectionalLight;
  hemi: HemisphereLight;
  dome: Mesh;
  sunDir: Vector3;
  fogColor: Color;
  /** Prefiltered sky reflection used as `scene.environment`. */
  environment: Texture | null;
  /** Advances the cloud drift. */
  update(dt: number): void;
  setQuality(preset: QualityPreset): void;
}

/** Direction pointing TOWARDS the light for azimuth clockwise from north (-Z), +X east. */
function skyDirection(elevationDeg: number, azimuthDeg: number, out = new Vector3()): Vector3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * Sunset lighting with ONE real light: the low sun (the only shadow caster), a hemisphere fill, the
 * sky dome, light haze and a reflection probe of the sky for metal and wet surfaces.
 */
export function createLighting(ctx: GameContext): Lighting {
  const cfg = WORLD_LOCAL;
  const sunDir = skyDirection(cfg.sun.elevationDeg, cfg.sun.azimuthDeg);
  const fogColor = new Color(cfg.sky.fog);

  const sun = new DirectionalLight(cfg.sun.color, cfg.sun.intensity);
  sun.name = 'sun';
  // the shadow box covers the whole quay (72 x 172 m): wide across the sun's direction, low in height
  sun.target.position.set(0, 0, cfg.sun.centerZ);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, cfg.sun.distance);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -cfg.sun.frustumHalf;
  cam.right = cfg.sun.frustumHalf;
  cam.top = cfg.sun.frustumHalfHeight;
  cam.bottom = -cfg.sun.frustumHalfHeight;
  cam.near = 10;
  cam.far = cfg.sun.distance * 2;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.16;
  sun.shadow.radius = 3;

  const hemi = new HemisphereLight(cfg.hemi.sky, cfg.hemi.ground, cfg.hemi.intensity);
  hemi.name = 'sky-hemisphere';

  const uniforms = {
    uHorizon: { value: new Color(cfg.sky.horizon) },
    uZenith: { value: new Color(cfg.sky.zenith) },
    uAnti: { value: new Color(cfg.sky.antiSun) },
    uGround: { value: new Color(cfg.sky.ground) },
    uSunDir: { value: sunDir.clone() },
    uSunTint: { value: new Color(cfg.sky.sunTint) },
    uCover: { value: cfg.sky.cloudCover },
    uCloudLit: { value: new Color(...cfg.sky.cloudLit) },
    uCloudShade: { value: new Color(...cfg.sky.cloudShade) },
    uTime: { value: 0 },
  };
  const dome = new Mesh(
    new SphereGeometry(cfg.sky.radius, 32, 16),
    new ShaderMaterial({ vertexShader: domeVertex, fragmentShader: domeFragment, uniforms, side: BackSide, depthWrite: false, fog: false }),
  );
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -10;

  ctx.scene.fog = new FogExp2(fogColor, cfg.sky.fogDensity);
  ctx.scene.background = fogColor.clone();

  const setQuality = (preset: QualityPreset): void => {
    const size = PERFORMANCE.quality[preset].shadowMapSize;
    if (sun.shadow.mapSize.x === size && sun.shadow.map) return;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  };
  setQuality(ctx.settings.get('quality'));

  let environment: Texture | null = null;
  try {
    const pmrem = new PMREMGenerator(ctx.renderer.webgl);
    const probeScene = new Scene();
    probeScene.add(new Mesh(dome.geometry, dome.material));
    environment = pmrem.fromScene(probeScene, 0, 0.5, cfg.sky.radius * 2).texture;
    pmrem.dispose();
    ctx.scene.environment = environment;
    ctx.scene.environmentIntensity = cfg.sky.environmentIntensity;
  } catch (error) {
    console.warn('[world] sky reflection probe unavailable:', error);
  }

  const update = (dt: number): void => {
    uniforms.uTime.value += dt;
  };

  return { sun, hemi, dome, sunDir, fogColor, environment, update, setQuality };
}
