import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Scene } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { BOSS } from '@/config/tunables';
import { ObjectPool } from '@/core/ObjectPool';
import { QueryGroups } from '@/physics/groups';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { BOSS_LOCAL } from './tunables';

export interface Marker {
  index: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  duration: number;
  /** Expand from the centre during the telegraph (ground slam ring). */
  grow: boolean;
}

export interface Shot {
  index: number;
  pos: Vector3;
  dir: Vector3;
  target: Vector3;
  speed: number;
}

export interface Missile {
  index: number;
  start: Vector3;
  end: Vector3;
  t: number;
  duration: number;
}

export type ExplodeKind = 'cannon' | 'missile';

export type ExplodeHandler = (point: Vector3, kind: ExplodeKind) => void;

const dummy = new Object3D();
const ZERO = new Matrix4().makeScale(0, 0, 0);
const tmp = new Vector3();

/** Instanced, pooled danger markers, cannon shots and missiles: three draw calls at most. */
export class BossProjectiles {
  private readonly markers: ObjectPool<Marker>;
  private readonly shots: ObjectPool<Shot>;
  private readonly missiles: ObjectPool<Missile>;
  private readonly markerMesh: InstancedMesh;
  private readonly shotMesh: InstancedMesh;
  private readonly missileMesh: InstancedMesh;
  private markerDirty = false;
  private shotDirty = false;
  private missileDirty = false;

