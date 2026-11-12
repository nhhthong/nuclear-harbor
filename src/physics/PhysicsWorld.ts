import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { SIM } from '@/config/tunables';
import type { ColliderMeta } from '@/core/types';
import { Groups, QueryGroups } from './groups';

export type { RAPIER };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StaticBoxOptions {
  /** Centre of the box in world space. */
  center: Vec3;
  halfExtents: Vec3;
  /** Rotation around Y in radians. */
  yaw?: number;
  /** Interaction groups; defaults to Groups.world (or worldGrappleable when meta.grappleable). */
  groups?: number;
  meta?: ColliderMeta;
}

export interface RayHit {
  point: Vector3;
  normal: Vector3;
  distance: number;
  collider: RAPIER.Collider;
  /** Metadata registered for the collider (kind 'static' when none was set). */
  meta: ColliderMeta;
}

export interface RaycastOptions {
  /** Interaction groups of the query; see QueryGroups. Defaults to everything. */
  groups?: number;
  excludeCollider?: RAPIER.Collider;
  excludeBody?: RAPIER.RigidBody;
  /** Skip sensor colliders (default true). */
  excludeSensors?: boolean;
}

export interface CharacterOptions {
  /** Feet position. */
  position: Vec3;
  radius: number;
  /** Half height of the cylindrical part; total height = 2 * (halfHeight + radius). */
  halfHeight: number;
  groups?: number;
  /** Groups used for movement queries; defaults to QueryGroups.playerMove. */
  moveGroups?: number;
  offset?: number;
  maxStepHeight?: number;
  minStepWidth?: number;
  maxSlopeDeg?: number;
  snapToGround?: number;
  meta?: ColliderMeta;
}

const DEFAULT_META: ColliderMeta = Object.freeze({ kind: 'static' }) as ColliderMeta;

/**
 * Kinematic capsule driven by Rapier's KinematicCharacterController (REVIEW #5). Used by the
 * player (T-01) and may be reused for enemies.
 */
export class CharacterBody {
  private readonly centerOffset: number;
  private readonly scratch = new RAPIER.Vector3(0, 0, 0);
  grounded = false;

  constructor(
    private readonly physics: PhysicsWorld,
    readonly body: RAPIER.RigidBody,
    readonly collider: RAPIER.Collider,
    readonly controller: RAPIER.KinematicCharacterController,
    radius: number,
    halfHeight: number,
    private readonly moveGroups: number,
  ) {
    this.centerOffset = radius + halfHeight;
  }

  /**
   * Try to translate by `delta` (metres, this step), sliding along obstacles. Returns the
   * translation actually applied and updates `grounded`. Collisions of the last move are
   * available through `controller.numComputedCollisions()` / `computedCollision(i)`.
   */
  move(delta: Vec3, out = new Vector3()): Vector3 {
    this.scratch.x = delta.x;
    this.scratch.y = delta.y;
    this.scratch.z = delta.z;
    this.controller.computeColliderMovement(
      this.collider,
      this.scratch,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      this.moveGroups,
    );
    const moved = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    const t = this.body.translation();
    const next = { x: t.x + moved.x, y: t.y + moved.y, z: t.z + moved.z };
    // Applied immediately so that queries made later in the same fixed step see the new pose.
    this.body.setTranslation(next, true);
    this.body.setNextKinematicTranslation(next);
    return out.set(moved.x, moved.y, moved.z);
  }

  /** Feet position. */
  getPosition(out = new Vector3()): Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y - this.centerOffset, t.z);
  }

  /** Teleport: feet position. */
  setPosition(feet: Vec3): void {
    const next = { x: feet.x, y: feet.y + this.centerOffset, z: feet.z };
    this.body.setTranslation(next, true);
    this.body.setNextKinematicTranslation(next);
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.clearMeta(this.collider);
    this.physics.world.removeRigidBody(this.body);
  }
}

/**
 * Thin wrapper around a Rapier world: creation helpers, collider metadata and ray queries.
 * Anything not covered here can use `physics.world` / `physics.rapier` directly.
 *
 * Rapier is WASM: `await PhysicsWorld.create()` once (Game does it) before constructing bodies.
 */
