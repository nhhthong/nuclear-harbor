import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CHARGER_ROBOT, SPHERE_ROBOT, SPIDER_ROBOT, WEAPON } from '@/config/tunables';
import { QueryGroups } from '@/physics/groups';
import type { SphereRobot } from './SphereRobot';
import { EnemyManager } from './EnemyManager';
import { addGround, makeTestWorld, type TestWorld } from './testUtils';

async function setup(params = 'enemies=none'): Promise<{ w: TestWorld; m: EnemyManager }> {
  const w = await makeTestWorld({ sandbox: true, params });
  addGround(w.physics);
  // container the robots must not cross
  w.physics.addStaticBox({ center: { x: 0, y: 1.2, z: -10 }, halfExtents: { x: 8, y: 1.2, z: 1.2 } });
  const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
  m.start();
  return { w, m };
}

function run(w: TestWorld, m: EnemyManager, seconds: number): void {
  const dt = w.clock.fixedDt;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    w.clock.simTime += dt;
    w.clock.fixedTick++;
    m.fixedUpdate(dt);
  }
}

function spawnSphere(m: EnemyManager, x: number, z: number, patrol: Vector3[] = []): SphereRobot {
  const e = m.spawn({ type: 'sphere', position: new Vector3(x, 0, z), patrol });
  if (!e) throw new Error('spawn failed');
  return e as SphereRobot;
}