  constructor(
    res: ResourceTracker,
    scene: Scene,
    private readonly physics: PhysicsWorld,
    private readonly scale: number,
  ) {
    const markerCap = BOSS_LOCAL.pools.markers;
    const shotCap = BOSS.maxProjectiles;
    const missileCap = BOSS_LOCAL.pools.missiles;

    this.markerMesh = this.makeMesh(
      new CircleGeometry(1, 40),
      new MeshBasicMaterial({
        color: 0xff2a1a,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      markerCap,
    );
    this.shotMesh = this.makeMesh(
      new SphereGeometry(0.9, 12, 8),
      new MeshBasicMaterial({ color: 0xffa040, blending: AdditiveBlending }),
      shotCap,
    );
    this.missileMesh = this.makeMesh(
      new SphereGeometry(0.55, 10, 8),
      new MeshBasicMaterial({ color: 0xff5a30 }),
      missileCap,
    );
    for (const m of [this.markerMesh, this.shotMesh, this.missileMesh]) {
      res.track(m);
      res.onDispose(() => m.dispose());
      scene.add(m);
    }

    let mi = 0;
    this.markers = new ObjectPool<Marker>({
      capacity: markerCap,
      create: () => ({ index: mi++, x: 0, y: 0, z: 0, radius: 1, age: 0, duration: 1, grow: false }),
      reset: (m) => {
        this.markerMesh.setMatrixAt(m.index, ZERO);
        this.markerDirty = true;
      },
    });
    let si = 0;
    this.shots = new ObjectPool<Shot>({
      capacity: shotCap,
      create: () => ({ index: si++, pos: new Vector3(), dir: new Vector3(), target: new Vector3(), speed: 0 }),
      reset: (s) => {
        this.shotMesh.setMatrixAt(s.index, ZERO);
        this.shotDirty = true;
      },
    });
    let qi = 0;
    this.missiles = new ObjectPool<Missile>({
      capacity: missileCap,
      create: () => ({ index: qi++, start: new Vector3(), end: new Vector3(), t: 0, duration: 1 }),
      reset: (m) => {
        this.missileMesh.setMatrixAt(m.index, ZERO);
        this.missileDirty = true;
      },
    });
    // hide every instance until used
    for (let i = 0; i < markerCap; i++) this.markerMesh.setMatrixAt(i, ZERO);
    for (let i = 0; i < shotCap; i++) this.shotMesh.setMatrixAt(i, ZERO);
    for (let i = 0; i < missileCap; i++) this.missileMesh.setMatrixAt(i, ZERO);
    res.onDispose(() => {
      this.markers.dispose();
      this.shots.dispose();
      this.missiles.dispose();
    });
  }

  private makeMesh(geo: CircleGeometry | SphereGeometry, mat: MeshBasicMaterial, count: number): InstancedMesh {
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.visible = false;
    return mesh;
  }

  get liveShots(): number {
    return this.shots.liveCount;
  }
  get liveMissiles(): number {
    return this.missiles.liveCount;
  }
  get liveMarkers(): number {
    return this.markers.liveCount;
  }
  get droppedShots(): number {
    return this.shots.droppedCount;
  }
  get droppedMissiles(): number {
    return this.missiles.droppedCount;
  }

  addMarker(x: number, y: number, z: number, radius: number, duration: number, grow: boolean): Marker | null {
    const m = this.markers.acquire();
    if (!m) return null;
    m.x = x;
    m.y = y;
    m.z = z;
    m.radius = radius;
    m.age = 0;
    m.duration = duration;
    m.grow = grow;
    return m;
  }

  fireShot(from: Vector3, to: Vector3, speed: number): boolean {
    const s = this.shots.acquire();
    if (!s) return false;
    s.pos.copy(from);
    s.target.copy(to);
    s.dir.copy(to).sub(from).normalize();
    s.speed = speed;
    return true;
  }

  fireMissile(from: Vector3, to: Vector3, duration: number): boolean {
    const m = this.missiles.acquire();
    if (!m) return false;
    m.start.copy(from);
    m.end.copy(to);
    m.t = 0;
    m.duration = duration;
    return true;
  }

  releaseAll(): void {
    this.markers.releaseAll();
    this.shots.releaseAll();
    this.missiles.releaseAll();
    this.syncVisibility();
  }

  /** Fixed-step motion; impacts are reported through `onExplode`. */
  fixedStep(dt: number, onExplode: ExplodeHandler): void {
    this.markers.forEachLive((m) => {
      m.age += dt;
    });
    if (this.markers.liveCount > 0) {
      for (const m of this.liveMarkerList()) if (m.age >= m.duration) this.markers.release(m);
    }

    if (this.shots.liveCount > 0) for (const s of this.liveShotList()) {
      const step = s.speed * dt;
      const remaining = tmp.copy(s.target).sub(s.pos).length();
      if (remaining <= step) {
        onExplode(s.target, 'cannon');
        this.shots.release(s);
        continue;
      }
      const hit = this.physics.raycast(s.pos, s.dir, step, { groups: QueryGroups.worldOnly });
      if (hit) {
        onExplode(hit.point, 'cannon');
        this.shots.release(s);
        continue;
      }
      s.pos.addScaledVector(s.dir, step);
      if (s.pos.y <= 0.1) {
        onExplode(s.pos, 'cannon');
        this.shots.release(s);
      }
    }

    if (this.missiles.liveCount > 0) for (const m of this.liveMissileList()) {
      m.t += dt / m.duration;
      if (m.t >= 1) {
        onExplode(m.end, 'missile');
        this.missiles.release(m);
      }
    }
  }

  /** Per-frame visuals: write instance matrices of live objects. */
  update(): void {
    this.markers.forEachLive((m) => {
      const k = m.grow ? 0.15 + 0.85 * Math.min(1, m.age / Math.max(0.001, m.duration)) : 1;
      dummy.position.set(m.x, m.y + 0.12, m.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(m.radius * k);
      dummy.updateMatrix();
      this.markerMesh.setMatrixAt(m.index, dummy.matrix);
      this.markerDirty = true;
    });
    this.shots.forEachLive((s) => {
      dummy.position.copy(s.pos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(this.scale < 1 ? 0.6 : 1);
      dummy.updateMatrix();
      this.shotMesh.setMatrixAt(s.index, dummy.matrix);
      this.shotDirty = true;
    });
    this.missiles.forEachLive((m) => {
      const t = Math.min(1, m.t);
      dummy.position.lerpVectors(m.start, m.end, t);
      dummy.position.y += BOSS_LOCAL.missile.arcHeight * this.scale * 4 * t * (1 - t);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(this.scale < 1 ? 0.6 : 1);
      dummy.updateMatrix();
      this.missileMesh.setMatrixAt(m.index, dummy.matrix);
      this.missileDirty = true;
    });
    this.syncVisibility();
  }

  private syncVisibility(): void {
    if (this.markerDirty) this.markerMesh.instanceMatrix.needsUpdate = true;
    if (this.shotDirty) this.shotMesh.instanceMatrix.needsUpdate = true;
    if (this.missileDirty) this.missileMesh.instanceMatrix.needsUpdate = true;
    this.markerDirty = this.shotDirty = this.missileDirty = false;
    this.markerMesh.visible = this.markers.liveCount > 0;
    this.shotMesh.visible = this.shots.liveCount > 0;
    this.missileMesh.visible = this.missiles.liveCount > 0;
  }

  // Snapshots keep release-during-iteration safe; they only allocate while attacks are live.
  private liveMarkerList(): Marker[] {
    const out: Marker[] = [];
    this.markers.forEachLive((m) => out.push(m));
    return out;
  }
  private liveShotList(): Shot[] {
    const out: Shot[] = [];
    this.shots.forEachLive((s) => out.push(s));
    return out;
  }
  private liveMissileList(): Missile[] {
    const out: Missile[] = [];
    this.missiles.forEachLive((m) => out.push(m));
    return out;
  }
}
