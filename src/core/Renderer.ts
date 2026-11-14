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
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CAMERA, PERFORMANCE, type QualityPreset } from '@/config/tunables';
import { ShadowScheduler, effectivePixelRatio, fogRange } from './quality';

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
  /** Set by Game: true while moving casters exist (playing); drives the low-rate shadow refresh. */
  shadowDynamicActive = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08;
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
    if (!this.bloomEnabled) this.disposeComposer();
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
      const b = PERFORMANCE.bloom;
      composer.addPass(new UnrealBloomPass(new Vector2(size.x, size.y), b.strength, b.radius, b.threshold));
      composer.addPass(new OutputPass());
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
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.disposeComposer();
    this.webgl.dispose();
  }
}
