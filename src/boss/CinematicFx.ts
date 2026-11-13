import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { CinematicFrame } from './cinematic';
import { BOSS_LOCAL } from './tunables';

const STREAKS = 28;
const m4 = new Matrix4();
const q = new Quaternion();
const pos = new Vector3();
const scl = new Vector3();

/**
 * Presentation of the landing cinematic: DOM letterbox bars, title card and skip hint, plus the
 * 3D descent effects (speed streaks, trail cone, glow) and the impact shockwave ring. Four draw
 * calls while visible, none otherwise. Driven by `update(frame, ...)`; owns no timing.
 */
export class CinematicFx {
  private readonly group = new Group();
  private readonly streaks: InstancedMesh;
  private readonly trail: Mesh;
  private readonly glow: Sprite;
  private readonly ring: Mesh;
  private readonly ringMat: MeshBasicMaterial;
  private readonly overlay: HTMLDivElement;
  private readonly barTop: HTMLDivElement;
  private readonly barBottom: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly angles: number[] = [];
  private readonly radii: number[] = [];
  private readonly lens: number[] = [];
  private shockLife = -1;
  /** Shockwave ring max radius in metres for this scale. */
  private readonly shockR: number;

  constructor(
    res: ResourceTracker,
    scene: Scene,
    uiRoot: HTMLElement,
    private readonly scale: number,
  ) {
    this.shockR = BOSS_LOCAL.cinematic.shockwaveRadius * scale;
    const additive = { blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false } as const;
    const streakMat = new MeshBasicMaterial({ color: 0xffc080, opacity: 0.55, ...additive });
    this.streaks = new InstancedMesh(new BoxGeometry(1, 1, 1), streakMat, STREAKS);
    this.streaks.frustumCulled = false;
    for (let i = 0; i < STREAKS; i++) {
      this.angles.push((i / STREAKS) * Math.PI * 2 + (i % 3) * 0.37);
      this.radii.push((5 + ((i * 7) % 11)) * scale);
      this.lens.push(0.45 + ((i * 5) % 7) / 7);
    }
    this.trail = new Mesh(new ConeGeometry(1, 1, 20, 1, true), new MeshBasicMaterial({ color: 0xff8a30, opacity: 0.28, side: DoubleSide, ...additive }));
    this.trail.frustumCulled = false;

    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,240,200,1)');
      grad.addColorStop(0.25, 'rgba(255,150,60,0.75)');
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    this.glow = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), ...additive }));
    this.glow.frustumCulled = false;

    this.ringMat = new MeshBasicMaterial({ color: 0xffb060, opacity: 0, side: DoubleSide, ...additive });
    this.ring = new Mesh(new RingGeometry(0.9, 1, 72), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.frustumCulled = false;
    this.ring.visible = false;

    this.group.add(this.streaks, this.trail, this.glow, this.ring);
    this.streaks.visible = false;
    this.trail.visible = false;
    this.glow.visible = false;
    scene.add(this.group);
    res.track(this.group);

    // DOM
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:60;display:none;overflow:hidden';
    const bar = (side: 'top' | 'bottom'): HTMLDivElement => {
      const b = document.createElement('div');
      b.style.cssText = `position:absolute;left:0;right:0;${side}:0;height:0;background:#000`;
      root.appendChild(b);
      return b;
    };
    this.barTop = bar('top');
    this.barBottom = bar('bottom');
    this.title = document.createElement('div');
    this.title.style.cssText =
      'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;opacity:0;color:#f4f4f6;font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;letter-spacing:0.35em;text-shadow:0 0 24px #e02020,0 0 3px #000';
    this.title.innerHTML =
      '<div style="font-size:clamp(12px,1.8vw,20px);letter-spacing:0.6em;color:#ff9d40;margin-bottom:0.6em">FINAL BOSS</div><div style="font-size:clamp(34px,7vw,92px)">TITAN-04</div>';
    root.appendChild(this.title);
    this.hint = document.createElement('div');
    this.hint.style.cssText = 'position:absolute;right:3vw;bottom:1.5vh;color:#ddd;font:600 13px/1 system-ui,sans-serif;letter-spacing:0.12em;opacity:0';
    this.hint.textContent = '[E] SKIP';
    root.appendChild(this.hint);
    this.overlay = root;
    uiRoot.appendChild(root);
  }

  get drawCalls(): number {
    return (this.streaks.visible ? 1 : 0) + (this.trail.visible ? 1 : 0) + (this.glow.visible ? 1 : 0) + (this.ring.visible ? 1 : 0);
  }

  /** Start the impact shockwave ring at a ground point. */
  startShock(x: number, z: number): void {
    this.shockLife = 0;
    this.ring.position.set(x, 0.4, z);
    this.ring.visible = true;
  }

  /** Per rendered frame. `active` = cinematic running (bars, title, descent effects). */
  update(f: CinematicFrame | null, bossX: number, bossY: number, bossZ: number, dt: number, canSkip: boolean): void {
    const s = this.scale;
    if (f) {
      this.overlay.style.display = 'block';
      const h = `${(f.bars * BOSS_LOCAL.cinematic.barsFraction * 100).toFixed(2)}vh`;
      this.barTop.style.height = h;
      this.barBottom.style.height = h;
      this.title.style.opacity = String(f.title);
      this.hint.style.opacity = canSkip && f.stage !== 'release' ? '0.85' : '0';
      const falling = f.speed > 0 || f.stage === 'sky';
      const top = bossY + BOSS_LOCAL.bodyCenterY * s + 9 * s;
      this.glow.visible = falling;
      this.trail.visible = f.speed > 0.02;
      this.streaks.visible = f.speed > 0.02;
      if (falling) {
        this.glow.position.set(bossX, bossY + BOSS_LOCAL.bodyCenterY * s, bossZ);
        this.glow.scale.setScalar((26 + f.speed * 60) * s);
        const len = (10 + f.speed * 190) * s;
        this.trail.position.set(bossX, top + len / 2, bossZ);
        this.trail.scale.set(11 * s, len, 11 * s);
        for (let i = 0; i < STREAKS; i++) {
          const a = this.angles[i] ?? 0;
          const r = this.radii[i] ?? 5;
          const L = len * (this.lens[i] ?? 1) * 1.2;
          pos.set(bossX + Math.cos(a) * r, bossY + BOSS_LOCAL.bodyCenterY * s + L / 2 - 4 * s, bossZ + Math.sin(a) * r);
          q.identity();
          scl.set(0.18 * s + 0.05, L, 0.18 * s + 0.05);
          m4.compose(pos, q, scl);
          this.streaks.setMatrixAt(i, m4);
        }
        this.streaks.instanceMatrix.needsUpdate = true;
      }
    } else {
      this.overlay.style.display = 'none';
      this.glow.visible = false;
      this.trail.visible = false;
      this.streaks.visible = false;
    }
    if (this.shockLife >= 0) {
      this.shockLife += dt / BOSS_LOCAL.cinematic.shockwaveSeconds;
      const k = Math.min(1, this.shockLife);
      const e = 1 - (1 - k) * (1 - k);
      this.ring.scale.setScalar(Math.max(0.1, this.shockR * e));
      this.ringMat.opacity = 0.9 * (1 - k) * (1 - k);
      if (this.shockLife >= 1) {
        this.shockLife = -1;
        this.ring.visible = false;
      }
    }
  }

  dispose(): void {
    this.overlay.remove();
    this.group.removeFromParent();
  }
}
