import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Scene } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { ObjectPool } from '@/core/ObjectPool';
import { QueryGroups } from '@/physics/groups';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { CRAB } from './tunables';

/**
 * Pooled, instanced effects of the crab's skills (spec 27): ground markers, lobbed bombs, drone bolts and the
 * laser beams. Draw calls: markers 1, bombs 1, bolts 1, beams 3. No per-frame allocation except raycast results.
 */

export interface Marker {
  index: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  duration: number;
  /** Expand from the centre during the telegraph. */
  grow: boolean;
  /** Pulse the opacity (spin ring, laser warning). */
  pulse: boolean;
}

interface Bomb {
  index: number;
  start: Vector3;
  end: Vector3;
  wait: number;
  launched: boolean;
  t: number;
  duration: number;
  marker: Marker | null;
}

export interface Bolt {
  index: number;
  pos: Vector3;
  dir: Vector3;
  speed: number;
  life: number;
}

export type BombHandler = (point: Vector3) => void;
/** Returns true when the bolt hit the player (the bolt is then consumed). */
export type BoltHandler = (point: Vector3) => boolean;

export type BeamMode = 'off' | 'warn' | 'fire';

/** Live quake rings at once (a quake sends four, one per second, each gone in about 2.5 s). */
const RING_CAP = 6;
const dummy = new Object3D();
const ZERO = new Matrix4().makeScale(0, 0, 0);
const tmp = new Vector3();
const DIR = { x: 0, y: 0, z: -1 };

export class BossEffects {
  private readonly markers: ObjectPool<Marker>;
  private readonly bombs: ObjectPool<Bomb>;
  private readonly bolts: ObjectPool<Bolt>;
  private readonly markerMesh: InstancedMesh;
  private readonly bombMesh: InstancedMesh;
  private readonly boltMesh: InstancedMesh;
  private readonly beamCore: InstancedMesh;
  private readonly beamGlow: InstancedMesh;
  private readonly beamWarn: InstancedMesh;
  private readonly markerMat: MeshBasicMaterial;
  private readonly ringMesh: InstancedMesh;
  private readonly rings: Array<{ x: number; z: number; r: number; max: number; speed: number; live: boolean }> = [];
  private beamsOn = false;
  private time = 0;

