import { Quaternion, Vector3 } from 'three';
import type { Damageable, DamageInfo, DamageResult } from '@/core/types';
import { Groups } from '@/physics/groups';
import type { PhysicsWorld, RAPIER } from '@/physics/PhysicsWorld';
import type { LegBone } from './crabAssets';
import { CRAB } from './tunables';

export interface BossHandlers {
  /** Any hit on the body (one HP pool, no zones). */
  hit(info: DamageInfo): DamageResult;
  /** True while the boss can still be hit at all (not collapsed). */
  alive(): boolean;
}

class BodyDamageable implements Damageable {
  readonly kind = 'boss' as const;
  readonly id = 'crab-boss';
  constructor(
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

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const dir = new Vector3();

/**
 * One kinematic body in Groups.enemy built from Rapier primitives only (spec 27): a cuboid for the hull,
 * one for the rear launcher, a two-segment cuboid chain per leg and a cuboid per gun arm. Every collider
 * shares one damageable (the single HP pool), zone `body`, so a hit anywhere does full damage.
 */
export class BossColliders {
  readonly body: RAPIER.RigidBody;
  readonly colliderCount: number;

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly k: number,
    handlers: BossHandlers,
    legs: Iterable<LegBone>,
    arms: Iterable<{ shoulder: Vector3; tip: Vector3 }>,
  ) {
    const R = physics.rapier;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const zone = new BodyDamageable((i) => handlers.hit(i), handlers.alive);
    const meta = { kind: 'boss' as const, damageable: zone, hitZone: 'body' as const };
    const s = k;
    let n = 0;
    const box = (hx: number, hy: number, hz: number, x: number, y: number, z: number): void => {
      physics.addCollider(R.ColliderDesc.cuboid(hx * s, hy * s, hz * s).setTranslation(x * s, y * s, z * s).setCollisionGroups(Groups.enemy), meta, this.body);
      n++;
    };
    const H = CRAB.hull;
    box(H.halfX, H.halfY, H.halfZ, 0, H.y, H.z);
    const L = CRAB.launcher;
    box(L.halfX, L.halfY, L.halfZ, 0, L.y, L.z);
    for (const b of legs) {
      this.addBar(b.hip, b.knee, CRAB.legThickness, meta);
      this.addBar(b.knee, b.foot, CRAB.legThickness, meta);
      n += 2;
    }
    for (const a of arms) {
      this.addBar(a.shoulder, a.tip, CRAB.armThickness, meta);
      n++;
    }
    this.colliderCount = n;
  }

  private addBar(a: Vector3, b: Vector3, thickness: number, meta: { kind: 'boss'; damageable: Damageable; hitZone: 'body' }): void {
    const R = this.physics.rapier;
    const s = this.k;
    dir.copy(b).sub(a);
    const len = dir.length();
    if (len < 1e-4) return;
    dir.multiplyScalar(1 / len);
    q.setFromUnitVectors(UP, dir);
    this.physics.addCollider(
      R.ColliderDesc.cuboid((thickness / 2) * s, (len / 2) * s, (thickness / 2) * s)
        .setTranslation(((a.x + b.x) / 2) * s, ((a.y + b.y) / 2) * s, ((a.z + b.z) / 2) * s)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(Groups.enemy),
      meta,
      this.body,
    );
  }

  /** Pose the whole boss (feet origin). Applied now for queries and as the next kinematic target. */
  setPose(x: number, y: number, z: number, yaw: number): void {
    const t = { x, y, z };
    const r = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    this.body.setTranslation(t, true);
    this.body.setRotation(r, true);
    this.body.setNextKinematicTranslation(t);
    this.body.setNextKinematicRotation(r);
  }

  dispose(): void {
    this.physics.removeBody(this.body);
  }
}
