import {
  AdditiveBlending,
  BoxGeometry,
  CapsuleGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Scene } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { resolveDamage } from '@/combat/damage';
import type { Damageable, DamageInfo, DamageResult } from '@/core/types';
import { Groups } from '@/physics/groups';
import type { PhysicsWorld, RAPIER } from '@/physics/PhysicsWorld';
import type { DroneAssets } from './crabAssets';
import { clampOrbitRadius, orbitPoint } from './skills';
import { CRAB } from './tunables';

const D = CRAB.drones;
const dummy = new Object3D();
const ZERO = new Matrix4().makeScale(0, 0, 0);
const PARK = { x: 0, y: -200, z: 0 };
const orbit = { x: 0, z: 0 };
const tmpTarget = new Vector3();
const tmpFrom = new Vector3();
const tmpDir = new Vector3();

class DroneDamageable implements Damageable {
  readonly kind = 'enemy' as const;
  constructor(
    readonly id: string,
    private readonly apply: (info: DamageInfo) => DamageResult,
    private readonly isAlive: () => boolean,
  ) {}

  get alive(): boolean {
    return this.isAlive();
  }

  applyDamage(info: DamageInfo): DamageResult {
    return this.apply(info);
  }
}

interface Drone {
  index: number;
  alive: boolean;
  hp: number;
  pos: Vector3;
  yaw: number;
  angle: number;
  dir: number;
  radius: number;
  height: number;
  phase: number;
  /** Seconds to the next shot; below `bolt.tell` the drone is telegraphing. */
  nextShot: number;
  body: RAPIER.RigidBody;
  damageable: DroneDamageable;
}

export interface DroneEvents {
  /** A drone died (shot): position for the burst. */
  onKilled(position: Vector3): void;
  /** The drone fires a bolt from `from` towards `to`. */
  onFire(from: Vector3, to: Vector3): void;
}

/**
 * Up to 6 dragonfly drones (spec 27): pooled kinematic ball colliders in Groups.enemy (so the player's hitscan
 * damages them through `meta.damageable`), one instanced mesh, one instanced tell glow. They hover and circle
 * the player at 4 to 9 m, fire slow bolts after a visible tell, and drop nothing. They are not part of the
 * enemy roster (`ctx.enemies`, `rosterRemaining`) and die with the boss.
 */
export class Drones {
  private readonly drones: Drone[] = [];
  private readonly mesh: InstancedMesh;
  private readonly glow: InstancedMesh;
  private time = 0;
  private rng: () => number = Math.random;

