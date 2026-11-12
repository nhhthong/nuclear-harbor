import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type Scene,
  type Texture,
} from 'three';
import { WEAPON } from '@/config/tunables';
import type { QualityPreset } from '@/config/tunables';
import { ParticleEmitter } from './emitter';
import { ParticleBuffer } from './ParticleBuffer';
import { RECIPES, type BlendLayer, type RecipeId } from './recipes';
import { VFX } from './tunables';

const VERTEX = /* glsl */ `
attribute float aSize;
attribute vec4 aColor;
uniform float uScale;
uniform float uMaxPx;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(uMaxPx, aSize * uScale / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
varying vec4 vColor;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}`;

/** One THREE.Points (= one draw call) fed from a ParticleBuffer. */
class PointsLayer {
  readonly points: Points;
  readonly material: ShaderMaterial;
  private readonly geometry = new BufferGeometry();
  private readonly position: BufferAttribute;
  private readonly size: BufferAttribute;
  private readonly color: BufferAttribute;

  constructor(
    private readonly buffer: ParticleBuffer,
    map: Texture,
    blend: BlendLayer,
  ) {
    const cap = buffer.capacity;
    this.position = new BufferAttribute(new Float32Array(cap * 3), 3).setUsage(DynamicDrawUsage);
    this.size = new BufferAttribute(new Float32Array(cap), 1).setUsage(DynamicDrawUsage);
    this.color = new BufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('aSize', this.size);
    this.geometry.setAttribute('aColor', this.color);
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: 1 }, uMaxPx: { value: VFX.maxPointPixels } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: blend === 'add' ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = blend === 'add' ? 11 : 10;
  }

  setPixelScale(v: number): void {
    (this.material.uniforms.uScale as { value: number }).value = v;
  }

  sync(): void {
    const n = this.buffer.fill(this.position.array as Float32Array, this.size.array as Float32Array, this.color.array as Float32Array);
    this.geometry.setDrawRange(0, n);
    for (const attr of [this.position, this.size, this.color]) {
      attr.clearUpdateRanges();
      if (n > 0) attr.addUpdateRange(0, n * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const scratchMatrix = new Matrix4();
const scratchPos = new Vector3();
const scratchScale = new Vector3();
const scratchQuat = new Quaternion();
const scratchColor = new Color();
const UP = new Vector3(0, 0, 1);
const IDENTITY_Q = new Quaternion();

function makeSpriteTexture(): CanvasTexture {
  const s = VFX.spriteSize;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const g = canvas.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }
  return new CanvasTexture(canvas);
}

/**
 * All rendering state of the VFX module: two particle draw calls, a ring InstancedMesh, a decal
 * InstancedMesh and pooled flash lights. Everything is allocated in the constructor.
 */
export class VfxSystem {
  readonly emitter: ParticleEmitter;
  private readonly sprite: CanvasTexture;
  private readonly addLayer: PointsLayer;
  private readonly alphaLayer: PointsLayer;
  private readonly ringMesh: InstancedMesh;
  private readonly ringGeo: RingGeometry;
  private readonly ringMat: MeshBasicMaterial;
  private readonly ringState = new Float32Array(VFX.maxRings * 9); // x y z radius age duration r g b
  private readonly ringLive = new Uint8Array(VFX.maxRings);
  private readonly decalMesh: InstancedMesh;
  private readonly decalGeo: PlaneGeometry;
  private readonly decalMat: MeshBasicMaterial;
  private decalCount = 0;
  private decalNext = 0;
  private readonly lights: PointLight[] = [];
  private readonly lightAge = new Float32Array(VFX.maxLights);
  private readonly lightDur = new Float32Array(VFX.maxLights);
  private readonly lightPeak = new Float32Array(VFX.maxLights);
  private lightsEnabled = true;
  private readonly camera: PerspectiveCamera | null;

  constructor(
    private readonly scene: Scene,
    camera: unknown,
    private readonly canvas: HTMLCanvasElement,
    quality: QualityPreset,
  ) {
    this.camera = camera instanceof PerspectiveCamera ? camera : null;
    this.emitter = new ParticleEmitter(new ParticleBuffer(VFX.maxCapacity), new ParticleBuffer(VFX.maxCapacity));
    this.sprite = makeSpriteTexture();
    this.addLayer = new PointsLayer(this.emitter.additive, this.sprite, 'add');
    this.alphaLayer = new PointsLayer(this.emitter.alpha, this.sprite, 'alpha');
    scene.add(this.addLayer.points, this.alphaLayer.points);

    // expanding rings (additive, faded through instance colour)
    this.ringGeo = new RingGeometry(0.88, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: AdditiveBlending });
    this.ringMesh = new InstancedMesh(this.ringGeo, this.ringMat, VFX.maxRings);
    this.ringMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 9;
    for (let i = 0; i < VFX.maxRings; i++) this.hideRing(i);
    this.ringMesh.setColorAt(0, scratchColor.setRGB(0, 0, 0));
    scene.add(this.ringMesh);

    // scorch decals (ring buffer, oldest recycled)
    const cap = WEAPON.maxImpactDecals;
    this.decalGeo = new PlaneGeometry(1, 1);
    this.decalMat = new MeshBasicMaterial({
      map: this.sprite,
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.decalMesh = new InstancedMesh(this.decalGeo, this.decalMat, cap);
    this.decalMesh.count = 0;
    this.decalMesh.frustumCulled = false;
    this.decalMesh.renderOrder = 8;
    scene.add(this.decalMesh);

    // pooled flash lights: always in the scene so the light count never changes (no recompiles)
    for (let i = 0; i < VFX.maxLights; i++) {
      const l = new PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      this.lights.push(l);
      scene.add(l);
    }
    this.setQuality(quality);
  }

  setQuality(q: QualityPreset): void {
    this.emitter.setBudget(VFX.budget[q]);
    this.lightsEnabled = q !== 'low';
    if (!this.lightsEnabled) for (const l of this.lights) l.intensity = 0;
  }

  get liveParticles(): number {
    return this.emitter.live;
  }

  get liveEmitters(): number {
    let n = 0;
    for (let i = 0; i < VFX.maxRings; i++) n += this.ringLive[i] as number;
    for (let i = 0; i < VFX.maxLights; i++) if ((this.lights[i] as PointLight).intensity > 0) n++;
    return n;
  }

  get dropped(): number {
    return this.emitter.dropped;
  }

  get capacity(): number {
    return this.emitter.capacity;
  }

  /** Spawns a recipe: particles plus the optional flash light and ring. */
  spawn(id: RecipeId, x: number, y: number, z: number, nx: number, ny: number, nz: number, scale: number, duration?: number): void {
    const recipe = RECIPES[id];
    this.emitter.emit(id, x, y, z, nx, ny, nz, scale);
    if (recipe.flash && this.lightsEnabled) this.flash(recipe.flash.color, recipe.flash.intensity * scale, recipe.flash.range * Math.sqrt(scale), recipe.flash.duration, x, y, z);
    if (recipe.ring) {
      const dur = recipe.ring.useRequestDuration ? (duration ?? VFX.defaultRingDuration) : recipe.ring.duration;
      this.ring(x, y, z, recipe.ring.radius * scale, dur, recipe.ring.color);
    }
  }

  private flash(color: number, intensity: number, range: number, duration: number, x: number, y: number, z: number): void {
    // reuse the oldest (or an idle) light
    let pick = 0;
    let best = -1;
    for (let i = 0; i < VFX.maxLights; i++) {
      const l = this.lights[i] as PointLight;
      const idle = l.intensity <= 0;
      const age = idle ? Infinity : (this.lightAge[i] as number);
      if (age > best) {
        best = age;
        pick = i;
      }
    }
    const l = this.lights[pick] as PointLight;
    l.color.setHex(color);
    l.distance = range;
    l.position.set(x, y, z);
    l.intensity = intensity;
    this.lightPeak[pick] = intensity;
    this.lightAge[pick] = 0;
    this.lightDur[pick] = duration;
  }

  private ring(x: number, y: number, z: number, radius: number, duration: number, color: number): void {
    let slot = -1;
    let oldest = -1;
    let oldestAge = -1;
    for (let i = 0; i < VFX.maxRings; i++) {
      if (!this.ringLive[i]) {
        slot = i;
        break;
      }
      const age = this.ringState[i * 9 + 4] as number;
      if (age > oldestAge) {
        oldestAge = age;
        oldest = i;
      }
    }
    if (slot < 0) slot = oldest;
    const s = slot * 9;
    this.ringLive[slot] = 1;
    this.ringState[s] = x;
    this.ringState[s + 1] = y;
    this.ringState[s + 2] = z;
    this.ringState[s + 3] = radius;
    this.ringState[s + 4] = 0;
    this.ringState[s + 5] = Math.max(0.05, duration);
    scratchColor.setHex(color);
    this.ringState[s + 6] = scratchColor.r;
    this.ringState[s + 7] = scratchColor.g;
    this.ringState[s + 8] = scratchColor.b;
  }

  private hideRing(i: number): void {
    scratchMatrix.makeScale(0, 0, 0);
    this.ringMesh.setMatrixAt(i, scratchMatrix);
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  /** Dark scorch mark flat on a surface; oldest is recycled when the cap is reached. */
  addDecal(x: number, y: number, z: number, nx: number, ny: number, nz: number, scale = 1): void {
    const cap = WEAPON.maxImpactDecals;
    const i = this.decalNext;
    this.decalNext = (this.decalNext + 1) % cap;
    this.decalCount = Math.min(cap, this.decalCount + 1);
    scratchPos.set(x + nx * VFX.decalOffset, y + ny * VFX.decalOffset, z + nz * VFX.decalOffset);
    scratchQuat.setFromUnitVectors(UP, scratchNormal.set(nx, ny, nz));
    const size = VFX.decalSize * scale;
    scratchScale.set(size, size, size);
    scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
    this.decalMesh.setMatrixAt(i, scratchMatrix);
    this.decalMesh.count = this.decalCount;
    this.decalMesh.instanceMatrix.needsUpdate = true;
  }

  get decals(): number {
    return this.decalCount;
  }

  update(dt: number): void {
    this.emitter.step(dt);

    // rings
    let ringDirty = false;
    for (let i = 0; i < VFX.maxRings; i++) {
      if (!this.ringLive[i]) continue;
      const s = i * 9;
      const age = (this.ringState[s + 4] as number) + dt;
      const dur = this.ringState[s + 5] as number;
      ringDirty = true;
      if (age >= dur) {
        this.ringLive[i] = 0;
        this.hideRing(i);
        continue;
      }
      this.ringState[s + 4] = age;
      const t = age / dur;
      const r = (this.ringState[s + 3] as number) * (VFX.ringStartFraction + (1 - VFX.ringStartFraction) * t);
      scratchPos.set(this.ringState[s] as number, this.ringState[s + 1] as number, this.ringState[s + 2] as number);
      scratchScale.set(r, 1, r);
      scratchMatrix.compose(scratchPos, IDENTITY_Q, scratchScale);
      this.ringMesh.setMatrixAt(i, scratchMatrix);
      const fade = 1 - t;
      scratchColor.setRGB((this.ringState[s + 6] as number) * fade, (this.ringState[s + 7] as number) * fade, (this.ringState[s + 8] as number) * fade);
      this.ringMesh.setColorAt(i, scratchColor);
    }
    if (ringDirty) {
      this.ringMesh.instanceMatrix.needsUpdate = true;
      if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;
    }

    // lights
    for (let i = 0; i < VFX.maxLights; i++) {
      const l = this.lights[i] as PointLight;
      if (l.intensity <= 0) continue;
      const age = (this.lightAge[i] as number) + dt;
      this.lightAge[i] = age;
      const t = age / (this.lightDur[i] as number);
      l.intensity = t >= 1 ? 0 : (this.lightPeak[i] as number) * (1 - t) * (1 - t);
    }

    // particle uniforms and attributes
    if (this.camera) {
      const scale = this.canvas.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
      this.addLayer.setPixelScale(scale);
      this.alphaLayer.setPixelScale(scale);
    }
    this.addLayer.sync();
    this.alphaLayer.sync();
  }

  dispose(): void {
    this.scene.remove(this.addLayer.points, this.alphaLayer.points, this.ringMesh, this.decalMesh, ...this.lights);
    for (const l of this.lights) l.dispose();
    this.addLayer.dispose();
    this.alphaLayer.dispose();
    this.ringMesh.dispose();
    this.ringGeo.dispose();
    this.ringMat.dispose();
    this.decalMesh.dispose();
    this.decalGeo.dispose();
    this.decalMat.dispose();
    this.sprite.dispose();
    this.emitter.clear();
  }
}

const scratchNormal = new Vector3();
