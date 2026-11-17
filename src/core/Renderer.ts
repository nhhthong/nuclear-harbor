import {
  ACESFilmicToneMapping,
  HalfFloatType,
  PCFShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type Scene,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CAMERA, PERFORMANCE, type QualityPreset } from '@/config/tunables';
import { ShadowScheduler, effectivePixelRatio, fogRange } from './quality';

/**
 * Final display-space pass: slight chromatic aberration towards the corners, a cool-shadow / warm-
 * highlight grade, vignette and animated film grain. Runs after tone mapping and sRGB encoding.
 */
// Guard before the bloom: one NaN or infinite pixel (a shader corner case on some GPU) would be blurred
// over the whole frame by the bloom mip chain and turn the screen black.
const SANITIZE_SHADER = {
  name: 'SanitizeShader',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bvec3 bad = bvec3(isnan(c.r) || isinf(c.r), isnan(c.g) || isinf(c.g), isnan(c.b) || isinf(c.b));
      vec3 rgb = vec3(bad.r ? 0.0 : c.r, bad.g ? 0.0 : c.g, bad.b ? 0.0 : c.b);
      gl_FragColor = vec4(clamp(rgb, 0.0, 48.0), 1.0);
    }`,
};

const GRADE_SHADER = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.4 },
    uGrain: { value: 0.03 },
    uAberration: { value: 0.0015 },
    uDesat: { value: 0.35 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uDesat;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uAberration * 8.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // grade: cold and drained. Desaturate, shadows towards blue-green, highlights towards cold grey,
      // crushed blacks; saturated warm lamps keep a little of their colour so they read as the only warmth
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float warm = clamp((col.r - col.b) * 2.0, 0.0, 1.0) * smoothstep(0.5, 0.9, luma);
      col = mix(col, vec3(luma), uDesat * (1.0 - warm * 0.7));
      col = mix(col, col * vec3(0.84, 0.97, 1.12), (1.0 - smoothstep(0.0, 0.5, luma)) * 0.7);
      col = mix(col, col * vec3(0.95, 1.0, 1.06), smoothstep(0.4, 1.0, luma) * 0.5 * (1.0 - warm));
      col = max(col - 0.015, 0.0) * 1.03;
      col = (col - 0.5) * 1.1 + 0.5;
      col *= 1.0 - uVignette * smoothstep(0.12, 0.75, r2 * 2.0);
      float n = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      col += n * uGrain * (1.0 - 0.6 * luma);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

/**
 * Owns the WebGLRenderer and the main camera. Feature modules never create renderers; they use
 * `ctx.renderer.webgl` only for diagnostics (`info`) and capabilities.
 */
export class Renderer {
  readonly webgl: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  private quality: QualityPreset = 'medium';
  private resizeObserver: ResizeObserver | null = null;
  private readonly shadowScheduler = new ShadowScheduler();
  private lastRenderMs = 0;
  /** Bloom chain, built lazily for the presets that enable it (and rebuilt when the scene changes). */
  private composer: EffectComposer | null = null;
  private composerScene: Scene | null = null;
  private bloomEnabled = false;
  private bloomFailed = false;
  private aoEnabled = false;
  private gradePass: ShaderPass | null = null;
  private gradeTime = 0;
  /**
   * Called at the start of every frame, before the main scene render (after the per-frame counter
   * reset): extra passes such as the ground's planar reflection register here.
   */
  readonly preRender: Array<() => void> = [];
  /** Set by Game: true while moving casters exist (playing); drives the low-rate shadow refresh. */
  shadowDynamicActive = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = PERFORMANCE.grade.exposure;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = PCFShadowMap;
    // Several passes render per frame when bloom is on: reset the counters once per frame ourselves
    // so `info.render.calls` stays the per-frame total the perf monitor expects.
    this.webgl.info.autoReset = false;
    // REVIEW #4 / GDD 13.6: the shadow map is NOT re-rendered every frame. `render()` asks the
    // ShadowScheduler: once after the world is ready or the quality changes, then at the preset's
    // low dynamic rate while moving casters exist.
    this.webgl.shadowMap.autoUpdate = false;

    this.camera = new PerspectiveCamera(CAMERA.fovDeg, 1, CAMERA.near, CAMERA.far);
    this.camera.rotation.order = 'YXZ';

    this.applyQuality(this.quality);
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', this.resize);
  }

  applyQuality(preset: QualityPreset): void {
    this.quality = preset;
    const q = PERFORMANCE.quality[preset];
    this.webgl.setPixelRatio(effectivePixelRatio(window.devicePixelRatio, q.pixelRatioCap));
    this.webgl.shadowMap.enabled = q.shadows;
    this.shadowScheduler.hz = q.dynamicShadowHz;
    this.bloomEnabled = q.bloom && !this.bloomFailed;
    if (!this.bloomEnabled || this.aoEnabled !== q.ao) this.disposeComposer();
    this.aoEnabled = q.ao;
    this.shadowScheduler.markDirty();
    this.camera.far = q.viewDistance;
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  /** Fog range for the current preset (view distance based). */
  get fogRange(): { near: number; far: number } {
    const q = PERFORMANCE.quality[this.quality];
    return fogRange(q.viewDistance, q.fogFraction);
  }

  /** Re-render the sun shadow once on the next frame (world built or changed). */
  markShadowsDirty(): void {
    this.shadowScheduler.markDirty();
  }

  get qualityPreset(): QualityPreset {
    return this.quality;
  }

  readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.webgl.setSize(width, height, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.webgl.getPixelRatio());
      this.composer.setSize(width, height);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  render(scene: Scene): void {
    const now = performance.now();
    const dt = this.lastRenderMs === 0 ? 0 : Math.min((now - this.lastRenderMs) / 1000, 0.25);
    this.lastRenderMs = now;
    if (this.webgl.shadowMap.enabled && this.shadowScheduler.frame(dt, this.shadowDynamicActive)) {
      this.webgl.shadowMap.needsUpdate = true;
    }
    this.webgl.info.reset();
    for (const hook of this.preRender) hook();
    if (this.gradePass) {
      this.gradeTime += dt;
      (this.gradePass.uniforms.uTime as { value: number }).value = this.gradeTime;
    }
    if (this.bloomEnabled) {
      const composer = this.ensureComposer(scene);
      if (composer) {
        composer.render(dt);
        return;
      }
    }
    this.webgl.render(scene, this.camera);
  }

  /** HDR scene pass (MSAA) -> bloom -> tone mapping + sRGB. Falls back to the plain path on failure. */
  private ensureComposer(scene: Scene): EffectComposer | null {
    if (this.composer && this.composerScene === scene) return this.composer;
    this.disposeComposer();
    try {
      const size = this.webgl.getDrawingBufferSize(new Vector2());
      const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: PERFORMANCE.bloom.msaaSamples });
      const composer = new EffectComposer(this.webgl, target);
      composer.addPass(new RenderPass(scene, this.camera));
      if (this.aoEnabled) {
        const ao = new GTAOPass(scene, this.camera, size.x, size.y);
        ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.25, samples: 12 });
        composer.addPass(ao);
      }
      const b = PERFORMANCE.bloom;
      composer.addPass(new ShaderPass(SANITIZE_SHADER));
      composer.addPass(new UnrealBloomPass(new Vector2(size.x, size.y), b.strength, b.radius, b.threshold));
      composer.addPass(new OutputPass());
      this.gradePass = new ShaderPass(GRADE_SHADER);
      const g = PERFORMANCE.grade;
      (this.gradePass.uniforms.uVignette as { value: number }).value = g.vignette;
      (this.gradePass.uniforms.uGrain as { value: number }).value = g.grain;
      (this.gradePass.uniforms.uAberration as { value: number }).value = g.aberration;
      (this.gradePass.uniforms.uDesat as { value: number }).value = g.desaturate;
      composer.addPass(this.gradePass);
      this.composer = composer;
      this.composerScene = scene;
      this.resize();
      return composer;
    } catch (error) {
      console.warn('[renderer] bloom unavailable, using the plain render path:', error);
      this.bloomFailed = true;
      this.bloomEnabled = false;
      this.disposeComposer();
      return null;
    }
  }

  private disposeComposer(): void {
    if (!this.composer) return;
    for (const pass of this.composer.passes) pass.dispose?.();
    this.composer.dispose();
    this.composer = null;
    this.composerScene = null;
    this.gradePass = null;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.disposeComposer();
    this.webgl.dispose();
  }
}
