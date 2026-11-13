import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ARMY_ROBOT, WEAPON } from '@/config/tunables';
import { DUCK } from './duck/tunables';
import { SPOT } from './spot/tunables';
import { QueryGroups } from '@/physics/groups';
import type { ArmyRobot } from './army/ArmyRobot';
import { ARMY_LOCAL } from './army/tunables';
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

function spawnMech(m: EnemyManager, x: number, z: number, patrol: Vector3[] = []): ArmyRobot {
  const e = m.spawn({ type: 'army', position: new Vector3(x, 0, z), patrol });
  if (!e) throw new Error('spawn failed');
  return e as ArmyRobot;
}

describe('EnemyManager (headless physics)', () => {
  it('registers spawned robots with the right stats and removes them on destruction (AC1, AC2, AC6)', async () => {
    const { w, m } = await setup();
    const destroyed: Array<{ remaining: number }> = [];
    const damaged: string[] = [];
    w.events.on('enemy:destroyed', (e) => destroyed.push({ remaining: e.remaining }));
    w.events.on('enemy:damaged', (e) => damaged.push(e.zone));
    const a = spawnMech(m, 0, 0);
    const b = spawnMech(m, 10, 0);
    expect(w.ctx.enemies.aliveCount()).toBe(2);
    expect(a.hp).toBe(ARMY_ROBOT.hp);
    expect(a.brainState).toBe('patrol');
    const collidersBefore = w.physics.colliderCount;
    expect(a.hitVolumeCount).toBe(3);

    // head = critical x2 (front, -Z), torso = body x1
    w.physics.syncQueries();
    const head = ARMY_LOCAL.centerHeight + ARMY_LOCAL.hit.head.y;
    const hit = w.physics.raycast({ x: 0, y: head, z: -5 }, { x: 0, y: 0, z: 1 }, 10, { groups: QueryGroups.playerShot });
    expect(hit?.meta.hitZone).toBe('critical');
    expect(hit?.meta.damageable).toBe(a);
    const chest = ARMY_LOCAL.centerHeight - 0.1;
    const hit2 = w.physics.raycast({ x: 0, y: chest, z: -5 }, { x: 0, y: 0, z: 1 }, 10, { groups: QueryGroups.playerShot });
    expect(hit2?.meta.hitZone).toBe('body');
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
    expect(w.physics.colliderCount).toBe(collidersBefore - 3);
    expect(a.applyDamage({ amount: 5, zone: 'body', source: 'player' }).absorbed).toBe(true);

    m.killAll();
    expect(w.ctx.enemies.aliveCount()).toBe(0);
    expect(m.robots).toHaveLength(0);
    expect(b.alive).toBe(false);
  });

  it('detects, advances to the firing band, fires rocket salvos and damages the player (AC2, AC5)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnMech(m, 0, 28);
    const alerted: string[] = [];
    const attacked: number[] = [];
    w.events.on('enemy:alerted', (x) => alerted.push(x.id));
    w.events.on('enemy:attacked', () => attacked.push(w.clock.simTime));
    const seen = new Set<string>();
    const dt = w.clock.fixedDt;
    let minD = Infinity;
    let maxD = 0;
    for (let i = 0; i < 60 * 14; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      seen.add(e.state);
      if (e.state === 'engage') {
        const d = Math.hypot(e.position.x, e.position.z);
        minD = Math.min(minD, d);
        maxD = Math.max(maxD, d);
      }
    }
    expect(alerted).toEqual([e.id]);
    expect(seen.has('advance')).toBe(true);
    expect(seen.has('engage')).toBe(true);
    expect(attacked.length).toBeGreaterThanOrEqual(2);
    expect(w.ctx.player.hp).toBeLessThan(100);
    // direct rocket hits do the centre damage
    expect((100 - w.ctx.player.hp) % ARMY_ROBOT.damage).toBe(0);
    expect(minD).toBeGreaterThan(ARMY_ROBOT.bandMin - 3);
    expect(maxD).toBeLessThan(ARMY_ROBOT.bandMax * ARMY_LOCAL.engageHysteresis + 1);
    // two salvos are at least the cooldown apart
    const gaps = attacked.slice(1).map((t, i) => t - (attacked[i] ?? 0));
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(ARMY_ROBOT.cooldown);
  });

  it('backs off while facing the player when it comes closer than 8 m (AC2)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnMech(m, 0, 6);
    run(w, m, 1);
    expect(e.state).toBe('retreat');
    const d0 = Math.hypot(e.position.x, e.position.z);
    run(w, m, 3);
    expect(Math.hypot(e.position.x, e.position.z)).toBeGreaterThan(d0 + 1);
    run(w, m, 8);
    expect(['advance', 'engage']).toContain(e.state);
  });

  it('never enters blocked cells or leaves the land while patrolling (AC3)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 38); // far away: pure patrol
    // patrol loop straight across the container row (z = -10, |x| < 8): must route around it
    const e = spawnMech(m, -12, -4, [new Vector3(-12, 0, -4), new Vector3(12, 0, -16)]);
    const nav = m.nav!;
    let minZSeen = Infinity;
    const dt = w.clock.fixedDt;
    let crossed = false;
    for (let i = 0; i < 60 * 45; i++) {
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

  it('patrols slowly at the configured speed and accelerates smoothly (AC2)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(38, 0, 38);
    const e = spawnMech(m, -38, 20, [new Vector3(0, 0, 20), new Vector3(-38, 0, 20)]);
    // first ticks: speed ramps up, never jumps
    let prev = 0;
    let maxStep = 0;
    const dt = w.clock.fixedDt;
    for (let i = 0; i < 60 * 6; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      maxStep = Math.max(maxStep, Math.abs(e.speed - prev));
      prev = e.speed;
    }
    expect(maxStep).toBeLessThanOrEqual(ARMY_ROBOT.decel * dt + 1e-9);
    const x0 = e.position.x;
    run(w, m, 2);
    const v = (e.position.x - x0) / 2;
    expect(v).toBeGreaterThan(ARMY_ROBOT.speed * 0.9);
    expect(v).toBeLessThan(ARMY_ROBOT.speed * 1.1);
  });

  it('keeps patrol progress and HP across sim levels (AC4)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(38, 0, -38);
    const loop = [new Vector3(-20, 0, 20), new Vector3(-10, 0, 20), new Vector3(-10, 0, 30)];
    const e = spawnMech(m, -20, 20, loop);
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
    const near = spawnMech(m, -30, -30, [new Vector3(-30, 0, -30)]);
    const far = spawnMech(m, 30, -35, [new Vector3(30, 0, -35)]);
    const tower = new Vector3(-10, 0, -30);
    m.onDefendStarted(tower, 30);
    run(w, m, 14);
    expect(Math.hypot(near.position.x - tower.x, near.position.z - tower.z)).toBeLessThan(4);
    expect(far.position.x).toBeCloseTo(30, 0);
    expect(w.ctx.enemies.aliveCount()).toBe(2); // nothing extra was spawned
  });

  it('respawn drops aggro (AC7 related)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnMech(m, 0, 20);
    run(w, m, 1.5);
    expect(e.state).toBe('engage');
    w.ctx.player.position.set(-38, 0, 38);
    m.onRespawn();
    expect(e.state).toBe('patrol');
    run(w, m, 1);
    expect(e.state).toBe('patrol');
    expect(m.projectiles.liveRockets).toBe(0);
  });

  it('Spot (spot id) and Bomber Duck (duck id) keep their type and use their own HP (AC8)', async () => {
    const { m } = await setup();
    const s = m.spawn({ type: 'spot', position: new Vector3(5, 0, 5), patrol: [] });
    const c = m.spawn({ type: 'duck', position: new Vector3(-5, 0, 5), patrol: [] });
    expect(s?.type).toBe('spot');
    expect(s?.maxHp).toBe(SPOT.hp);
    expect(c?.type).toBe('duck');
    expect(c?.maxHp).toBe(DUCK.hp);
  });

  it('sandbox ?enemies= spawns on world ready (AC1, AC8)', async () => {
    const w = await makeTestWorld({ sandbox: true, params: 'enemies=spot,duck,army' });
    addGround(w.physics);
    const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
    m.start();
    expect(w.ctx.enemies.all().map((e) => e.type).sort()).toEqual(['army', 'duck', 'spot']);
  });

  it('shares geometry and materials between robots of one type (AC9)', async () => {
    const { m } = await setup();
    const a = spawnMech(m, 0, 0);
    const b = spawnMech(m, 5, 0);
    const glowOf = (e: ArmyRobot) => (e as unknown as { glowMesh: { geometry: unknown; material: unknown } }).glowMesh;
    expect(glowOf(a).geometry).toBe(glowOf(b).geometry);
    expect(glowOf(a).material).toBe(glowOf(b).material);
  });
});
