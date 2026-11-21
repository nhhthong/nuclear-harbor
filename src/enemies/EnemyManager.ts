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
import { PLAYER_SPAWN, SPAWN_SAFE_RADIUS, ZONES, zoneAt, type ZoneId } from '@/config/level';
import { AreaSpawner } from './areaSpawner';
import { droneRoster, getPopulation } from './population';
import { CallInDirector, callInSpawnPoints, clearWrecks, DRONE, onMezzanine, stepWrecks } from './drone';
import { ENEMY_LOCAL } from './tunables';
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
  private areas: AreaSpawner<BaseEnemy> | null = null;
  private quaySealed = false;
  private readonly fx = new Vector3();
  // ---- spec 29: anti-camping drone call-in (not part of the roster) ----
  private readonly callIn = new CallInDirector(DRONE.callIn);
  private readonly callIns = new Set<BaseEnemy>();

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
    // safe containers: the room (and half a metre in front of its door) is closed to robots
    const world = this.ctx.testHooks.world as { shelters?: Array<{ footprint: { minX: number; maxX: number; minZ: number; maxZ: number } }> } | undefined;
    for (const sh of world?.shelters ?? []) nav.blockRect(sh.footprint.minX, sh.footprint.minZ, sh.footprint.maxX, sh.footprint.maxZ);
    registerNav(this.ctx, nav);
    console.info(`[enemies] nav grid ${nav.cols}x${nav.rows}, ${nav.walkableCount} walkable cells, baked in ${ms.toFixed(1)} ms`);
    const population = getPopulation(this.ctx, nav);
    if (this.ctx.flags.sandbox) {
      for (const spawn of population) this.spawn(spawn);
      return;
    }
    // spec 29: the flying roster drones are streamed with the ground roster
    const all = [...population, ...droneRoster()];
    this.prewarm(all);
    // harbor: nothing is alive at load; the roster is streamed by area as the player moves
    const roster = all.map((spawn) => ({ spawn, zone: (zoneAt(spawn.position.x, spawn.position.z) ?? 'A') as ZoneId }));
    this.areas = new AreaSpawner<BaseEnemy>(roster, ZONES, ENEMY_LOCAL.area, {
      spawn: (s) => {
        const e = this.spawn(s);
        if (e) this.ctx.events.emit('vfx:spawn', { kind: 'pickup', position: this.fx.set(s.position.x, 1.2, s.position.z), scale: 2 });
        return e;
      },
      despawn: (e) => this.despawn(e),
    }, [{ x: PLAYER_SPAWN.position.x, z: PLAYER_SPAWN.position.z, radius: SPAWN_SAFE_RADIUS }], () => this.liveCallIns());
  }

  // ---- spec 29: anti-camping drone call-in ----------------------------------------------------

  private liveCallIns(): number {
    let n = 0;
    for (const e of this.callIns) {
      if (e.alive) n++;
      else this.callIns.delete(e);
    }
    return n;
  }

  private liveCount(): number {
    let n = 0;
    for (const e of this.robots) if (e.alive) n++;
    return n;
  }

  /** Player on the mezzanine for `DRONE.callIn.campSeconds`: drones come in from the north windows or the roller door. */
  private updateCallIn(dt: number): void {
    if (this.ctx.flags.sandbox) return;
    const p = this.ctx.player;
    const camping = p.alive && onMezzanine(p.position, DRONE.callIn.yMargin);
    const n = this.callIn.update(dt, camping, this.liveCallIns(), this.liveCount(), ENEMY_LOCAL.area.liveCap);
    if (n > 0) this.spawnCallIn(n, this.callIn.waves - 1);
  }

  /** Spawns `count` hunter drones outside the warehouse openings (test hook and the call-in). Returns their ids. */
  spawnCallIn(count: number, wave = 0): string[] {
    const ids: string[] = [];
    const pts = callInSpawnPoints(this.ctx.player.position, count, wave, { ...DRONE.opening, spawnOut: DRONE.callIn.spawnOut });
    for (const pt of pts) {
      const e = this.spawn({ type: 'drone', position: new Vector3(pt.x, pt.y, pt.z), patrol: [] });
      if (!e) continue;
      this.callIns.add(e);
      ids.push(e.id);
    }
    return ids;
  }

  /** Call-in state for tests and the debug overlay. */
  callInState(): { camp: number; called: number; alive: number } {
    return { camp: this.callIn.camp, called: this.callIn.called, alive: this.liveCallIns() };
  }

  /** Robots still to be destroyed in the harbor roster (live or not yet spawned). */
  get rosterRemaining(): number {
    return this.areas?.remaining ?? this.robots.length;
  }

  onDestroyed(id: string): void {
    this.areas?.onDestroyed(id);
  }

  /** Silent removal of a live robot (area streaming): no explosion, no drops, no kill event. */
  private despawn(e: BaseEnemy): void {
    e.dispose();
    const i = this.robots.indexOf(e);
    if (i >= 0) this.robots.splice(i, 1);
  }

  /**
   * Builds one robot of each type once and compiles its shaders while the level loads, so the first
   * robot that appears mid-game does not stall a frame.
   */
  private prewarm(population: readonly EnemySpawn[]): void {
    const seen = new Set<EnemyType>();
    const temp: BaseEnemy[] = [];
    for (const s of population) {
      if (seen.has(s.type)) continue;
      seen.add(s.type);
      const e = this.spawn(s);
      if (e) temp.push(e);
    }
    try {
      this.ctx.renderer.webgl.compile(this.ctx.scene, this.ctx.camera);
    } catch (error) {
      console.warn('[enemies] shader prewarm skipped:', error);
    }
    for (const e of temp) this.despawn(e);
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
    this.areas?.update(dt, player.position.x, player.position.z);
    this.updateCallIn(dt);
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
    stepWrecks(dt);
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

  /**
   * Spec 33: the boss quay is the boss's own ground. The roster has no robots there (`ENEMY_DISTRIBUTION.D` is
   * empty) and, once the tower is done and the gates open, the whole quay is closed to robots on the nav grid,
   * so robots from the yard and the court cannot follow the player into the fight. Called on
   * `objectives:allActivated`. Robots already in the quay (none by design) are left to finish.
   */
  sealBossQuay(): void {
    const nav = this.nav;
    if (!nav || this.quaySealed) return;
    this.quaySealed = true;
    const q = ZONES.D;
    nav.blockRect(q.minX, q.minZ, q.maxX, q.maxZ);
  }

  get isQuaySealed(): boolean {
    return this.quaySealed;
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
    this.callIns.clear();
    clearWrecks();
  }

  private prune(): void {
    for (let i = this.robots.length - 1; i >= 0; i--) {
      if (!this.robots[i]?.alive) this.robots.splice(i, 1);
    }
  }
}
