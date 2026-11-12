import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { GameContext } from '@/core/GameContext';
import { ObjectPool } from '@/core/ObjectPool';
import { QueryGroups } from '@/physics/groups';
import { ENEMY_PROJECTILE } from './tunables';

interface Bolt {
  mesh: Mesh;
  velocity: Vector3;
  speed: number;
  damage: number;
  life: number;
  travelled: number;
}

const origin = new Vector3();
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
export class EnemyProjectiles {
  private readonly pool: ObjectPool<Bolt>;

  constructor(
    private readonly ctx: GameContext,
    res: ResourceTracker,
    capacity: number = ENEMY_PROJECTILE.poolCap,
  ) {
    const geometry = res.track(new SphereGeometry(ENEMY_PROJECTILE.radius, 8, 6));
    const material = res.track(new MeshBasicMaterial({ color: 0xff5a2a }));
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
  fire(from: Vector3, direction: Vector3, speed: number, damage: number): boolean {
    const bolt = this.pool.acquire();
    if (!bolt) return false;
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
  }

  releaseAll(): void {
    this.pool.releaseAll();
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