describe('EnemyManager (headless physics)', () => {
  it('registers spawned robots with the right stats and removes them on destruction (AC1, AC2, AC6)', async () => {
    const { w, m } = await setup();
    const destroyed: Array<{ remaining: number }> = [];
    const damaged: string[] = [];
    w.events.on('enemy:destroyed', (e) => destroyed.push({ remaining: e.remaining }));
    w.events.on('enemy:damaged', (e) => damaged.push(e.zone));
    const a = spawnSphere(m, 0, 0);
    const b = spawnSphere(m, 10, 0);
    expect(w.ctx.enemies.aliveCount()).toBe(2);
    expect(a.hp).toBe(SPHERE_ROBOT.hp);
    expect(a.brainState).toBe('patrol');
    const collidersBefore = w.physics.colliderCount;
    expect(a.hitVolumeCount).toBe(2);

    // sensor = critical x2, body x1; the ray finds the sensor on the front (-Z) side
    w.physics.syncQueries();
    const hit = w.physics.raycast({ x: 0, y: SPHERE_ROBOT.hoverHeight + 0.15, z: -5 }, { x: 0, y: 0, z: 1 }, 10, {
      groups: QueryGroups.playerShot,
    });
    expect(hit?.meta.hitZone).toBe('critical');
    expect(hit?.meta.damageable).toBe(a);
    const r1 = a.applyDamage({ amount: 10, zone: 'critical', source: 'player' });
    expect(r1.dealt).toBe(10 * WEAPON.criticalMultiplier);
    const r2 = a.applyDamage({ amount: 10, zone: 'body', source: 'player' });
    expect(r2.dealt).toBe(10);
    expect(damaged).toEqual(['critical', 'body']);

    const kill = a.applyDamage({ amount: 1000, zone: 'body', source: 'player' });
    expect(kill.killed).toBe(true);
    expect(a.state).toBe('destroyed');
    expect(destroyed).toEqual([{ remaining: 1 }]);
    expect(w.ctx.enemies.get(a.id)).toBeUndefined();
    expect(w.physics.colliderCount).toBe(collidersBefore - 2);
    expect(a.applyDamage({ amount: 5, zone: 'body', source: 'player' }).absorbed).toBe(true);

    m.killAll();
    expect(w.ctx.enemies.aliveCount()).toBe(0);
    expect(m.robots).toHaveLength(0);
    expect(b.alive).toBe(false);
  });

  it('detects, chases, attacks and damages the player (AC2, AC5)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnSphere(m, 0, 22);
    const alerted: string[] = [];
    const attacked: string[] = [];
    w.events.on('enemy:alerted', (x) => alerted.push(x.id));
    w.events.on('enemy:attacked', (x) => attacked.push(x.id));
    const seen = new Set<string>();
    const dt = w.clock.fixedDt;
    for (let i = 0; i < 60 * 8; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      seen.add(e.state);
    }
    expect(alerted).toEqual([e.id]);
    expect(seen.has('chase')).toBe(true);
    expect(seen.has('attack')).toBe(true);
    expect(attacked.length).toBeGreaterThan(2);
    expect(w.ctx.player.hp).toBeLessThan(100);
    expect((100 - w.ctx.player.hp) % SPHERE_ROBOT.damage).toBe(0);
    // stops approaching at the preferred range
    const d = Math.hypot(e.position.x, e.position.z);
    expect(d).toBeLessThanOrEqual(SPHERE_ROBOT.attackRange * SPHERE_ROBOT.preferredRangeFactor + 1.5);
  });

  it('retreats once below 25% HP (AC2)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnSphere(m, 0, 12);
    run(w, m, 1.5);
    expect(e.state).toBe('attack');
    e.applyDamage({ amount: 80, zone: 'body', source: 'player' });
    run(w, m, 0.5);
    expect(e.state).toBe('retreat');
    run(w, m, 6);
    expect(e.state === 'chase' || e.state === 'attack').toBe(true);
  });

  it('never enters blocked cells or leaves the land while patrolling (AC3)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 38); // far away: pure patrol
    // patrol loop straight across the container row (z = -10, |x| < 8): must route around it
    const e = spawnSphere(m, -12, -4, [new Vector3(-12, 0, -4), new Vector3(12, 0, -16)]);
    const nav = m.nav!;
    let minZSeen = Infinity;
    const dt = w.clock.fixedDt;
    let crossed = false;
    for (let i = 0; i < 60 * 30; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      expect(nav.isWalkable(e.position.x, e.position.z)).toBe(true);
      const insideContainer = Math.abs(e.position.x) < 8 && Math.abs(e.position.z + 10) < 1.2;
      expect(insideContainer).toBe(false);
      expect(Math.abs(e.position.x)).toBeLessThanOrEqual(40);
      minZSeen = Math.min(minZSeen, e.position.z);
      if (e.position.x > 8 && e.position.z < -9) crossed = true;
    }
    expect(minZSeen).toBeLessThan(-12);
    expect(crossed).toBe(true);
  });

  it('moves at the configured speed (AC2)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 38);
    const e = spawnSphere(m, -30, 20, [new Vector3(30, 0, 20), new Vector3(-30, 0, 20)]);
    run(w, m, 0.2); // let the first think run
    const x0 = e.position.x;
    run(w, m, 2);
    expect((e.position.x - x0) / 2).toBeCloseTo(SPHERE_ROBOT.speed, 0);
  });

  it('keeps patrol progress and HP across sim levels (AC4)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(38, 0, -38);
    const loop = [new Vector3(-20, 0, 20), new Vector3(-10, 0, 20), new Vector3(-10, 0, 30)];
    const e = spawnSphere(m, -20, 20, loop);
    e.hp = 70;
    run(w, m, 4);
    const index = e.patrolIndex;
    const hp = e.hp;
    expect(index).toBeGreaterThan(0);

    e.simLevel = 'dormant';
    expect(e.simLevel).toBe('dormant');
    e.thinkDt = 1;
    for (let i = 0; i < 5; i++) e.runThink();
    expect(e.hp).toBe(hp);
    expect(e.state).toBe('patrol');
    expect(e.patrol).toHaveLength(3);

    e.simLevel = 'active';
    expect(m.nav!.isWalkable(e.position.x, e.position.z)).toBe(true);
    expect(e.hp).toBe(hp);
    run(w, m, 5);
    expect(e.state).toBe('patrol');
    expect(e.alive).toBe(true);
  });

  it('defend phase: robots in radius converge on the tower, others stay (AC7)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 39);
    const near = spawnSphere(m, -30, -30, [new Vector3(-30, 0, -30)]);
    const far = spawnSphere(m, 30, -35, [new Vector3(30, 0, -35)]);
    const tower = new Vector3(-10, 0, -30);
    m.onDefendStarted(tower, 30);
    run(w, m, 10);
    expect(Math.hypot(near.position.x - tower.x, near.position.z - tower.z)).toBeLessThan(4);
    expect(far.position.x).toBeCloseTo(30, 0);
    expect(w.ctx.enemies.aliveCount()).toBe(2); // nothing extra was spawned
  });

  it('respawn drops aggro (AC7 related)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnSphere(m, 0, 15);
    run(w, m, 1.5);
    expect(e.state).toBe('attack');
    w.ctx.player.position.set(-38, 0, 38);
    m.onRespawn();
    expect(e.state).toBe('patrol');
    run(w, m, 1);
    expect(e.state).toBe('patrol');
  });

  it('spider and charger placeholders keep their type and HP (AC8)', async () => {
    const { m } = await setup();
    const s = m.spawn({ type: 'spider', position: new Vector3(5, 0, 5), patrol: [] });
    const c = m.spawn({ type: 'charger', position: new Vector3(-5, 0, 5), patrol: [] });
    expect(s?.type).toBe('spider');
    expect(s?.maxHp).toBe(SPIDER_ROBOT.hp);
    expect(c?.type).toBe('charger');
    expect(c?.maxHp).toBe(CHARGER_ROBOT.hp);
  });

  it('sandbox ?enemies= spawns on world ready (AC1, AC8)', async () => {
    const w = await makeTestWorld({ sandbox: true, params: 'enemies=spider,charger,sphere' });
    addGround(w.physics);
    const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
    m.start();
    expect(w.ctx.enemies.all().map((e) => e.type).sort()).toEqual(['charger', 'sphere', 'spider']);
  });

  it('shares geometry and materials between robots of one type (AC9)', async () => {
    const { m } = await setup();
    const a = spawnSphere(m, 0, 0);
    const b = spawnSphere(m, 5, 0);
    const meshOf = (e: SphereRobot) => (e as unknown as { ball: { geometry: unknown; material: unknown } }).ball;
    expect(meshOf(a).geometry).toBe(meshOf(b).geometry);
    expect(meshOf(a).material).toBe(meshOf(b).material);
  });
});