export class PhysicsWorld {
  readonly rapier = RAPIER;
  readonly world: RAPIER.World;
  private readonly meta = new Map<number, ColliderMeta>();
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  private static initPromise: Promise<void> | null = null;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: SIM.gravity, z: 0 });
    this.world.timestep = 1 / SIM.fixedHz;
  }

  static async create(): Promise<PhysicsWorld> {
    PhysicsWorld.initPromise ??= RAPIER.init();
    await PhysicsWorld.initPromise;
    return new PhysicsWorld();
  }

  /** Advance the simulation by one fixed step (Game calls this; modules must not). */
  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  /**
   * Make colliders created/moved since the last step visible to ray and shape queries without
   * advancing the simulation. Call after building static geometry outside the fixed loop.
   */
  syncQueries(): void {
    const dt = this.world.timestep;
    this.world.timestep = 0;
    this.world.step();
    this.world.timestep = dt;
  }

  // ---- creation --------------------------------------------------------------------------

  /** Fixed box collider (GDD 7.5: simple boxes, no mesh colliders). */
  addStaticBox(options: StaticBoxOptions): RAPIER.Collider {
    const { center, halfExtents, yaw = 0, meta } = options;
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setTranslation(center.x, center.y, center.z)
      .setCollisionGroups(options.groups ?? (meta?.grappleable ? Groups.worldGrappleable : Groups.world));
    if (yaw !== 0) desc.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
    const collider = this.world.createCollider(desc);
    this.setMeta(collider, meta ?? { kind: 'static' });
    return collider;
  }

  /** Any collider description, optionally attached to a body, with metadata. */
  addCollider(desc: RAPIER.ColliderDesc, meta: ColliderMeta, parent?: RAPIER.RigidBody): RAPIER.Collider {
    const collider = this.world.createCollider(desc, parent);
    this.setMeta(collider, meta);
    return collider;
  }

  createCharacter(options: CharacterOptions): CharacterBody {
    const { position, radius, halfHeight } = options;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        position.x,
        position.y + radius + halfHeight,
        position.z,
      ),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(options.groups ?? Groups.player),
      body,
    );
    this.setMeta(collider, options.meta ?? { kind: 'player' });
    const controller = this.world.createCharacterController(options.offset ?? 0.02);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setSlideEnabled(true);
    controller.setMaxSlopeClimbAngle(((options.maxSlopeDeg ?? 45) * Math.PI) / 180);
    controller.setMinSlopeSlideAngle(((options.maxSlopeDeg ?? 45) * Math.PI) / 180);
    if ((options.maxStepHeight ?? 0) > 0) {
      controller.enableAutostep(options.maxStepHeight ?? 0.3, options.minStepWidth ?? 0.2, false);
    }
    if ((options.snapToGround ?? 0) > 0) controller.enableSnapToGround(options.snapToGround ?? 0.3);
    return new CharacterBody(
      this,
      body,
      collider,
      controller,
      radius,
      halfHeight,
      options.moveGroups ?? QueryGroups.playerMove,
    );
  }

  removeCollider(collider: RAPIER.Collider): void {
    this.meta.delete(collider.handle);
    this.world.removeCollider(collider, true);
  }

  /** Removes a body and all of its colliders (and their metadata). */
  removeBody(body: RAPIER.RigidBody): void {
    for (let i = 0; i < body.numColliders(); i++) this.meta.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
  }

  // ---- metadata --------------------------------------------------------------------------

  setMeta(collider: RAPIER.Collider, meta: ColliderMeta): void {
    this.meta.set(collider.handle, meta);
  }

  getMeta(collider: RAPIER.Collider | number): ColliderMeta {
    const handle = typeof collider === 'number' ? collider : collider.handle;
    return this.meta.get(handle) ?? DEFAULT_META;
  }

  clearMeta(collider: RAPIER.Collider): void {
    this.meta.delete(collider.handle);
  }

  // ---- queries ---------------------------------------------------------------------------

  /** Closest hit along a ray, or null. `direction` must be normalised. */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number, options: RaycastOptions = {}): RayHit | null {
    this.ray.origin.x = origin.x;
    this.ray.origin.y = origin.y;
    this.ray.origin.z = origin.z;
    this.ray.dir.x = direction.x;
    this.ray.dir.y = direction.y;
    this.ray.dir.z = direction.z;
    const flags = options.excludeSensors === false ? undefined : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
    const hit = this.world.castRayAndGetNormal(
      this.ray,
      maxDistance,
      true,
      flags,
      options.groups,
      options.excludeCollider,
      options.excludeBody,
    );
    if (!hit) return null;
    const d = hit.timeOfImpact;
    return {
      point: new Vector3(origin.x + direction.x * d, origin.y + direction.y * d, origin.z + direction.z * d),
      normal: new Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      distance: d,
      collider: hit.collider,
      meta: this.getMeta(hit.collider),
    };
  }

  /** True when nothing in `groups` (default: static world) blocks the segment a -> b. */
  hasLineOfSight(a: Vec3, b: Vec3, groups: number = QueryGroups.worldOnly): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return true;
    return this.raycast(a, { x: dx / length, y: dy / length, z: dz / length }, length, { groups }) === null;
  }

  get colliderCount(): number {
    return this.world.colliders.len();
  }

  dispose(): void {
    this.meta.clear();
    this.world.free();
  }
}
