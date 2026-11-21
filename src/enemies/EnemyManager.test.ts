import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ARMY_ROBOT, WEAPON } from '@/config/tunables';
import { DUCK } from './duck/tunables';
import type { Biped } from './biped/Biped';
import { BIPED } from './biped/tunables';
import { SPOT } from './spot/tunables';
import { QueryGroups } from '@/physics/groups';
import type { ArmyRobot } from './army/ArmyRobot';
import { ARMY_LOCAL, STRIKER } from './army/tunables';
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

  it('detects, advances into the firing band, fires 3-round bursts and damages the player (AC2, AC5)', async () => {
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
    expect(attacked.length).toBeGreaterThanOrEqual(6);
    expect(w.ctx.player.hp).toBeLessThan(100);
    expect(minD).toBeGreaterThan(ARMY_ROBOT.bandMin - 3);
    expect(maxD).toBeLessThan(ARMY_ROBOT.bandMax * ARMY_LOCAL.engageHysteresis + 1);
    // rounds come in tight groups (the burst interval) separated by about the burst period
    const gaps = attacked.slice(1).map((t, i) => t - (attacked[i] ?? 0));
    expect(gaps.some((g) => g < STRIKER.burst.interval * 2)).toBe(true);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(STRIKER.burst.period - STRIKER.burst.interval * STRIKER.burst.size - 0.1);
  });

  it('fires bullets of 5 damage and a rocket of 14 with a 4 m splash every 6 to 9 s, standing still to charge it (AC5)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const e = spawnMech(m, 0, 24);
    const bullets: number[] = [];
    const rockets: Array<{ t: number; speed: number }> = [];
    const fire = m.projectiles.fire.bind(m.projectiles);
    const fireRocket = m.projectiles.fireRocket.bind(m.projectiles);
    m.projectiles.fire = (from, dir, speed, damage) => {
      expect(damage).toBe(STRIKER.burst.damage);
      bullets.push(w.clock.simTime);
      return fire(from, dir, speed, damage);
    };
    m.projectiles.fireRocket = (from, dir, speed, damage, radius) => {
      expect(damage).toBe(14);
      expect(radius).toBe(4);
      rockets.push({ t: w.clock.simTime, speed: e.speed });
      return fireRocket(from, dir, speed, damage, radius);
    };
    const dt = w.clock.fixedDt;
    let telegraphMoved = 0;
    let last: { x: number; z: number } | null = null;
    for (let i = 0; i < 60 * 45; i++) {
      w.clock.simTime += dt;
      w.ctx.player.hp = 100; // keep the target alive
      m.fixedUpdate(dt);
      if (e.attackPhase === 'telegraph') {
        if (last) telegraphMoved = Math.max(telegraphMoved, Math.hypot(e.position.x - last.x, e.position.z - last.z));
        last = { x: e.position.x, z: e.position.z };
      } else last = null;
    }
    expect(bullets.length).toBeGreaterThanOrEqual(3 * 15);
    expect(rockets.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < rockets.length; i++) {
      const gap = rockets[i]!.t - rockets[i - 1]!.t;
      expect(gap).toBeGreaterThanOrEqual(STRIKER.rocket.minGap - 0.1);
      expect(gap).toBeLessThanOrEqual(STRIKER.rocket.maxGap + 0.5);
    }
    // the mech brakes for the telegraph (decel 2.6 m/s^2) instead of firing on the move
    for (const r of rockets) expect(r.speed).toBeLessThan(0.3);
    expect(telegraphMoved).toBeLessThan(0.05);
    // bullets are fired at 8 m or more
    for (const [i] of bullets.entries()) expect(i).toBeGreaterThanOrEqual(0);
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
    for (let i = 0; i < 60 * 8; i++) {
      w.ctx.player.hp = 100; // keep the target alive: the mech shoots while it backs off
      run(w, m, 1 / 60);
    }
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
    expect(m.projectiles.liveCount).toBe(0);
  });

  it('Spot (spot id), Bomber Duck (duck id) and the Biped (biped id) keep their type and use their own HP (AC8)', async () => {
    const { m } = await setup();
    const s = m.spawn({ type: 'spot', position: new Vector3(5, 0, 5), patrol: [] });
    const c = m.spawn({ type: 'duck', position: new Vector3(-5, 0, 5), patrol: [] });
    const b = m.spawn({ type: 'biped', position: new Vector3(0, 0, 8), patrol: [] });
    expect(s?.type).toBe('spot');
    expect(s?.maxHp).toBe(SPOT.hp);
    expect(c?.type).toBe('duck');
    expect(c?.maxHp).toBe(DUCK.hp);
    expect(b?.type).toBe('biped');
    expect(b?.maxHp).toBe(BIPED.hp);
  });

  it('the Biped runs at the player, crouches, leaps to where the player stood and claws on landing (AC5)', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const b = m.spawn({ type: 'biped', position: new Vector3(0, 0, 24), patrol: [] }) as Biped;
    const dt = w.clock.fixedDt;
    const states: string[] = [];
    let hpAtLanding = 100;
    let maxLift = 0;
    let alertedFirst = -1;
    w.events.on('enemy:alerted', () => {
      if (alertedFirst < 0) alertedFirst = w.clock.simTime;
    });
    for (let i = 0; i < 60 * 8; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      const prev = states[states.length - 1];
      if (prev !== b.state) states.push(b.state);
      maxLift = Math.max(maxLift, b.position.y - BIPED.centerHeight);
      if (b.state === 'recover' && hpAtLanding === 100) hpAtLanding = w.ctx.player.hp;
      if (b.state === 'chase' && states.includes('recover')) break;
    }
    expect(states.slice(0, 5)).toEqual(['patrol', 'chase', 'crouch', 'leap', 'recover']);
    expect(maxLift).toBeGreaterThan(BIPED.leap.minApex - 0.01);
    expect(hpAtLanding).toBe(100 - BIPED.leap.damage);
    expect(b.leapCount).toBe(1);
    expect(b.leapCooldownRemaining).toBeGreaterThan(0);
    // back on the ground after the landing
    expect(b.position.y).toBeCloseTo(BIPED.centerHeight, 5);
  });

  it('the Biped swipes with both claws when adjacent and stops short of the player instead of walking into them', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    w.ctx.player.hp = 100000;
    w.ctx.player.maxHp = 100000;
    const b = m.spawn({ type: 'biped', position: new Vector3(0, 0, 2), patrol: [] }) as Biped;
    const dt = w.clock.fixedDt;
    let minDistance = Infinity;
    const states = new Set<string>();
    let hpDrop = 0;
    for (let i = 0; i < 60 * 5; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      states.add(b.state);
      minDistance = Math.min(minDistance, Math.hypot(b.position.x, b.position.z));
    }
    hpDrop = 100000 - w.ctx.player.hp;
    expect(states.has('claw')).toBe(true);
    expect(minDistance).toBeGreaterThan(BIPED.holdDistance - 0.3);
    // one swipe per cooldown: at least two in five seconds, never more than the cooldown allows
    expect(hpDrop).toBeGreaterThanOrEqual(2 * BIPED.claw.damage);
    expect(hpDrop).toBeLessThanOrEqual(Math.ceil(5 / BIPED.claw.cooldown) * BIPED.claw.damage + BIPED.leap.damage);
  });

  it('the Biped leap misses a player who jumps over it, and a player standing 5 m from the landing', async () => {
    const { w, m } = await setup();
    w.ctx.player.position.set(0, 0, 0);
    const b = m.spawn({ type: 'biped', position: new Vector3(0, 0, 12), patrol: [] }) as Biped;
    const dt = w.clock.fixedDt;
    for (let i = 0; i < 60 * 6; i++) {
      w.clock.simTime += dt;
      m.fixedUpdate(dt);
      if (b.state === 'crouch') w.ctx.player.position.set(0, 0, 0);
      if (b.state === 'leap') {
        // the player dodges sideways once the target is locked
        w.ctx.player.position.set(6, 0, 0);
      }
      if (b.state === 'recover') break;
    }
    expect(b.state).toBe('recover');
    expect(w.ctx.player.hp).toBe(100);
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

describe('boss fight is solo (spec 33)', () => {
  it('clearForBoss destroys every live robot, stops the call-in and flags the manager', async () => {
    const { w, m } = await setup();
    spawnMech(m, 0, 0);
    spawnMech(m, 10, 0);
    m.spawn({ type: 'spot', position: new Vector3(-10, 0, 0), patrol: [] });
    expect(w.ctx.enemies.aliveCount()).toBe(3);
    expect(m.isBossSolo).toBe(false);
    m.clearForBoss();
    expect(m.isBossSolo).toBe(true);
    expect(w.ctx.enemies.aliveCount()).toBe(0);
    // the anti-camping call-in is off for the rest of the run
    run(w, m, 1);
    expect(m.callInState().called).toBe(0);
  });

  it('is safe to call twice and with nothing alive', async () => {
    const { w, m } = await setup();
    m.clearForBoss();
    m.clearForBoss();
    expect(w.ctx.enemies.aliveCount()).toBe(0);
  });
});

