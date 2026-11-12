import { ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, SRGBColorSpace, WebGLRenderer, type Scene } from 'three';
import { CAMERA, PERFORMANCE, type QualityPreset } from '@/config/tunables';

/**
 * Owns the WebGLRenderer and the main camera. Feature modules never create renderers; they use
 * `ctx.renderer.webgl` only for diagnostics (`info`) and capabilities.
 */
export class Renderer {
  readonly webgl: WebGLRenderer;
  readonly camera: PerspectiveCamera;
  private quality: QualityPreset = 'medium';
  private resizeObserver: ResizeObserver | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.webgl = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.outputColorSpace = SRGBColorSpace;
    this.webgl.toneMapping = ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.0;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = PCFSoftShadowMap;
    // REVIEW #4: static shadows are rendered once; whoever owns the sun light sets
    // `shadowMap.needsUpdate = true` when the static world changes (T-03 / T-17).
    this.webgl.shadowMap.autoUpdate = true;

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
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatioCap));
    this.webgl.shadowMap.enabled = q.shadows;
    this.camera.far = q.viewDistance;
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  get qualityPreset(): QualityPreset {
    return this.quality;
  }

  readonly resize = (): void => {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.webgl.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  render(scene: Scene): void {
    this.webgl.render(scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.webgl.dispose();
  }
}
