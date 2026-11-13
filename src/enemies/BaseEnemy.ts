import { Group, Vector3 } from 'three';
import type { Collider, ColliderDesc, RigidBody } from '@dimforge/rapier3d-compat';
import { DEFAULT_ZONE_MULTIPLIERS, resolveDamage, type ZoneMultipliers } from '@/combat/damage';
import type { GameContext } from '@/core/GameContext';
import type { DamageInfo, DamageResult, Enemy, EnemyType, HitZone, SimLevel } from '@/core/types';
import { Groups } from '@/physics/groups';
import type { AIUpdateScheduler, Schedulable } from './AIUpdateScheduler';
import type { EnemyProjectiles } from './EnemyProjectiles';
import type { NavGrid, PathPoint } from './nav/NavGrid';
import { createPerception, updatePerception, type Perception } from './perception';
import type { SharedAssets } from './SharedAssets';
import { StateMachine } from './StateMachine';
import { ENEMY_LOCAL } from './tunables';

/** Where and how a robot appears. `patrol` is a closed loop of waypoints (may be empty). */
export interface EnemySpawn {
  type: EnemyType;
  position: Vector3;
  patrol: Vector3[];
}

/** Everything a robot needs from the framework (docs: specs/T-05-enemy-framework-sphere/contracts). */
export interface EnemyDeps {
  ctx: GameContext;
  nav: NavGrid;
  projectiles: EnemyProjectiles;
  scheduler: AIUpdateScheduler;
  /** Shared geometry/materials cache: build per-type meshes once, never per instance. */
  shared: SharedAssets;
  /** Live robots (same array the manager iterates); used for separation. Read-only. */
  enemies: readonly BaseEnemy[];
}

export type EnemyFactory = (deps: EnemyDeps, spawn: EnemySpawn) => BaseEnemy;

export interface BaseEnemyConfig {
  type: EnemyType;
  maxHp: number;
  /** Centre height above the ground (hover height for hovering robots). */
  centerHeight: number;
  /** Radius used for separation and as the default body radius. */
  radius: number;
  speed: number;
  /** Radius within which `think` runs perception (detection range); LOS is skipped beyond it. */
  perceptionRange: number;
  zoneProfile?: ZoneMultipliers;
}

let serial = 0;

const tmpSep = new Vector3();

/**
 * Base class of every ground robot (not the boss). Subclasses own their state machine decisions in
 * `think` (scheduled rate) and their actions; the base handles identity, HP and damage zones, hit
 * volumes, nav-path following with separation, sim levels and cleanup.
 */
export abstract class BaseEnemy implements Enemy, Schedulable {
  readonly kind = 'enemy' as const;
  readonly id: string;
  readonly type: EnemyType;
  readonly position = new Vector3();
  readonly maxHp: number;
  hp: number;

  /** Visual root; subclasses add their meshes here. Removed from the scene on destruction. */
  protected readonly root = new Group();
  protected readonly perception: Perception = createPerception();
  protected readonly fsm: StateMachine<string>;
  protected readonly zoneProfile: ZoneMultipliers;
  protected readonly body: RigidBody;
  protected readonly colliders: Collider[] = [];

  yaw = 0;
  forceHighRate = false;
  thinkDt = 0;
  /** Patrol loop; progress is kept across sim levels. */
  patrol: Vector3[];
  patrolIndex = 0;

  /** Speed (m/s) applied by `step` while a goal is set; subclasses set 0 to stand still. */
  moveSpeed = 0;
  protected goalX = 0;
  protected goalZ = 0;
  protected hasGoal = false;
  protected path: PathPoint[] | null = null;
  protected pathIndex = 0;
  private pathGoalX = Infinity;
  private pathGoalZ = Infinity;
  protected desiredYaw = 0;
  /** When true, `think`/`step` choose the facing (e.g. aim at the player while backing off). */
  protected lockFacing = false;
  protected alive_ = true;
  private level: SimLevel = 'active';
  private poseDirty = true;
  private lastBodyYaw = Infinity;

