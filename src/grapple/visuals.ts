import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { GRAPPLE } from '@/config/tunables';
import type { Vec3Like } from './GrappleState';
import { GRAPPLE_LOCAL } from './tunables';

const UP = new Vector3(0, 1, 0);
const hand = new Vector3();
const dir = new Vector3();
const mid = new Vector3();
const quat = new Quaternion();

/**
 * Hook head, cable and the crosshair indicator. Everything is created once and tracked by the
 * module's ResourceTracker scope; update() allocates nothing.
 */
export class GrappleVisuals {
  private readonly hook: Mesh;
  private readonly cable: Mesh;
  private readonly indicator: HTMLElement;
  private readonly hookPos = new Vector3();
  private readonly target = new Vector3();
  private active = false;
  private landed = false;
  private indicatorState: 'off' | 'valid' | 'invalid' = 'off';

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    uiRoot: HTMLElement,
    res: ResourceTracker,
  ) {
    const material = new MeshBasicMaterial({ color: 0xffd23a });
    const s = GRAPPLE_LOCAL.hookSize;
    this.hook = res.track(new Mesh(new BoxGeometry(s, s, s * 1.8), material));
    this.cable = res.track(
      new Mesh(new CylinderGeometry(GRAPPLE_LOCAL.cableRadius, GRAPPLE_LOCAL.cableRadius, 1, 5), material),
    );
    for (const m of [this.hook, this.cable]) {
      m.visible = false;
      m.frustumCulled = false;
      m.castShadow = false;
      this.scene.add(m);
    }
    res.onDispose(() => {
      this.scene.remove(this.hook, this.cable);
      this.indicator.remove();
    });

    const size = GRAPPLE_LOCAL.indicatorSize;
    this.indicator = document.createElement('div');
    this.indicator.className = 'grapple-indicator';
    const st = this.indicator.style;
    st.position = 'absolute';
    st.left = '50%';
    st.top = '50%';
    st.width = `${size}px`;
    st.height = `${size}px`;
    st.marginLeft = `${-size / 2}px`;
    st.marginTop = `${-size / 2}px`;
    st.border = '2px solid #ffd23a';
    st.borderRadius = '50%';
    st.boxSizing = 'border-box';
    st.pointerEvents = 'none';
    st.opacity = '0';
    st.transition = 'opacity 80ms linear';
    uiRoot.appendChild(this.indicator);
  }

  /** The hook is fired towards `point`; it flies from the hand until it lands. */
  show(point: Vec3Like): void {
    this.target.set(point.x, point.y, point.z);
    this.handPosition(this.hookPos);
    this.active = true;
    this.landed = false;
    this.hook.visible = true;
    this.cable.visible = true;
    this.pose();
  }

  hide(): void {
    this.active = false;
    this.hook.visible = false;
    this.cable.visible = false;
  }

  update(dt: number): void {
    if (!this.active) return;
    if (!this.landed) {
      dir.subVectors(this.target, this.hookPos);
      const dist = dir.length();
      const step = GRAPPLE.hookTravelSpeed * dt;
      if (dist <= step) {
        this.hookPos.copy(this.target);
        this.landed = true;
      } else {
        this.hookPos.addScaledVector(dir, step / dist);
      }
    }
    this.pose();
  }

  setIndicator(state: 'off' | 'valid' | 'invalid'): void {
    if (state === this.indicatorState) return;
    this.indicatorState = state;
    const st = this.indicator.style;
    st.opacity = state === 'off' ? '0' : state === 'valid' ? '0.95' : '0.35';
    st.borderColor = state === 'valid' ? '#7dff6a' : '#ffffff';
  }

  private handPosition(out: Vector3): Vector3 {
    this.camera.updateMatrixWorld();
    const o = GRAPPLE_LOCAL.handOffset;
    return this.camera.localToWorld(out.set(o.x, o.y, o.z));
  }

  private pose(): void {
    this.handPosition(hand);
    dir.subVectors(this.hookPos, hand);
    const length = dir.length();
    this.hook.position.copy(this.hookPos);
    if (length > 1e-4) {
      dir.multiplyScalar(1 / length);
      quat.setFromUnitVectors(UP, dir);
      this.cable.quaternion.copy(quat);
      mid.addVectors(hand, this.hookPos).multiplyScalar(0.5);
      this.cable.position.copy(mid);
      this.cable.scale.set(1, length, 1);
      this.hook.quaternion.copy(quat).multiply(Q_TO_Z);
    }
  }
}

/** Rotates a Z-long box so it points along the cable (cable axis is local +Y after quat). */
const Q_TO_Z = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), UP);
