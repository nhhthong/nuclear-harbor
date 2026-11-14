import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
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
import { PERFORMANCE, WORLD, type QualityPreset } from '@/config/tunables';
import { WORLD_LOCAL } from './tunables';

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const domeFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunTint;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float s = max(dot(d, uSunDir), 0.0);
  // gradient, warmed towards the sun azimuth near the horizon (07:00 morning light)
  float up = smoothstep(0.0, 0.6, d.y);
  vec3 horizon = mix(uHorizon, uSunTint, pow(s, 3.0) * 0.75);
  vec3 col = mix(horizon, uZenith, up);
  // slow drifting cloud layer, lit from the sun side
  if (d.y > 0.02) {
    vec2 uv = d.xz / (d.y + 0.18) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = smoothstep(0.52, 0.86, fbm(uv));
    float fade = smoothstep(0.02, 0.22, d.y);
    vec3 cloud = mix(vec3(0.78, 0.80, 0.84), uSunTint * 1.25 + 0.2, pow(s, 2.0) * 0.8 + 0.15);
    col = mix(col, cloud, c * fade * 0.75);
  }
  // sun disc and glow
  col += uSunTint * (pow(s, 18.0) * 0.45 + pow(s, 900.0) * 2.2);
  // below the horizon: ground bounce colour (only matters for the reflection probe)
  col = mix(uGround, col, smoothstep(-0.12, 0.0, d.y));
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
  /** Prefiltered sky reflection used as `scene.environment` (metal and wet surfaces). */
  environment: Texture | null;
  /** Advances the cloud drift. */
  update(dt: number): void;
  setQuality(preset: QualityPreset): void;
}

/** Direction pointing TOWARDS the sun for azimuth clockwise from north (-Z), +X east. */
function sunDirection(elevationDeg: number, azimuthDeg: number, out = new Vector3()): Vector3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** Morning sun (the only shadow caster), hemisphere fill, sky dome and fog (GDD 7.2, 13.6). */
export function createLighting(ctx: GameContext): Lighting {
  const sunDir = sunDirection(WORLD.sunElevationDeg, WORLD.sunAzimuthDeg);
  const fogColor = new Color(WORLD_LOCAL.sky.fog);

  const sun = new DirectionalLight(WORLD_LOCAL.sun.color, WORLD_LOCAL.sun.intensity);
  sun.name = 'sun';
  sun.target.position.set(0, 0, -10);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, WORLD_LOCAL.sun.distance);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  const h = WORLD_LOCAL.sun.frustumHalf;
  cam.left = -h;
  cam.right = h;
  cam.top = h;
  cam.bottom = -h;
  cam.near = 10;
  cam.far = WORLD_LOCAL.sun.distance * 2;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.18;
  sun.shadow.radius = 2.5;

  const hemi = new HemisphereLight(WORLD_LOCAL.hemi.sky, WORLD_LOCAL.hemi.ground, WORLD_LOCAL.hemi.intensity);
  hemi.name = 'harbor-hemisphere';

  const dome = new Mesh(
    new SphereGeometry(WORLD_LOCAL.sky.radius, 24, 12),
    new ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      uniforms: {
        uHorizon: { value: new Color(WORLD_LOCAL.sky.horizon) },
        uZenith: { value: new Color(WORLD_LOCAL.sky.zenith) },
        uGround: { value: new Color(WORLD_LOCAL.sky.ground) },
        uSunDir: { value: sunDir.clone() },
        uSunTint: { value: new Color(WORLD_LOCAL.sky.sunTint) },
        uTime: { value: 0 },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  dome.renderOrder = -10;

  ctx.scene.fog = new Fog(fogColor, WORLD.fogNear, WORLD.fogFar);
  ctx.scene.background = fogColor.clone();

  const setQuality = (preset: QualityPreset): void => {
    const size = PERFORMANCE.quality[preset].shadowMapSize;
    if (sun.shadow.mapSize.x === size && sun.shadow.map) return;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  };
  setQuality(ctx.settings.get('quality'));

  // Reflection probe: the sky dome alone, prefiltered once. Standard materials then pick up sky
  // reflections (painted steel, wet concrete) instead of looking like flat plastic.
  let environment: Texture | null = null;
  try {
    const pmrem = new PMREMGenerator(ctx.renderer.webgl);
    const probeScene = new Scene();
    const probeDome = new Mesh(dome.geometry, dome.material);
    probeScene.add(probeDome);
    environment = pmrem.fromScene(probeScene, 0, 1, WORLD_LOCAL.sky.radius * 2).texture;
    pmrem.dispose();
    ctx.scene.environment = environment;
    ctx.scene.environmentIntensity = WORLD_LOCAL.sky.environmentIntensity;
  } catch (error) {
    console.warn('[world] sky reflection probe unavailable:', error);
  }

  const domeUniforms = (dome.material as ShaderMaterial).uniforms;
  const update = (dt: number): void => {
    (domeUniforms.uTime as { value: number }).value += dt;
  };

  return { sun, hemi, dome, sunDir, fogColor, environment, update, setQuality };
}