  constructor(
    res: ResourceTracker,
    scene: Scene,
    physics: PhysicsWorld,
    assets: DroneAssets | null,
    private readonly k: number,
    private readonly events: DroneEvents,
  ) {
    const R = physics.rapier;
    let geometry: BufferGeometry;
    let material: Material;
    if (assets) {
      geometry = assets.geometry;
      material = assets.material;
    } else {
      geometry = proceduralDrone();
      material = new MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.6, roughness: 0.4, emissive: new Color(0x401008) });
    }
    this.mesh = new InstancedMesh(geometry, material, D.cap);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.glow = new InstancedMesh(
      new SphereGeometry(0.28, 10, 8),
      Object.assign(new MeshBasicMaterial({ color: new Color(3.2, 1.0, 0.5), transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }), { toneMapped: false }),
      D.cap,
    );
    this.glow.frustumCulled = false;
    for (const m of [this.mesh, this.glow]) {
      res.track(m);
      res.onDispose(() => m.dispose());
      scene.add(m);
    }
    res.track(geometry);
    res.track(material);
    for (let i = 0; i < D.cap; i++) {
      const body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(PARK.x, PARK.y, PARK.z));
      const drone: Drone = {
        index: i,
        alive: false,
        hp: 0,
        pos: new Vector3(PARK.x, PARK.y, PARK.z),
        yaw: 0,
        angle: 0,
        dir: 1,
        radius: 6,
        height: 3,
        phase: 0,
        nextShot: 1,
        body,
        damageable: new DroneDamageable(`crab-drone-${i}`, (info) => this.damage(drone, info), () => drone.alive),
      };
      physics.addCollider(
        R.ColliderDesc.ball(D.hitRadius * k).setCollisionGroups(Groups.enemy),
        { kind: 'enemy', damageable: drone.damageable, hitZone: 'body' },
        body,
      );
      body.setEnabled(false);
      this.drones.push(drone);
      this.mesh.setMatrixAt(i, ZERO);
      this.glow.setMatrixAt(i, ZERO);
    }
    this.mesh.visible = false;
    this.glow.visible = false;
    res.onDispose(() => {
      for (const d of this.drones) physics.removeBody(d.body);
      this.drones.length = 0;
    });
  }

  setRandom(rand: () => number): void {
    this.rng = rand;
  }

  get alive(): number {
    let n = 0;
    for (const d of this.drones) if (d.alive) n++;
    return n;
  }

  /** Positions of the live drones (for tests and the debug state). */
  positions(): Array<{ x: number; y: number; z: number; hp: number }> {
    return this.drones.filter((d) => d.alive).map((d) => ({ x: d.pos.x, y: d.pos.y, z: d.pos.z, hp: d.hp }));
  }

  /** Release `count` drones from the bay (fewer if the pool is full). Returns how many launched. */
  release(count: number, bay: Vector3, player: Vector3): number {
    let n = 0;
    for (const d of this.drones) {
      if (n >= count) break;
      if (d.alive) continue;
      d.alive = true;
      d.hp = D.hp;
      d.pos.copy(bay);
      d.pos.x += (this.rng() - 0.5) * 2 * this.k;
      d.pos.z += (this.rng() - 0.5) * 2 * this.k;
      d.angle = Math.atan2(bay.z - player.z, bay.x - player.x) + (n - count / 2) * 0.9;
      d.dir = n % 2 === 0 ? 1 : -1;
      d.radius = clampOrbitRadius(D.orbitMin + this.rng() * (D.orbitMax - D.orbitMin));
      d.height = D.heightMin + this.rng() * (D.heightMax - D.heightMin);
      d.phase = this.rng() * Math.PI * 2;
      d.nextShot = D.bolt.interval[0] + this.rng() * (D.bolt.interval[1] - D.bolt.interval[0]) + n * 0.4;
      d.body.setEnabled(true);
      d.body.setTranslation({ x: d.pos.x, y: d.pos.y, z: d.pos.z }, true);
      n++;
    }
    return n;
  }

  private damage(d: Drone, info: DamageInfo): DamageResult {
    if (!d.alive) return { dealt: 0, zone: 'body', killed: false, absorbed: true };
    const r = resolveDamage(d.hp, { amount: info.amount, zone: 'body' });
    d.hp = r.hpAfter;
    if (r.killed) this.kill(d, true);
    return { dealt: r.dealt, zone: 'body', killed: r.killed, absorbed: r.absorbed };
  }

  private kill(d: Drone, burst: boolean): void {
    d.alive = false;
    d.body.setEnabled(false);
    d.body.setTranslation(PARK, true);
    if (burst) this.events.onKilled(d.pos);
    d.pos.set(PARK.x, PARK.y, PARK.z);
  }

  /** The boss died or the player respawned: every drone goes (with a burst when `burst`). */
  killAll(burst: boolean): void {
    for (const d of this.drones) if (d.alive) this.kill(d, burst);
  }

  fixedStep(dt: number, player: Vector3, playerCentreHeight: number): void {
    this.time += dt;
    for (const d of this.drones) {
      if (!d.alive) continue;
      d.angle += D.orbitSpeed * d.dir * dt;
      d.radius = clampOrbitRadius(d.radius + Math.sin(this.time * 0.7 + d.phase) * 0.6 * dt);
      orbitPoint(player, d.radius * this.k, d.angle, orbit);
      const hover = player.y + (d.height + Math.sin(this.time * 1.9 + d.phase) * 0.35) * this.k;
      tmpTarget.set(orbit.x, Math.max(2.2, hover), orbit.z);
      tmpDir.copy(tmpTarget).sub(d.pos);
      const dist = tmpDir.length();
      const step = Math.min(dist, D.speed * this.k * dt * (0.4 + Math.min(1, dist / 4)));
      if (dist > 1e-4) d.pos.addScaledVector(tmpDir, step / dist);
      d.yaw = Math.atan2(-(player.x - d.pos.x), -(player.z - d.pos.z));
      d.body.setNextKinematicTranslation({ x: d.pos.x, y: d.pos.y, z: d.pos.z });
      d.body.setTranslation({ x: d.pos.x, y: d.pos.y, z: d.pos.z }, true);
      d.nextShot -= dt;
      if (d.nextShot <= 0) {
        tmpFrom.copy(d.pos);
        tmpFrom.x += -Math.sin(d.yaw) * 0.6 * this.k;
        tmpFrom.z += -Math.cos(d.yaw) * 0.6 * this.k;
        tmpTarget.set(player.x, player.y + playerCentreHeight, player.z);
        this.events.onFire(tmpFrom, tmpTarget);
        d.nextShot = D.bolt.interval[0] + this.rng() * (D.bolt.interval[1] - D.bolt.interval[0]);
      }
    }
  }

  /** Per-frame visuals. */
  update(time: number): void {
    let live = 0;
    for (const d of this.drones) {
      if (!d.alive) {
        this.mesh.setMatrixAt(d.index, ZERO);
        this.glow.setMatrixAt(d.index, ZERO);
        continue;
      }
      live++;
      const bob = Math.sin(time * 3 + d.phase) * 0.06;
      dummy.position.set(d.pos.x, d.pos.y + bob, d.pos.z);
      // bank into the turn and tip the nose to the player
      dummy.rotation.set(0.12 * Math.sin(time * 1.6 + d.phase), d.yaw, d.dir * -0.18 + Math.sin(time * 2.3 + d.phase) * 0.06);
      dummy.scale.setScalar(this.k);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(d.index, dummy.matrix);
      // tell: a glow grows at the nose for the last `tell` seconds before a shot
      const tell = D.bolt.tell;
      if (d.nextShot < tell) {
        const f = 1 - d.nextShot / tell;
        const flick = 0.75 + 0.25 * Math.sin(time * 40);
        dummy.position.set(d.pos.x - Math.sin(d.yaw) * 0.7 * this.k, d.pos.y + bob, d.pos.z - Math.cos(d.yaw) * 0.7 * this.k);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar((0.4 + 1.8 * f) * flick * this.k);
        dummy.updateMatrix();
        this.glow.setMatrixAt(d.index, dummy.matrix);
      } else {
        this.glow.setMatrixAt(d.index, ZERO);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    this.mesh.visible = live > 0;
    this.glow.visible = live > 0;
  }
}

/** Small procedural dragonfly (fallback when the GLB is missing): body, head, tail, four thin wings. */
function proceduralDrone(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const body = new CapsuleGeometry(0.16, 0.7, 4, 8);
  body.rotateX(Math.PI / 2);
  parts.push(body);
  const head = new SphereGeometry(0.2, 10, 8);
  head.translate(0, 0, -0.6);
  parts.push(head);
  for (const sx of [-1, 1]) {
    for (const z of [-0.15, 0.2]) {
      const wing = new BoxGeometry(1.5, 0.02, 0.28);
      wing.translate(sx * 0.85, 0.12, z);
      parts.push(wing);
    }
  }
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  for (const g of parts) g.dispose();
  if (!merged) throw new Error('drone geometry merge failed');
  return merged;
}
