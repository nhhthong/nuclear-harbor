import { Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { GameContext } from '@/core/GameContext';
import type { EnemyType } from '@/core/types';
import { AIUpdateScheduler } from './AIUpdateScheduler';
import type { BaseEnemy, EnemyDeps, EnemySpawn } from './BaseEnemy';
import { EnemyProjectiles } from './EnemyProjectiles';
import { ENEMY_FACTORIES } from './factories';
import { bakeNav, registerNav } from './nav/bakeNav';
import type { NavGrid } from './nav/NavGrid';
import { getPopulation } from './population';
import { SharedAssets } from './SharedAssets';

export interface EnemySnapshot {
  id: string;
  type: EnemyType;
  state: string;
  hp: number;
  simLevel: string;
  x: number;
  y: number;
  z: number;
}

/** Owns the live robots: spawning, scheduling, stepping, projectiles and cleanup. */
export class EnemyManager {
  /** Live robots; shared with `EnemyDeps.enemies` for separation. */
  readonly robots: BaseEnemy[] = [];
  readonly scheduler = new AIUpdateScheduler();
  readonly projectiles: EnemyProjectiles;
  nav: NavGrid | null = null;

  private readonly shared: SharedAssets;
  private readonly thinking: BaseEnemy[] = [];
  private time = 0;

  constructor(
    private readonly ctx: GameContext,
    res: ResourceTracker,
  ) {
    this.shared = new SharedAssets(res);
    this.projectiles = new EnemyProjectiles(ctx, res);
  }

  /** Bakes the nav grid and spawns the population (on `world:ready`). */
  start(): void {
    const { nav, ms } = bakeNav(this.ctx);
    this.nav = nav;
    registerNav(this.ctx, nav);
    console.info(`[enemies] nav grid ${nav.cols}x${nav.rows}, ${nav.walkableCount} walkable cells, baked in ${ms.toFixed(1)} ms`);
    for (const spawn of getPopulation(this.ctx, nav)) this.spawn(spawn);
  }

  spawn(spawn: EnemySpawn): BaseEnemy | null {
    const nav = this.nav;
    if (!nav) return null;
    const deps: EnemyDeps = {
      ctx: this.ctx,
      nav,
      projectiles: this.projectiles,
      scheduler: this.scheduler,
      shared: this.shared,
      enemies: this.robots,
    };
    const enemy = ENEMY_FACTORIES[spawn.type](deps, spawn);
    this.robots.push(enemy);
    this.ctx.enemies.add(enemy);
    this.ctx.events.emit('enemy:spawned', { id: enemy.id, type: enemy.type, position: enemy.position });
    return enemy;
  }

  fixedUpdate(dt: number): void {
    if (!this.nav) return;
    this.prune();
    const player = this.ctx.player;
    this.scheduler.update(this.robots, player.position.x, player.position.z, dt, this.thinking);
    for (let i = 0; i < this.thinking.length; i++) this.thinking[i]?.runThink();
    for (let i = 0; i < this.robots.length; i++) {
      const e = this.robots[i];
      if (!e?.alive) continue;
      if (e.simLevel === 'dormant') e.tickDormant(dt);
      else e.step(dt);
    }
    this.projectiles.step(dt);
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = 0; i < this.robots.length; i++) {
      const e = this.robots[i];
      if (e?.alive && e.simLevel === 'active') e.animate(dt, this.time);
    }
  }

  /** Defend phase (REVIEW #6): robots within the radius converge on the tower; nothing spawns. */
  onDefendStarted(position: Vector3, radius: number): void {
    for (const e of this.robots) {
      if (!e.alive) continue;
      if (Math.hypot(e.position.x - position.x, e.position.z - position.z) <= radius) e.commandMoveTo(position);
    }
  }

  /** Respawn: every robot forgets the player. */
  onRespawn(): void {
    for (const e of this.robots) if (e.alive) e.dropTarget();
    this.projectiles.releaseAll();
  }

  snapshot(): EnemySnapshot[] {
    return this.robots
      .filter((e) => e.alive)
      .map((e) => ({
        id: e.id,
        type: e.type,
        state: e.state,
        hp: e.hp,
        simLevel: e.simLevel,
        x: e.position.x,
        y: e.position.y,
        z: e.position.z,
      }));
  }

  killAll(): void {
    for (const e of [...this.robots]) {
      if (e.alive) e.applyDamage({ amount: e.maxHp * 10, zone: 'body', source: 'environment' });
    }
    this.prune();
  }

  dispose(): void {
    for (const e of this.robots) e.dispose();
    this.robots.length = 0;
    this.thinking.length = 0;
    this.projectiles.releaseAll();
  }

  private prune(): void {
    for (let i = this.robots.length - 1; i >= 0; i--) {
      if (!this.robots[i]?.alive) this.robots.splice(i, 1);
    }
  }
}
