import { Color, DirectionalLight, Fog, HemisphereLight, Mesh, SphereGeometry, ShaderMaterial, Vector3, BackSide } from 'three';
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
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.65, d.y));
  float s = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0, 0.75, 0.45) * (pow(s, 24.0) * 0.35 + pow(s, 600.0) * 1.2);
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
  setQuality(preset: QualityPreset): void;
}

/** Direction pointing TOWARDS the sun for azimuth clockwise from north (-Z), +X east. */
export function sunDirection(elevationDeg: number, azimuthDeg: number, out = new Vector3()): Vector3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** Morning sun (the only shadow caster), hemisphere fill, sky dome and fog (GDD 7.2, 13.6). */
export function createLighting(ctx: GameContext): Lighting {
  const sunDir = sunDirection(WORLD.sunElevationDeg, WORLD.sunAzimuthDeg);
  const fogColor = new Color(WORLD_LOCAL.sky.horizon);

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
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;

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
        uSunDir: { value: sunDir.clone() },
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

  return { sun, hemi, dome, sunDir, fogColor, setQuality };
}