  constructor(
    res: ResourceTracker,
    scene: Scene,
    private readonly physics: PhysicsWorld,
    private readonly k: number,
  ) {
    const B = CRAB.bombs;
    const markerCap = B.capacity + 4;
    this.markerMat = new MeshBasicMaterial({
      color: 0xff2a1a,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.markerMesh = this.make(new CircleGeometry(1, 40), this.markerMat, markerCap);
    this.bombMesh = this.make(new SphereGeometry(0.8 * k, 12, 8), new MeshBasicMaterial({ color: 0xff7a30 }), B.capacity);
    this.boltMesh = this.make(new SphereGeometry(0.35, 10, 8), additive(new Color(1.2, 3.0, 1.6), 0.95), CRAB.drones.bolt.capacity);
    const beams = CRAB.laser.beams;
    // HDR colours (> 1) so the bloom pass picks the core up
    this.beamCore = this.make(new BoxGeometry(1, 1, 1), additive(new Color(2.8, 0.55, 0.35), 1), beams);
    this.beamGlow = this.make(new BoxGeometry(1, 1, 1), additive(new Color(1.6, 0.25, 0.15), 0.4), beams);
    this.beamWarn = this.make(new BoxGeometry(1, 1, 1), additive(new Color(1.4, 0.2, 0.15), 0.55), beams);
    // spec 34: expanding shockwave rings of the claw quake (HDR so the bloom picks them up)
    this.ringMesh = this.make(new RingGeometry(0.9, 1, 64), additive(new Color(3, 0.9, 0.35), 0.9), RING_CAP);
    for (let i = 0; i < RING_CAP; i++) {
      this.rings.push({ x: 0, z: 0, r: 0, max: 0, speed: 0, live: false });
      this.ringMesh.setMatrixAt(i, ZERO);
    }
    for (const m of [this.markerMesh, this.bombMesh, this.boltMesh, this.beamCore, this.beamGlow, this.beamWarn, this.ringMesh]) {
      res.track(m);
      res.onDispose(() => m.dispose());
      scene.add(m);
    }

    let mi = 0;
    this.markers = new ObjectPool<Marker>({
      capacity: markerCap,
      create: () => ({ index: mi++, x: 0, y: 0, z: 0, radius: 1, age: 0, duration: 1, grow: false, pulse: false }),
      reset: (m) => this.markerMesh.setMatrixAt(m.index, ZERO),
    });
    let bi = 0;
    this.bombs = new ObjectPool<Bomb>({
      capacity: B.capacity,
      create: () => ({ index: bi++, start: new Vector3(), end: new Vector3(), wait: 0, launched: false, t: 0, duration: 1, marker: null }),
      reset: (b) => {
        this.bombMesh.setMatrixAt(b.index, ZERO);
        b.marker = null;
      },
    });
    let qi = 0;
    this.bolts = new ObjectPool<Bolt>({
      capacity: CRAB.drones.bolt.capacity,
      create: () => ({ index: qi++, pos: new Vector3(), dir: new Vector3(), speed: 0, life: 0 }),
      reset: (b) => this.boltMesh.setMatrixAt(b.index, ZERO),
    });
    for (let i = 0; i < markerCap; i++) this.markerMesh.setMatrixAt(i, ZERO);
    for (let i = 0; i < B.capacity; i++) this.bombMesh.setMatrixAt(i, ZERO);
    for (let i = 0; i < CRAB.drones.bolt.capacity; i++) this.boltMesh.setMatrixAt(i, ZERO);
    for (let i = 0; i < beams; i++) {
      this.beamCore.setMatrixAt(i, ZERO);
      this.beamGlow.setMatrixAt(i, ZERO);
      this.beamWarn.setMatrixAt(i, ZERO);
    }
    res.onDispose(() => {
      this.markers.dispose();
      this.bombs.dispose();
      this.bolts.dispose();
    });
  }

  private make(geo: BufferGeometry, mat: Material, count: number): InstancedMesh {
    const mesh = new InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage
    return mesh;
  }

  get liveMarkers(): number {
    return this.markers.liveCount;
  }
  get liveBombs(): number {
    return this.bombs.liveCount;
  }
  get liveBolts(): number {
    return this.bolts.liveCount;
  }
  get beamsActive(): boolean {
    return this.beamsOn;
  }

  /** Starts an expanding ground ring at (x, z): grows `speed` m/s from the first step up to `max` m. */
  launchRing(x: number, z: number, max: number, speed: number): void {
    const ring = this.rings.find((q) => !q.live);
    if (!ring) return;
    ring.x = x;
    ring.z = z;
    ring.r = CRAB.quake.startRadius * this.k;
    ring.max = max;
    ring.speed = speed;
    ring.live = true;
  }

  clearRings(): void {
    for (let i = 0; i < this.rings.length; i++) {
      const q = this.rings[i];
      if (q) q.live = false;
      this.ringMesh.setMatrixAt(i, ZERO);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.visible = false;
  }

  get liveRings(): number {
    let n = 0;
    for (const q of this.rings) if (q.live) n++;
    return n;
  }

  addMarker(x: number, y: number, z: number, radius: number, duration: number, grow: boolean, pulse = false): Marker | null {
    const m = this.markers.acquire();
    if (!m) return null;
    m.x = x;
    m.y = y;
    m.z = z;
    m.radius = radius;
    m.age = 0;
    m.duration = duration;
    m.grow = grow;
    m.pulse = pulse;
    return m;
  }

  removeMarker(m: Marker | null): void {
    if (m) this.markers.release(m);
  }

  /** Queue a bomb: after `delay` seconds its marker shows and it flies from `from` to the marker, landing `markerTime` later. */
  scheduleBomb(from: Vector3, x: number, z: number, delay: number): boolean {
    const b = this.bombs.acquire();
    if (!b) return false;
    b.start.copy(from);
    b.end.set(x, 0, z);
    b.wait = delay;
    b.launched = false;
    b.t = 0;
    b.duration = CRAB.bombs.markerTime;
    b.marker = null;
    return true;
  }

  fireBolt(from: Vector3, to: Vector3): boolean {
    const b = this.bolts.acquire();
    if (!b) return false;
    const B = CRAB.drones.bolt;
    b.pos.copy(from);
    b.dir.copy(to).sub(from).normalize();
    b.speed = B.speed;
    b.life = B.life;
    return true;
  }

  releaseAll(): void {
    this.markers.releaseAll();
    this.bombs.releaseAll();
    this.bolts.releaseAll();
    this.clearRings();
    this.setBeams('off', 0, 0, 0, null, null, 0);
    this.sync();
  }

  /** Fixed-step motion; bomb landings and bolt contacts are reported through the handlers. */
  fixedStep(dt: number, onBomb: BombHandler, onBolt: BoltHandler): void {
    this.time += dt;
    for (const q of this.rings) {
      if (!q.live) continue;
      q.r += q.speed * dt;
      if (q.r > q.max) q.live = false;
    }
    if (this.markers.liveCount > 0) {
      const done: Marker[] = [];
      this.markers.forEachLive((m) => {
        m.age += dt;
        if (m.age >= m.duration) done.push(m);
      });
      for (const m of done) this.markers.release(m);
    }
    if (this.bombs.liveCount > 0) {
      const landed: Bomb[] = [];
      this.bombs.forEachLive((b) => {
        if (!b.launched) {
          b.wait -= dt;
          if (b.wait > 0) return;
          b.launched = true;
          b.marker = this.addMarker(b.end.x, 0, b.end.z, CRAB.bombs.radius * this.k, b.duration, false);
          b.t = 0;
          return;
        }
        b.t += dt / b.duration;
        if (b.t >= 1) landed.push(b);
      });
      for (const b of landed) {
        tmp.copy(b.end);
        this.removeMarker(b.marker);
        this.bombs.release(b);
        onBomb(tmp);
      }
    }
    if (this.bolts.liveCount > 0) {
      const gone: Bolt[] = [];
      this.bolts.forEachLive((b) => {
        const step = b.speed * dt;
        b.life -= dt;
        DIR.x = b.dir.x;
        DIR.y = b.dir.y;
        DIR.z = b.dir.z;
        const hit = this.physics.raycast(b.pos, DIR, step, { groups: QueryGroups.worldOnly });
        b.pos.addScaledVector(b.dir, step);
        if (hit || b.life <= 0 || b.pos.y < 0.05 || onBolt(b.pos)) gone.push(b);
      });
      for (const b of gone) this.bolts.release(b);
    }
  }

  /**
   * Beams of the four-way laser: `warn` draws thin warning lines, `fire` the HDR beams. `angles` and `lengths`
   * (one per beam) are in the boss's yaw convention (0 = -Z, turning left).
   */
  setBeams(mode: BeamMode, ox: number, oy: number, oz: number, angles: readonly number[] | null, lengths: readonly number[] | null, startRadius: number): void {
    const L = CRAB.laser;
    const n = L.beams;
    this.beamsOn = mode === 'fire';
    for (let i = 0; i < n; i++) {
      const a = angles?.[i];
      const len = lengths?.[i];
      if (mode === 'off' || a === undefined || len === undefined) {
        this.beamCore.setMatrixAt(i, ZERO);
        this.beamGlow.setMatrixAt(i, ZERO);
        this.beamWarn.setMatrixAt(i, ZERO);
        continue;
      }
      const dx = -Math.sin(a);
      const dz = -Math.cos(a);
      const length = Math.max(0.01, len - startRadius);
      const cx = ox + dx * (startRadius + length / 2);
      const cz = oz + dz * (startRadius + length / 2);
      const pulse = 0.8 + 0.2 * Math.sin(this.time * 30);
      if (mode === 'fire') {
        this.place(this.beamCore, i, cx, oy, cz, a, L.width * 0.38 * this.k * pulse, 0.38 * this.k * pulse, length);
        this.place(this.beamGlow, i, cx, oy, cz, a, L.width * this.k, (L.top - L.bottom) * this.k * pulse, length);
        this.beamWarn.setMatrixAt(i, ZERO);
      } else {
        this.place(this.beamWarn, i, cx, 0.12, cz, a, 0.16 * this.k, 0.05, length);
        this.beamCore.setMatrixAt(i, ZERO);
        this.beamGlow.setMatrixAt(i, ZERO);
      }
    }
    this.beamCore.instanceMatrix.needsUpdate = true;
    this.beamGlow.instanceMatrix.needsUpdate = true;
    this.beamWarn.instanceMatrix.needsUpdate = true;
    this.beamCore.visible = this.beamGlow.visible = mode === 'fire';
    this.beamWarn.visible = mode === 'warn';
  }

  private place(mesh: InstancedMesh, i: number, x: number, y: number, z: number, angle: number, w: number, h: number, length: number): void {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(w, h, length);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  /** Per-frame visuals: write instance matrices of live objects. */
  update(): void {
    this.markers.forEachLive((m) => {
      const f = Math.min(1, m.age / Math.max(0.001, m.duration));
      const kk = m.grow ? 0.15 + 0.85 * f : 1;
      dummy.position.set(m.x, m.y + 0.12, m.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(m.radius * kk);
      dummy.updateMatrix();
      this.markerMesh.setMatrixAt(m.index, dummy.matrix);
    });
    this.bombs.forEachLive((b) => {
      if (!b.launched) return;
      const t = Math.min(1, b.t);
      dummy.position.lerpVectors(b.start, b.end, t);
      dummy.position.y += CRAB.bombs.arcHeight * this.k * 4 * t * (1 - t);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.bombMesh.setMatrixAt(b.index, dummy.matrix);
    });
    this.bolts.forEachLive((b) => {
      dummy.position.copy(b.pos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.boltMesh.setMatrixAt(b.index, dummy.matrix);
    });
    // marker opacity pulses while spin/laser rings are up: one shared material, so pulse by the newest pulsing marker
    let pulsing = false;
    this.markers.forEachLive((m) => {
      if (m.pulse) pulsing = true;
    });
    let ringsLive = 0;
    for (let i = 0; i < this.rings.length; i++) {
      const q = this.rings[i];
      if (q?.live) {
        ringsLive++;
        dummy.position.set(q.x, 0.18, q.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(q.r);
        dummy.updateMatrix();
        this.ringMesh.setMatrixAt(i, dummy.matrix);
      } else {
        this.ringMesh.setMatrixAt(i, ZERO);
      }
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.visible = ringsLive > 0;
    this.markerMat.opacity = pulsing ? 0.3 + 0.18 * Math.sin(this.time * 16) : 0.38;
    this.sync();
  }

  private sync(): void {
    this.markerMesh.instanceMatrix.needsUpdate = true;
    this.bombMesh.instanceMatrix.needsUpdate = true;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    this.markerMesh.visible = this.markers.liveCount > 0;
    this.bombMesh.visible = this.bombs.liveCount > 0;
    this.boltMesh.visible = this.bolts.liveCount > 0;
  }
}

function additive(color: Color, opacity: number): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
  m.toneMapped = false;
  return m;
}
