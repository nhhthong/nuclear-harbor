import { Quaternion, Vector3 } from 'three';
import { BOSS } from '@/config/tunables';
import type { Damageable, DamageInfo, DamageResult } from '@/core/types';
import { Groups } from '@/physics/groups';
import type { PhysicsWorld, RAPIER } from '@/physics/PhysicsWorld';
import { BODY_R, BODY_Y, HATCH_DIR, WEAK_POINT_DIRS, legFootRest, legPose } from './BossBody';
import { BOSS_LOCAL } from './tunables';

export interface ZoneHandlers {
  armor(info: DamageInfo): DamageResult;
  weakPoint(index: number, info: DamageInfo): DamageResult;
  core(info: DamageInfo): DamageResult;
  /** True while the boss can still be hit at all (not collapsed). */
  alive(): boolean;
}

class ZoneDamageable implements Damageable {
  readonly kind = 'boss' as const;
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

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const dir = new Vector3();
const hip = new Vector3();
const knee = new Vector3();
const foot = new Vector3();

/**
 * One kinematic body in Groups.enemy: hull = armor, small balls proud of the hull = weak points,
 * leg boxes = armor, core ball = core (created when exposed).
 */
export class BossColliders {
  readonly body: RAPIER.RigidBody;
  private readonly weakPoints: Array<RAPIER.Collider | null> = [];
  private core: RAPIER.Collider | null = null;
  private readonly armorZone: ZoneDamageable;
  private readonly coreZone: ZoneDamageable;
  private readonly wpZones: ZoneDamageable[] = [];

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly scale: number,
    handlers: ZoneHandlers,
  ) {
    const R = physics.rapier;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const s = scale;
    this.armorZone = new ZoneDamageable('titan-04:armor', (i) => handlers.armor(i), handlers.alive);
    this.coreZone = new ZoneDamageable('titan-04:core', (i) => handlers.core(i), handlers.alive);

    // hull
    physics.addCollider(
      R.ColliderDesc.ball(BODY_R * s).setTranslation(0, BODY_Y * s, 0).setCollisionGroups(Groups.enemy),
      { kind: 'boss', damageable: this.armorZone, hitZone: 'armor' },
      this.body,
    );

    // weak points
    WEAK_POINT_DIRS.forEach((d, i) => {
      const zone = new ZoneDamageable(`titan-04:weakpoint-${i}`, (info) => handlers.weakPoint(i, info), handlers.alive);
      this.wpZones.push(zone);
      const dist = (BODY_R + BOSS_LOCAL.weakPointProud) * s;
      const c = physics.addCollider(
        R.ColliderDesc.ball(BOSS.weakPointRadius * s)
          .setTranslation(d.x * dist, BODY_Y * s + d.y * dist, d.z * dist)
          .setCollisionGroups(Groups.enemy),
        { kind: 'boss', damageable: zone, hitZone: 'weakpoint', owner: { weakPoint: i } },
        this.body,
      );
      this.weakPoints.push(c);
    });

    // legs: two boxes each in the standing pose
    for (let i = 0; i < BOSS.legCount; i++) {
      legFootRest(i, foot);
      legPose(i, foot, hip, knee);
      this.addLegBox(hip, knee, 1.5, s);
      this.addLegBox(knee, foot, 1.1, s);
    }
  }

  private addLegBox(a: Vector3, b: Vector3, thickness: number, s: number): void {
    const R = this.physics.rapier;
    dir.copy(b).sub(a);
    const len = dir.length();
    dir.multiplyScalar(1 / len);
    q.setFromUnitVectors(UP, dir);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const mz = (a.z + b.z) / 2;
    this.physics.addCollider(
      R.ColliderDesc.cuboid((thickness / 2) * s, (len / 2) * s, (thickness / 2) * s)
        .setTranslation(mx * s, my * s, mz * s)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(Groups.enemy),
      { kind: 'boss', damageable: this.armorZone, hitZone: 'armor' },
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

  /** The destroyed weak point no longer takes hits: shots reach the armour behind it. */
  removeWeakPoint(index: number): void {
    const c = this.weakPoints[index];
    if (!c) return;
    this.physics.removeCollider(c);
    this.weakPoints[index] = null;
  }

  /** Core ball, slightly proud of the hull at the hatch (only exists once exposed). */
  addCore(): void {
    if (this.core) return;
    const R = this.physics.rapier;
    const s = this.scale;
    const d = BODY_R * BOSS_LOCAL.coreDepth;
    this.core = this.physics.addCollider(
      R.ColliderDesc.ball(BOSS_LOCAL.coreRadius * s)
        .setTranslation(HATCH_DIR.x * d * s, (BODY_Y + HATCH_DIR.y * d) * s, HATCH_DIR.z * d * s)
        .setCollisionGroups(Groups.enemy),
      { kind: 'boss', damageable: this.coreZone, hitZone: 'core' },
      this.body,
    );
  }

  dispose(): void {
    this.physics.removeBody(this.body);
    this.weakPoints.length = 0;
    this.core = null;
  }
}
