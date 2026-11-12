import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments, type Scene } from 'three';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { DEBUG_TUNABLES } from './tunables';

/** Collider wireframes in one LineSegments with a reused, growable position/colour buffer. */
export class ColliderView {
  private geometry = new BufferGeometry();
  private readonly material = new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8 });
  private readonly lines: LineSegments;
  private positions = new Float32Array(DEBUG_TUNABLES.colliderInitialFloats);
  private colors = new Float32Array(DEBUG_TUNABLES.colliderInitialFloats);
  private posAttr: BufferAttribute;
  private colAttr: BufferAttribute;
  private lastRefresh = -Infinity;
  private enabled = false;
  /** Number of line segments currently drawn. */
  segments = 0;

  constructor(
    private readonly scene: Scene,
    private readonly physics: PhysicsWorld,
  ) {
    this.posAttr = new BufferAttribute(this.positions, 3);
    this.colAttr = new BufferAttribute(this.colors, 3);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colAttr);
    this.geometry.setDrawRange(0, 0);
    this.lines = new LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
    this.lines.visible = false;
    this.lines.name = 'debug-colliders';
    scene.add(this.lines);
  }

  get object(): LineSegments {
    return this.lines;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.lines.visible = value;
    this.lastRefresh = -Infinity;
  }

  /** Rebuild at `colliderRefreshHz`; no-op when disabled. */
  update(nowMs: number): void {
    if (!this.enabled) return;
    if (nowMs - this.lastRefresh < 1000 / DEBUG_TUNABLES.colliderRefreshHz) return;
    this.lastRefresh = nowMs;
    let floats = this.append(0, false, DEBUG_TUNABLES.colliderColor);
    floats = this.append(floats, true, DEBUG_TUNABLES.grappleColor);
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, floats / 3);
    this.segments = floats / 6;
  }

  /** Append one pass (grappleable or not) of Rapier's debug lines; returns the new float count. */
  private append(offset: number, grappleable: boolean, color: readonly [number, number, number]): number {
    const buffers = this.physics.world.debugRender(undefined, (collider) => (this.physics.getMeta(collider).grappleable === true) === grappleable);
    const verts = buffers.vertices;
    this.ensure(offset + verts.length);
    this.positions.set(verts, offset);
    for (let i = offset; i < offset + verts.length; i += 3) {
      this.colors[i] = color[0];
      this.colors[i + 1] = color[1];
      this.colors[i + 2] = color[2];
    }
    return offset + verts.length;
  }

  private ensure(floats: number): void {
    if (floats <= this.positions.length) return;
    let size = this.positions.length;
    while (size < floats) size *= 2;
    const positions = new Float32Array(size);
    const colors = new Float32Array(size);
    positions.set(this.positions);
    colors.set(this.colors);
    this.positions = positions;
    this.colors = colors;
    this.posAttr = new BufferAttribute(positions, 3);
    this.colAttr = new BufferAttribute(colors, 3);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colAttr);
  }

  dispose(): void {
    this.scene.remove(this.lines);
    this.geometry.dispose();
    this.material.dispose();
  }
}
