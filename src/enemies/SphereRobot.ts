import { Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { SPHERE_ROBOT } from '@/config/tunables';
import type { DamageInfo, DamageResult, EnemyType } from '@/core/types';
import { BaseEnemy, type EnemyDeps, type EnemySpawn } from './BaseEnemy';
import { forgetTarget, markAware, type Perception } from './perception';
import { decideSphere, type SphereState } from './sphereBrain';
import { ENEMY_LOCAL } from './tunables';

/** Look and HP of a sphere-based robot; the spider and charger placeholders reuse the sphere. */
export interface SphereVariant {
  type: EnemyType;
  hp: number;
  color: number;
}

export const SPHERE_VARIANT: SphereVariant = { type: 'sphere', hp: SPHERE_ROBOT.hp, color: 0x8d949c };

const aim = new Vector3();
const shotDir = new Vector3();
const shotFrom = new Vector3();
const awayDir = new Vector3();

/**
 * Sphere robot (GDD 6.1): patrol -> detect -> chase -> attack -> retreat (once, below 25% HP) ->
 * destroyed. Decisions run in `think` (scheduled), actions (movement, firing) in `step`.
 */
export class SphereRobot extends BaseEnemy {
  private hasRetreated = false;
  private commanded = false;
  private readonly commandTarget = new Vector3();
  private fireCooldown = 0;
  private readonly ball: Mesh;
  private readonly phase = Math.random() * Math.PI * 2;

  constructor(
    deps: EnemyDeps,
    spawn: EnemySpawn,
    private readonly variant: SphereVariant = SPHERE_VARIANT,
  ) {
    super(
      deps,
      spawn,
      {
        type: variant.type,
        maxHp: variant.hp,
        centerHeight: SPHERE_ROBOT.hoverHeight,
        radius: SPHERE_ROBOT.radius,
        speed: SPHERE_ROBOT.speed,
        perceptionRange: SPHERE_ROBOT.detectionRange,
      },
      'patrol',
    );

    const { shared } = deps;
    const key = `sphere:${variant.color}`;
    const bodyGeo = shared.get('sphere:body-geo', () => new SphereGeometry(SPHERE_ROBOT.radius, 20, 14));
    const sensorGeo = shared.get('sphere:sensor-geo', () => new SphereGeometry(ENEMY_LOCAL.sensorRadius, 10, 8));
    const bodyMat = shared.get(
      `${key}:body-mat`,
      () => new MeshStandardMaterial({ color: variant.color, metalness: 0.85, roughness: 0.35 }),
    );
    const sensorMat = shared.get(
      'sphere:sensor-mat',
      () => new MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a1a, emissiveIntensity: 1.5 }),
    );
    this.ball = new Mesh(bodyGeo, bodyMat);
    this.ball.castShadow = true;
    // forward is -Z in local space (yaw 0 faces north, like the player)
    const sensorOffset = SPHERE_ROBOT.radius * ENEMY_LOCAL.sensorForwardFactor;
    const sensor = new Mesh(sensorGeo, sensorMat);
    sensor.position.set(0, ENEMY_LOCAL.sensorUp, -sensorOffset);
    this.root.add(this.ball, sensor);

    const { ColliderDesc } = deps.ctx.physics.rapier;
    this.addHitVolume(ColliderDesc.ball(SPHERE_ROBOT.radius), 'body');
    this.addHitVolume(
      ColliderDesc.ball(ENEMY_LOCAL.sensorRadius).setTranslation(0, ENEMY_LOCAL.sensorUp, -sensorOffset),
      'critical',
    );
  }

  get brainState(): SphereState {
    return this.fsm.state as SphereState;
  }

  protected think(_dt: number, p: Perception): void {
    const { ctx } = this.deps;
    const wp = this.currentWaypoint();
    const arrived = this.commanded && this.distanceTo(this.commandTarget) <= ENEMY_LOCAL.commandArriveRadius;
    const previous = this.brainState;
    const next = decideSphere({
      state: previous,
      timeInState: this.fsm.timeInState,
      distance: p.distance,
      hasLos: p.hasLos,
      timeSinceSeen: p.timeSinceSeen,
      hpFraction: this.hp / this.maxHp,
      hasRetreated: this.hasRetreated,
      commanded: this.commanded && !arrived,
      commandArrived: arrived,
      playerAlive: p.playerAlive,
    });
    if (arrived) this.commanded = false;

    if (this.fsm.set(next)) {
      if (next === 'retreat') this.hasRetreated = true;
      if (next === 'attack') this.fireCooldown = Math.max(this.fireCooldown, ENEMY_LOCAL.firstShotDelay);
      if (previous === 'patrol' && next === 'chase' && (p.hasLos || p.timeSinceSeen < SPHERE_ROBOT.loseTargetTime)) {
        ctx.events.emit('enemy:alerted', { id: this.id, type: this.type, position: this.position });
      }
    }

    this.lockFacing = false;
    switch (this.brainState) {
      case 'patrol':
        this.patrolTick(wp);
        break;
      case 'chase': {
        const tracking = p.hasLos || p.timeSinceSeen < SPHERE_ROBOT.loseTargetTime;
        if (tracking) {
          const t = p.hasLos ? ctx.player.position : p.lastSeenPos;
          this.setGoal(t.x, t.z);
        } else {
          this.setGoal(this.commandTarget.x, this.commandTarget.z);
        }
        this.moveSpeed = SPHERE_ROBOT.speed;
        break;
      }
      case 'attack': {
        this.lockFacing = true;
        this.face(ctx.player.position.x, ctx.player.position.z);
        if (p.distance > SPHERE_ROBOT.attackRange * SPHERE_ROBOT.preferredRangeFactor) {
          this.setGoal(ctx.player.position.x, ctx.player.position.z);
          this.moveSpeed = SPHERE_ROBOT.speed;
        } else {
          this.moveSpeed = 0;
        }
        break;
      }
      case 'retreat': {
        this.lockFacing = true;
        this.face(ctx.player.position.x, ctx.player.position.z);
        awayDir.set(this.position.x - ctx.player.position.x, 0, this.position.z - ctx.player.position.z);
        if (awayDir.lengthSq() < 1e-6) awayDir.set(1, 0, 0);
        awayDir.normalize();
        this.setGoal(
          this.position.x + awayDir.x * ENEMY_LOCAL.retreatDistance,
          this.position.z + awayDir.z * ENEMY_LOCAL.retreatDistance,
        );
        this.moveSpeed = SPHERE_ROBOT.speed;
        break;
      }
      default:
        this.moveSpeed = 0;
    }
  }

  private patrolTick(wp: Vector3 | null): void {
    if (!wp) {
      this.clearGoal();
      this.moveSpeed = 0;
      return;
    }
    if (this.distanceTo(wp) <= ENEMY_LOCAL.arriveRadius) {
      if (this.patrol.length > 1) this.advanceWaypoint();
      else {
        this.moveSpeed = 0;
        return;
      }
    }
    const target = this.currentWaypoint();
    if (!target) return;
    this.setGoal(target.x, target.z);
    this.moveSpeed = SPHERE_ROBOT.speed;
  }

  private distanceTo(v: Vector3): number {
    return Math.hypot(v.x - this.position.x, v.z - this.position.z);
  }

  override step(dt: number): void {
    super.step(dt);
    if (!this.alive) return;
    this.fireCooldown -= dt;
    if (this.brainState !== 'attack' || this.fireCooldown > 0) return;
    const p = this.perception;
    if (!p.hasLos || p.distance > SPHERE_ROBOT.attackRange) return;
    this.fireCooldown = SPHERE_ROBOT.fireInterval;
    const { ctx, projectiles } = this.deps;
    aim.set(ctx.player.position.x, ctx.player.position.y + ENEMY_LOCAL.aimHeight, ctx.player.position.z);
    shotDir.subVectors(aim, this.position).normalize();
    shotFrom.copy(this.position).addScaledVector(shotDir, SPHERE_ROBOT.radius + 0.25);
    if (projectiles.fire(shotFrom, shotDir, SPHERE_ROBOT.projectileSpeed, SPHERE_ROBOT.damage)) {
      ctx.events.emit('enemy:attacked', { id: this.id, type: this.type, position: this.position });
    }
  }

  protected onCommand(target: Vector3): void {
    this.commanded = true;
    this.commandTarget.copy(target);
    this.patrol = [target.clone()];
    this.patrolIndex = 0;
    if (this.brainState === 'patrol') this.fsm.set('chase');
    this.setGoal(target.x, target.z, true);
    this.moveSpeed = SPHERE_ROBOT.speed;
  }

  dropTarget(): void {
    forgetTarget(this.perception);
    this.commanded = false;
    if (this.brainState !== 'destroyed') this.fsm.set('patrol');
    this.clearGoal();
    this.moveSpeed = 0;
  }

  protected override onDamaged(_info: DamageInfo, _result: DamageResult): void {
    markAware(this.deps.ctx, this.perception);
  }

  override animate(dt: number, time: number): void {
    const bob = Math.sin(time * ENEMY_LOCAL.bobSpeed + this.phase) * ENEMY_LOCAL.bobAmplitude;
    this.root.position.y = this.position.y + bob;
    if (this.moveSpeed > 0 && this.hasGoal) this.ball.rotation.x -= (this.moveSpeed * dt) / SPHERE_ROBOT.radius;
  }

  get visualColor(): number {
    return this.variant.color;
  }
}
