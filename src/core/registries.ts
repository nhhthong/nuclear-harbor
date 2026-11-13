import { Vector3 } from 'three';
import type { Enemy, EnemyType, GrappleAnchor } from './types';

/**
 * Registry of grapple anchors (GDD 4.1, 7.4). World tickets register anchors, the grapple ticket
 * and the coverage debug tool query them. Pure data: no three.js scene or physics access.
 */
export class GrappleAnchorRegistry {
  private readonly anchors = new Map<string, GrappleAnchor>();

  add(anchor: GrappleAnchor): void {
    if (this.anchors.has(anchor.id)) throw new Error(`Duplicate grapple anchor id "${anchor.id}"`);
    this.anchors.set(anchor.id, anchor);
  }

  remove(id: string): boolean {
    return this.anchors.delete(id);
  }

  get(id: string): GrappleAnchor | undefined {
    return this.anchors.get(id);
  }

  all(): readonly GrappleAnchor[] {
    return [...this.anchors.values()];
  }

  get size(): number {
    return this.anchors.size;
  }

  /** Anchors whose attach point is within `range` of `from`, nearest first. */
  inRange(from: Vector3, range: number): GrappleAnchor[] {
    const rangeSq = range * range;
    return [...this.anchors.values()]
      .filter((a) => a.position.distanceToSquared(from) <= rangeSq)
      .sort((a, b) => a.position.distanceToSquared(from) - b.position.distanceToSquared(from));
  }

  nearest(from: Vector3, range = Infinity): GrappleAnchor | null {
    let best: GrappleAnchor | null = null;
    let bestSq = range * range;
    for (const anchor of this.anchors.values()) {
      const d = anchor.position.distanceToSquared(from);
      if (d <= bestSq) {
        best = anchor;
        bestSq = d;
      }
    }
    return best;
  }

  /**
   * Coverage rule check (GDD 7.4): share of sample points (eye positions) that have at least one
   * anchor within `range`. Line-of-sight is NOT considered here; the debug tool in T-04 adds it.
   */
  coverage(samples: readonly Vector3[], range: number): { covered: number; total: number; uncovered: Vector3[] } {
    const uncovered: Vector3[] = [];
    for (const sample of samples) {
      if (!this.nearest(sample, range)) uncovered.push(sample);
    }
    return { covered: samples.length - uncovered.length, total: samples.length, uncovered };
  }

  clear(): void {
    this.anchors.clear();
  }
}

/** Registry of live enemies. Owned by the enemies module; read by objectives, boss, HUD, pickups. */
export class EnemyRegistry {
  private readonly enemies = new Map<string, Enemy>();

  add(enemy: Enemy): void {
    if (this.enemies.has(enemy.id)) throw new Error(`Duplicate enemy id "${enemy.id}"`);
    this.enemies.set(enemy.id, enemy);
  }

  remove(id: string): boolean {
    return this.enemies.delete(id);
  }

  get(id: string): Enemy | undefined {
    return this.enemies.get(id);
  }

  all(): readonly Enemy[] {
    return [...this.enemies.values()];
  }

  alive(type?: EnemyType): Enemy[] {
    return [...this.enemies.values()].filter((e) => e.alive && (type === undefined || e.type === type));
  }

  aliveCount(type?: EnemyType): number {
    let n = 0;
    for (const e of this.enemies.values()) if (e.alive && (type === undefined || e.type === type)) n++;
    return n;
  }

  inRadius(center: Vector3, radius: number): Enemy[] {
    const rSq = radius * radius;
    return [...this.enemies.values()].filter((e) => e.alive && e.position.distanceToSquared(center) <= rSq);
  }

  clear(): void {
    this.enemies.clear();
  }
}
