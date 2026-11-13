import { Quaternion, Vector3 } from 'three';
import type { Damageable, DamageInfo, DamageResult } from '@/core/types';
import { Groups } from '@/physics/groups';
import type { PhysicsWorld, RAPIER } from '@/physics/PhysicsWorld';
import { BODY_R, BODY_Y, EYE_LOCAL } from './BossBody';
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
const wpScratch = { x: 0, y: 0, z: 0 };

/**
 * One kinematic body in Groups.enemy: hull ball = armor, a ball on each knee = weak point (follows
 * the animated knee), leg boxes = armor, eye ball = core (created when exposed).
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
    knees: readonly Vector3[],
    bones: ReadonlyArray<{ hip: Vector3; knee: Vector3; foot: Vector3 }>,
  ) {
    const R = physics.rapier;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    const s = scale;
    this.armorZone = new ZoneDamageable('titan-04:armor', (i) => handlers.armor(i), handlers.alive);
    this.coreZone = new ZoneDamageable('titan-04:core', (i) => handlers.core(i), handlers.alive);

    physics.addCollider(
      R.ColliderDesc.ball(BODY_R * s).setTranslation(0, BODY_Y * s, 0).setCollisionGroups(Groups.enemy),
      { kind: 'boss', damageable: this.armorZone, hitZone: 'armor' },
      this.body,
    );

    knees.forEach((k, i) => {
      const zone = new ZoneDamageable(`titan-04:weakpoint-${i}`, (info) => handlers.weakPoint(i, info), handlers.alive);
      this.wpZones.push(zone);
      const c = physics.addCollider(
        R.ColliderDesc.ball(BOSS_LOCAL.weakPointHitRadius * s)
          .setTranslation(k.x * s, k.y * s, k.z * s)
          .setCollisionGroups(Groups.enemy),
        { kind: 'boss', damageable: zone, hitZone: 'weakpoint', owner: { weakPoint: i } },
        this.body,
      );
      this.weakPoints.push(c);
    });

    for (const b of bones) {
      this.addLegBox(b.hip, b.knee, 2.2, s);
      this.addLegBox(b.knee, b.foot, 2.4, s);
    }
  }

  /** Keep the weak point balls on the animated knees. */
  syncWeakPoints(knees: readonly Vector3[]): void {
    const s = this.scale;
    for (let i = 0; i < knees.length; i++) {
      const k = knees[i];
      const c = this.weakPoints[i];
      if (!k || !c) continue;
      wpScratch.x = k.x * s;
      wpScratch.y = k.y * s;
      wpScratch.z = k.z * s;
      c.setTranslationWrtParent(wpScratch);
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

  /** Core ball on the eye, slightly proud of the lens (only exists once exposed). */
  addCore(): void {
    if (this.core) return;
    const R = this.physics.rapier;
    const s = this.scale;
    this.core = this.physics.addCollider(
      R.ColliderDesc.ball(BOSS_LOCAL.coreRadius * s)
        .setTranslation(EYE_LOCAL.x * s, EYE_LOCAL.y * s, EYE_LOCAL.z * s)
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
