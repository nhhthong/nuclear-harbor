import {
  BackSide,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
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

// Overcast night: dark gradient, a sodium city glow low in the south, slow cloud deck back-lit by the
// moon, the moon itself behind thin cloud, and a lightning term that lights the whole deck.
const domeFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uGround;
uniform vec3 uCity;
uniform vec3 uMoonDir;
uniform vec3 uMoonTint;
uniform float uTime;
uniform float uFlash;
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
  float up = smoothstep(-0.02, 0.55, d.y);
  vec3 col = mix(uHorizon, uZenith, up);
  // city glow: strongest towards +Z (south, behind the gate), hugging the horizon
  float south = smoothstep(-0.3, 0.9, d.z);
  col += uCity * south * pow(1.0 - clamp(d.y, 0.0, 1.0), 6.0) * 0.9;
  float m = max(dot(d, uMoonDir), 0.0);
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.22) * 1.3 + vec2(uTime * 0.006, uTime * 0.002);
    float deck = fbm(uv);
    float thick = smoothstep(0.32, 0.75, deck);
    float fade = smoothstep(0.0, 0.25, d.y);
    // cloud deck: dark bellies, moonlit rims, lit from inside by lightning
    vec3 cloud = mix(vec3(0.018, 0.022, 0.032), uMoonTint * 0.16, pow(m, 5.0) * (1.0 - thick * 0.6));
    cloud += uCity * 0.05 * south * (1.0 - up);
    cloud += vec3(0.55, 0.62, 0.8) * uFlash * (0.25 + 0.75 * smoothstep(0.35, 0.8, fbm(uv * 0.6 + 3.1)));
    col = mix(col, cloud, (0.55 + 0.45 * thick) * fade);
    // moon behind thin cloud
    col += uMoonTint * (pow(m, 60.0) * 0.5 + pow(m, 1400.0) * 5.0) * (1.0 - thick * 0.75);
  }
  col = mix(uGround, col, smoothstep(-0.1, 0.0, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Lighting {
  moon: DirectionalLight;
  hemi: HemisphereLight;
  dome: Mesh;
  moonDir: Vector3;
  fogColor: Color;
  /** Prefiltered sky reflection used as `scene.environment`. */
  environment: Texture | null;
  /** Advances clouds and lightning. Returns the current lightning flash (0..1). */
  update(dt: number): number;
  setQuality(preset: QualityPreset): void;
}

/** Direction pointing TOWARDS the light for azimuth clockwise from north (-Z), +X east. */
function skyDirection(elevationDeg: number, azimuthDeg: number, out = new Vector3()): Vector3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export interface ProbeLamp {
  x: number;
  y: number;
  z: number;
  color: number;
}

/**
 * Night lighting: moon (shadow caster for the whole level), hemisphere fill, overcast sky dome with
 * lightning, exponential fog and a reflection probe. `probeLamps` are rendered into the probe as
 * bright blobs so wet and metallic surfaces mirror the flood lights.
 */
export function createLighting(ctx: GameContext, probeLamps: readonly ProbeLamp[] = []): Lighting {
  const cfg = WORLD_LOCAL;
  const moonDir = skyDirection(cfg.moon.elevationDeg, cfg.moon.azimuthDeg);
  const fogColor = new Color(cfg.sky.fog);

  const moon = new DirectionalLight(cfg.moon.color, cfg.moon.intensity);
  moon.name = 'moon';
  moon.target.position.set(0, 0, -9);
  moon.position.copy(moon.target.position).addScaledVector(moonDir, cfg.moon.distance);
  moon.castShadow = true;
  const cam = moon.shadow.camera;
  const h = cfg.moon.frustumHalf;
  cam.left = -h;
  cam.right = h;
  cam.top = h;
  cam.bottom = -h;
  cam.near = 10;
  cam.far = cfg.moon.distance * 2;
  cam.updateProjectionMatrix();
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.12;
  moon.shadow.radius = 3;

  const hemi = new HemisphereLight(cfg.hemi.sky, cfg.hemi.ground, cfg.hemi.intensity);
  hemi.name = 'night-hemisphere';

  const uniforms = {
    uHorizon: { value: new Color(cfg.sky.horizon) },
    uZenith: { value: new Color(cfg.sky.zenith) },
    uGround: { value: new Color(cfg.sky.ground) },
    uCity: { value: new Color(cfg.sky.cityGlow) },
    uMoonDir: { value: moonDir.clone() },
    uMoonTint: { value: new Color(cfg.sky.moonTint) },
    uTime: { value: 0 },
    uFlash: { value: 0 },
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
    if (moon.shadow.mapSize.x === size && moon.shadow.map) return;
    moon.shadow.mapSize.set(size, size);
    moon.shadow.map?.dispose();
    moon.shadow.map = null;
  };
  setQuality(ctx.settings.get('quality'));

  let environment: Texture | null = null;
  try {
    const pmrem = new PMREMGenerator(ctx.renderer.webgl);
    const probeScene = new Scene();
    probeScene.add(new Mesh(dome.geometry, dome.material));
    const blob = new SphereGeometry(1, 12, 8);
    const mats: MeshBasicMaterial[] = [];
    for (const lamp of probeLamps) {
      const mat = new MeshBasicMaterial({ color: lamp.color });
      mat.color.multiplyScalar(60);
      mats.push(mat);
      const m = new Mesh(blob, mat);
      // probe is taken from the yard centre at eye height
      m.position.set(lamp.x, lamp.y - 1.7, lamp.z + 4);
      m.scale.setScalar(0.9);
      probeScene.add(m);
    }
    environment = pmrem.fromScene(probeScene, 0.02, 0.5, cfg.sky.radius * 2).texture;
    pmrem.dispose();
    blob.dispose();
    for (const m of mats) m.dispose();
    ctx.scene.environment = environment;
    ctx.scene.environmentIntensity = cfg.sky.environmentIntensity;
  } catch (error) {
    console.warn('[world] sky reflection probe unavailable:', error);
  }

  // ---- lightning ----
  const L = cfg.lightning;
  let nextStrike = L.minGap * 0.6;
  let flashT = -1;
  const baseHemi = cfg.hemi.intensity;
  const baseMoon = cfg.moon.intensity;
  const update = (dt: number): number => {
    uniforms.uTime.value += dt;
    nextStrike -= dt;
    if (nextStrike <= 0) {
      nextStrike = L.minGap + Math.random() * (L.maxGap - L.minGap);
      flashT = 0;
    }
    let flash = 0;
    if (flashT >= 0) {
      flashT += dt;
      const t = flashT / L.duration;
      // two quick pulses, the second weaker
      flash = t >= 1 ? 0 : Math.max(Math.exp(-t * 14), 0.7 * Math.exp(-Math.abs(t - 0.32) * 22));
      if (t >= 1) flashT = -1;
    }
    uniforms.uFlash.value = flash;
    hemi.intensity = baseHemi + flash * L.strength;
    moon.intensity = baseMoon + flash * L.strength * 0.8;
    return flash;
  };

  return { moon, hemi, dome, moonDir, fogColor, environment, update, setQuality };
}
