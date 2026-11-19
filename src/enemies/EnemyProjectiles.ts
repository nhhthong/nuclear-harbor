import { AdditiveBlending, Color, CylinderGeometry, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type BufferGeometry, type Material } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { GameContext } from '@/core/GameContext';
import { ObjectPool } from '@/core/ObjectPool';
import { QueryGroups } from '@/physics/groups';
import { splashDamage } from './army/splash';
import { ENEMY_PROJECTILE } from './tunables';

interface Bolt {
  mesh: Mesh;
  velocity: Vector3;
  speed: number;
  damage: number;
  life: number;
  travelled: number;
}

interface Rocket {
  mesh: Mesh;
  velocity: Vector3;
  speed: number;
  damage: number;
  splashRadius: number;
  life: number;
  travelled: number;
}

const origin = new Vector3();
const aimAt = new Vector3();
const axisPoint = new Vector3();
const blast = new Vector3();
const dir = new Vector3();
const toPlayer = new Vector3();
const closest = new Vector3();
const hitPoint = new Vector3();
const normalUp = new Vector3(0, 1, 0);

/** Distance along the segment at which it first enters the player's capsule, or -1. */
function segmentHitsCapsule(
  a: Vector3,
  d: Vector3,
  length: number,
  feet: Vector3,
  radius: number,
  height: number,
  out: Vector3,
): number {
  // Sample the segment at 0.25 m: bolts are small and fast, and the capsule is 0.9 m wide.
  const steps = Math.max(1, Math.ceil(length / 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * length;
    out.set(a.x + d.x * t, a.y + d.y * t, a.z + d.z * t);
    const dy = out.y < feet.y ? feet.y - out.y : out.y > feet.y + height ? out.y - (feet.y + height) : 0;
    const dx = out.x - feet.x;
    const dz = out.z - feet.z;
    if (dx * dx + dz * dz + dy * dy <= radius * radius) return t;
  }
  return -1;
}

/**
 * Pooled enemy bolts (GDD 13.4): at most `poolCap` alive; an empty pool drops the shot.
 * Each bolt advances per fixed tick as a ray segment against world + player (QueryGroups.enemyShot).
 */
/** Bolt look: the orange tracer of the robots, or the green plasma ball of the dragonfly drones (spec 29). */
export type BoltStyle = 'bolt' | 'plasma';

export class EnemyProjectiles {
  private readonly pool: ObjectPool<Bolt>;
  private readonly rockets: ObjectPool<Rocket>;
  private readonly looks: Record<BoltStyle, { geometry: BufferGeometry; material: Material }>;

  constructor(
    private readonly ctx: GameContext,
    res: ResourceTracker,
    capacity: number = ENEMY_PROJECTILE.poolCap,
  ) {
    const geometry = res.track(new SphereGeometry(ENEMY_PROJECTILE.radius, 8, 6));
    const material = res.track(new MeshBasicMaterial({ color: 0xff5a2a }));
    // drone plasma: the boss drone bolt look (additive green ball), bigger than the collision radius on purpose
    const plasma = Object.assign(
      new MeshBasicMaterial({ color: new Color(1.2, 3.0, 1.6), transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }),
      { toneMapped: false },
    );
    this.looks = {
      bolt: { geometry, material },
      plasma: { geometry: res.track(new SphereGeometry(ENEMY_PROJECTILE.plasmaRadius, 10, 8)), material: res.track(plasma) },
    };
    this.pool = new ObjectPool<Bolt>({
      capacity,
      create: () => {
        const mesh = new Mesh(geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        ctx.scene.add(mesh);
        return { mesh, velocity: new Vector3(), speed: 0, damage: 0, life: 0, travelled: 0 };
      },
      reset: (b) => {
        b.mesh.visible = false;
      },
      dispose: (b) => {
        b.mesh.removeFromParent();
      },
    });
    res.onDispose(() => this.pool.dispose());

    const rocketGeo = new CylinderGeometry(
      ENEMY_PROJECTILE.rocketRadius,
      ENEMY_PROJECTILE.rocketRadius * 0.6,
      ENEMY_PROJECTILE.rocketLength,
      8,
    );
    rocketGeo.rotateX(Math.PI / 2); // length along +Z (Object3D.lookAt points +Z at the target)
    const rocketGeometry = res.track(rocketGeo);
    const rocketMaterial = res.track(new MeshBasicMaterial({ color: 0xffb347 }));
    this.rockets = new ObjectPool<Rocket>({
      capacity: ENEMY_PROJECTILE.rocketPoolCap,
      create: () => {
        const mesh = new Mesh(rocketGeometry, rocketMaterial);
        mesh.visible = false;
        mesh.frustumCulled = false;
        ctx.scene.add(mesh);
        return { mesh, velocity: new Vector3(), speed: 0, damage: 0, splashRadius: 0, life: 0, travelled: 0 };
      },
      reset: (r) => {
        r.mesh.visible = false;
      },
      dispose: (r) => {
        r.mesh.removeFromParent();
      },
    });
    res.onDispose(() => this.rockets.dispose());
  }

  get liveRockets(): number {
    return this.rockets.liveCount;
  }

  get rocketCapacity(): number {
    return this.rockets.capacity;
  }

  get rocketsDropped(): number {
    return this.rockets.droppedCount;
  }

  /** Fires a slow, visible rocket that explodes with splash damage; false when the rocket pool is exhausted. */
  fireRocket(from: Vector3, direction: Vector3, speed: number, damage: number, splashRadius: number): boolean {
    const r = this.rockets.acquire();
    if (!r) return false;
    r.mesh.position.copy(from);
    r.velocity.copy(direction).normalize().multiplyScalar(speed);
    aimAt.copy(from).add(r.velocity);
    r.mesh.lookAt(aimAt);
    r.mesh.visible = true;
    r.speed = speed;
    r.damage = damage;
    r.splashRadius = splashRadius;
    r.life = ENEMY_PROJECTILE.rocketLifetime;
    r.travelled = 0;
    return true;
  }

  get liveCount(): number {
    return this.pool.liveCount;
  }

  get capacity(): number {
    return this.pool.capacity;
  }

  get droppedCount(): number {
    return this.pool.droppedCount;
  }

  /** Fires a bolt; returns false when the pool is exhausted (shot skipped). */
  fire(from: Vector3, direction: Vector3, speed: number, damage: number, style: BoltStyle = 'bolt'): boolean {
    const bolt = this.pool.acquire();
    if (!bolt) return false;
    const look = this.looks[style];
    bolt.mesh.geometry = look.geometry;
    bolt.mesh.material = look.material;
    bolt.mesh.position.copy(from);
    bolt.mesh.visible = true;
    bolt.velocity.copy(direction).normalize().multiplyScalar(speed);
    bolt.speed = speed;
    bolt.damage = damage;
    bolt.life = ENEMY_PROJECTILE.lifetime;
    bolt.travelled = 0;
    return true;
  }

  /** Advance every live bolt by one fixed tick. */
  step(dt: number): void {
    this.pool.forEachLive((b) => this.advance(b, dt));
    this.rockets.forEachLive((r) => this.advanceRocket(r, dt));
  }

  releaseAll(): void {
    this.pool.releaseAll();
    this.rockets.releaseAll();
  }

  private advanceRocket(r: Rocket, dt: number): void {
    const { ctx } = this;
    const length = r.speed * dt;
    origin.copy(r.mesh.position);
    dir.copy(r.velocity).divideScalar(r.speed);
    const hit = ctx.physics.raycast(origin, dir, length, { groups: QueryGroups.enemyShot });
    const worldDistance = hit ? hit.distance : length;

    let playerDistance = -1;
    if (ctx.player.alive && hit?.meta.kind !== 'player') {
      playerDistance = segmentHitsCapsule(
        origin,
        dir,
        worldDistance,
        ctx.player.position,
        ENEMY_PROJECTILE.fallbackPlayerRadius,
        ENEMY_PROJECTILE.fallbackPlayerHeight,
        closest,
      );
    }
    if (playerDistance >= 0 || (hit && hit.meta.kind === 'player')) {
      blast.copy(hit && hit.meta.kind === 'player' ? hit.point : closest);
      this.explode(r, blast);
      return;
    }
    if (hit) {
      blast.copy(hit.point).addScaledVector(dir, -0.15);
      this.explode(r, blast);
      return;
    }
    r.mesh.position.addScaledVector(dir, length);
    r.travelled += length;
    r.life -= dt;
    if (r.life <= 0 || r.travelled >= ENEMY_PROJECTILE.rocketMaxRange) this.rockets.release(r);
  }

  /** Splash on the player (linear falloff, measured to the player's capsule axis), explosion VFX, release. */
  private explode(r: Rocket, point: Vector3): void {
    const { ctx } = this;
    ctx.events.emit('vfx:spawn', { kind: 'explosion', position: point, normal: normalUp });
    if (ctx.player.alive) {
      const feet = ctx.player.position;
      axisPoint.set(feet.x, Math.min(Math.max(point.y, feet.y), feet.y + ENEMY_PROJECTILE.fallbackPlayerHeight), feet.z);
      const d = Math.max(0, point.distanceTo(axisPoint) - ENEMY_PROJECTILE.fallbackPlayerRadius);
      const amount = Math.round(splashDamage(d, r.splashRadius, r.damage));
      if (amount > 0) {
        toPlayer.copy(axisPoint).sub(point);
        if (toPlayer.lengthSq() < 1e-6) toPlayer.copy(dir);
        toPlayer.normalize();
        ctx.player.applyDamage({ amount, zone: 'body', source: 'enemy', point, direction: toPlayer });
      }
    }
    this.rockets.release(r);
  }

  private advance(b: Bolt, dt: number): void {
    const { ctx } = this;
    const length = b.speed * dt;
    origin.copy(b.mesh.position);
    dir.copy(b.velocity).divideScalar(b.speed);

    const hit = ctx.physics.raycast(origin, dir, length, { groups: QueryGroups.enemyShot });
    const worldDistance = hit ? hit.distance : length;

    // Fallback for a player without a physics collider: analytic capsule test along the segment.
    let playerDistance = -1;
    if (ctx.player.alive && hit?.meta.kind !== 'player') {
      playerDistance = segmentHitsCapsule(
        origin,
        dir,
        worldDistance,
        ctx.player.position,
        ENEMY_PROJECTILE.fallbackPlayerRadius,
        ENEMY_PROJECTILE.fallbackPlayerHeight,
        closest,
      );
    }

    if (playerDistance >= 0 || (hit && hit.meta.kind === 'player')) {
      const point = hit && hit.meta.kind === 'player' ? hit.point : closest;
      toPlayer.copy(dir);
      ctx.player.applyDamage({ amount: b.damage, zone: 'body', source: 'enemy', point, direction: toPlayer });
      this.pool.release(b);
      return;
    }
    if (hit) {
      hitPoint.copy(hit.point);
      ctx.events.emit('vfx:spawn', {
        kind: 'spark',
        position: hitPoint,
        normal: hit.normal.lengthSq() > 0 ? hit.normal : normalUp,
      });
      this.pool.release(b);
      return;
    }

    b.mesh.position.addScaledVector(dir, length);
    b.travelled += length;
    b.life -= dt;
    if (b.life <= 0 || b.travelled >= ENEMY_PROJECTILE.maxRange) this.pool.release(b);
  }
}