  constructor(
    protected readonly deps: EnemyDeps,
    spawn: EnemySpawn,
    protected readonly config: BaseEnemyConfig,
    initialState: string,
  ) {
    this.type = config.type;
    this.id = `${config.type}-${++serial}`;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.zoneProfile = config.zoneProfile ?? DEFAULT_ZONE_MULTIPLIERS;
    this.patrol = spawn.patrol.map((p) => p.clone());
    this.position.set(spawn.position.x, config.centerHeight, spawn.position.z);
    this.fsm = new StateMachine<string>(initialState);

    const { ctx } = deps;
    this.body = ctx.physics.world.createRigidBody(
      ctx.physics.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        this.position.x,
        this.position.y,
        this.position.z,
      ),
    );
    this.root.position.copy(this.position);
    ctx.scene.add(this.root);
  }

  // ---- Enemy / Damageable ---------------------------------------------------------------

  get alive(): boolean {
    return this.alive_ && this.hp > 0;
  }

  get state(): string {
    return this.fsm.state;
  }

  get simLevel(): SimLevel {
    return this.level;
  }

  set simLevel(level: SimLevel) {
    if (level === this.level) return;
    const previous = this.level;
    this.level = level;
    this.onSimLevelChanged(level, previous);
  }

  applyDamage(info: DamageInfo): DamageResult {
    if (!this.alive) return { dealt: 0, zone: info.zone, killed: false, absorbed: true };
    const result = resolveDamage(this.hp, info, this.zoneProfile);
    this.hp = result.hpAfter;
    const { ctx } = this.deps;
    if (result.dealt > 0) {
      ctx.events.emit('enemy:damaged', { id: this.id, type: this.type, hp: this.hp, maxHp: this.maxHp, zone: result.zone });
      this.onDamaged(info, result);
    }
    if (result.killed) this.destroy();
    return { dealt: result.dealt, zone: result.zone, killed: result.killed, absorbed: result.absorbed };
  }

  commandMoveTo(target: Vector3): void {
    this.onCommand(target);
  }

  // ---- hooks for subclasses -------------------------------------------------------------

  /** Scheduled decision step (rate depends on distance). `dt` is the time since the last think. */
  protected abstract think(dt: number, perception: Perception): void;
  /** Called when a defend-phase move order arrives. */
  protected abstract onCommand(target: Vector3): void;
  /** Forget the target (respawn). */
  abstract dropTarget(): void;

  protected onDamaged(_info: DamageInfo, _result: DamageResult): void {}
  protected onDestroyed(): void {}
  /** Per-frame visual animation for active robots. */
  animate(_dt: number, _time: number): void {}

  // ---- driven by the manager ------------------------------------------------------------

  /** Scheduled think: refreshes perception, runs `think`, and for dormant robots a coarse advance. */
  runThink(): void {
    if (!this.alive) return;
    const dormant = this.level === 'dormant';
    updatePerception(this.deps.ctx, this.position, this.config.perceptionRange, this.perception, !dormant);
    this.think(this.thinkDt, this.perception);
    if (dormant) this.coarseAdvance(this.thinkDt);
  }

  /** Every fixed tick for non-dormant robots: cheap movement integration. */
  step(dt: number): void {
    if (!this.alive) return;
    this.fsm.update(dt);
    this.followPath(dt);
    this.syncPose(dt);
  }

  /** Dormant robots advance their state timers cheaply. */
  tickDormant(dt: number): void {
    this.fsm.update(dt);
  }

  // ---- goals and movement ---------------------------------------------------------------

  protected setGoal(x: number, z: number, force = false): void {
    this.goalX = x;
    this.goalZ = z;
    this.hasGoal = true;
    if (this.level === 'dormant') return;
    const dx = x - this.pathGoalX;
    const dz = z - this.pathGoalZ;
    if (force || this.path === null || dx * dx + dz * dz > ENEMY_LOCAL.repathDistance * ENEMY_LOCAL.repathDistance) {
      this.plan();
    }
  }

  protected clearGoal(): void {
    this.hasGoal = false;
    this.path = null;
    this.pathGoalX = Infinity;
    this.pathGoalZ = Infinity;
  }

  private plan(): void {
    this.path = this.deps.nav.findPath(this.position.x, this.position.z, this.goalX, this.goalZ);
    this.pathIndex = 0;
    this.pathGoalX = this.goalX;
    this.pathGoalZ = this.goalZ;
  }

  protected distanceToGoal(): number {
    return Math.hypot(this.goalX - this.position.x, this.goalZ - this.position.z);
  }

  protected face(x: number, z: number): void {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    if (dx * dx + dz * dz > 1e-4) this.desiredYaw = Math.atan2(-dx, -dz);
  }

  /** Next patrol waypoint (loops); null when the robot has no patrol. */
  protected currentWaypoint(): Vector3 | null {
    return this.patrol[this.patrolIndex] ?? null;
  }

  protected advanceWaypoint(): void {
    if (this.patrol.length > 0) this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
  }

  private followPath(dt: number): void {
    if (!this.hasGoal || this.moveSpeed <= 0) return;
    const path = this.path;
    let vx = 0;
    let vz = 0;
    if (path !== null) {
      let wp = path[this.pathIndex];
      while (wp && Math.hypot(wp.x - this.position.x, wp.z - this.position.z) <= ENEMY_LOCAL.arriveRadius * 0.5) {
        this.pathIndex++;
        wp = path[this.pathIndex];
      }
      if (wp) {
        const dx = wp.x - this.position.x;
        const dz = wp.z - this.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          vx = (dx / d) * this.moveSpeed;
          vz = (dz / d) * this.moveSpeed;
        }
      }
    }
    if (vx === 0 && vz === 0) return;

    // separation from other robots
    const sepR = ENEMY_LOCAL.separationRadius;
    tmpSep.set(0, 0, 0);
    const others = this.deps.enemies;
    for (let i = 0; i < others.length; i++) {
      const o = others[i];
      if (!o || o === this || !o.alive_) continue;
      const dx = this.position.x - o.position.x;
      const dz = this.position.z - o.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < sepR * sepR && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const w = (sepR - d) / sepR;
        tmpSep.x += (dx / d) * w;
        tmpSep.z += (dz / d) * w;
      }
    }
    vx += tmpSep.x * ENEMY_LOCAL.separationStrength;
    vz += tmpSep.z * ENEMY_LOCAL.separationStrength;

    const nx = this.position.x + vx * dt;
    const nz = this.position.z + vz * dt;
    const nav = this.deps.nav;
    if (nav.isWalkable(nx, nz)) {
      this.position.x = nx;
      this.position.z = nz;
    } else if (nav.isWalkable(nx, this.position.z)) {
      this.position.x = nx;
    } else if (nav.isWalkable(this.position.x, nz)) {
      this.position.z = nz;
    } else {
      return;
    }
    this.poseDirty = true;
    if (!this.lockFacing) this.face(this.position.x + vx, this.position.z + vz);
  }

  /** Dormant robots: move straight toward the goal at speed, ignoring collisions (snapped on wake). */
  private coarseAdvance(dt: number): void {
    if (!this.hasGoal || this.moveSpeed <= 0) return;
    const dx = this.goalX - this.position.x;
    const dz = this.goalZ - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const s = Math.min(d, this.moveSpeed * dt);
    this.position.x += (dx / d) * s;
    this.position.z += (dz / d) * s;
    this.poseDirty = true;
  }

  private syncPose(dt: number): void {
    // turn towards desiredYaw
    let diff = this.desiredYaw - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = ENEMY_LOCAL.turnRate * dt;
    this.yaw += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
    if (Math.abs(this.yaw - this.lastBodyYaw) > 0.01) {
      this.lastBodyYaw = this.yaw;
      this.body.setRotation({ x: 0, y: Math.sin(this.yaw / 2), z: 0, w: Math.cos(this.yaw / 2) }, true);
      this.poseDirty = true;
    }
    if (!this.poseDirty) return;
    this.poseDirty = false;
    this.body.setTranslation(this.position, true);
    this.body.setNextKinematicTranslation(this.position);
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
  }

  // ---- sim level ------------------------------------------------------------------------

  protected onSimLevelChanged(level: SimLevel, previous: SimLevel): void {
    this.root.visible = level !== 'dormant';
    if (previous === 'dormant') {
      // dormant robots moved without collision: put them back on walkable ground
      const out: PathPoint = { x: 0, z: 0 };
      if (this.deps.nav.nearestWalkable(this.position.x, this.position.z, out)) {
        this.position.x = out.x;
        this.position.z = out.z;
      }
      this.path = null;
      this.poseDirty = true;
      this.syncPose(0);
    }
  }

  // ---- volumes --------------------------------------------------------------------------

  /** Attaches a hit volume (collider in Groups.enemy) to this robot's kinematic body. */
  protected addHitVolume(desc: ColliderDesc, hitZone: HitZone): Collider {
    const collider = this.deps.ctx.physics.addCollider(
      desc.setCollisionGroups(Groups.enemy),
      { kind: 'enemy', damageable: this, hitZone, owner: this },
      this.body,
    );
    this.colliders.push(collider);
    return collider;
  }

  get hitVolumeCount(): number {
    return this.colliders.length;
  }

  // ---- destruction ----------------------------------------------------------------------

  /** Called when HP reaches 0: events, effects, colliders, mesh, registry. */
  protected destroy(): void {
    if (!this.alive_) return;
    this.alive_ = false;
    this.hp = 0;
    this.fsm.set('destroyed');
    const { ctx } = this.deps;
    this.onDestroyed();
    this.release();
    ctx.enemies.remove(this.id);
    const p = this.position.clone();
    ctx.events.emit('vfx:spawn', { kind: 'explosion', position: p });
    ctx.events.emit('enemy:destroyed', {
      id: this.id,
      type: this.type,
      position: p,
      remaining: ctx.enemies.aliveCount(),
    });
  }

  /** Silent teardown (module dispose): no events. */
  dispose(): void {
    const wasAlive = this.alive_;
    this.alive_ = false;
    this.release();
    if (wasAlive) this.deps.ctx.enemies.remove(this.id);
  }

  private released = false;

  private release(): void {
    if (this.released) return;
    this.released = true;
    this.deps.ctx.physics.removeBody(this.body);
    this.colliders.length = 0;
    this.root.removeFromParent();
    this.root.visible = false;
  }
}
