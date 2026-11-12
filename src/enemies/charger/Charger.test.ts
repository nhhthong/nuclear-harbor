import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CHARGER_ROBOT, WEAPON } from '@/config/tunables';
import { EnemyManager } from '../EnemyManager';
import { addGround, makeTestWorld, type TestWorld } from '../testUtils';
import type { Charger } from './Charger';

interface Rig {
  w: TestWorld;
  m: EnemyManager;
  c: Charger;
  events: string[];
}

/** Flat 80 m slab (edge at +-40), a wall at z = -34 like the sandbox, one Charger, quiet player. */
async function rig(chargerZ: number, playerX: number, playerZ: number): Promise<Rig> {
  const w = await makeTestWorld({ sandbox: true, params: 'enemies=none' });
  addGround(w.physics);
  w.physics.addStaticBox({ center: { x: 0, y: 2, z: -34 }, halfExtents: { x: 20, y: 2, z: 0.5 } });
  w.physics.syncQueries();
  const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
  m.start();
  const c = m.spawn({ type: 'charger', position: new Vector3(0, 0, chargerZ), patrol: [] }) as unknown as Charger;
  w.ctx.player.teleport({ x: playerX, y: 0, z: playerZ });
  const events: string[] = [];
  for (const name of ['charger:windup', 'charger:chargeStarted', 'charger:stunned', 'charger:hitPlayer'] as const) {
    w.events.on(name, () => events.push(`${name}@${w.clock.simTime.toFixed(2)}`));
  }
  return { w, m, c, events };
}

function tick(r: Rig, seconds: number, each?: () => void): void {
  const dt = r.w.clock.fixedDt;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    r.w.clock.simTime += dt;
    r.w.clock.fixedTick++;
    r.m.fixedUpdate(dt);
    each?.();
  }
}

function runUntil(r: Rig, state: string, maxSeconds: number): void {
  const dt = r.w.clock.fixedDt;
  for (let i = 0; i < Math.round(maxSeconds / dt) && r.c.state !== state; i++) tick(r, dt);
}

describe('Charger (headless physics)', () => {
  it('has 200 HP, the charger type and a shared-material model (AC1)', async () => {
    const r = await rig(0, 0, 40);
    expect(r.c.type).toBe('charger');
    expect(r.c.maxHp).toBe(200);
    expect(r.c.state).toBe('patrol');
    expect(r.c.hitVolumeCount).toBe(1);
    const second = r.m.spawn({ type: 'charger', position: new Vector3(5, 0, 0), patrol: [] }) as unknown as Charger;
    const geo = (e: Charger) => (e as unknown as { ventMesh: { geometry: unknown } }).ventMesh.geometry;
    expect(geo(second)).toBe(geo(r.c));
  });

  it('telegraphs for 1 s, locks the direction, charges at 10-12 m/s and hits the player once (AC2, AC3, AC5)', async () => {
    const r = await rig(0, 0, 14);
    const hp0 = r.w.ctx.player.hp;
    runUntil(r, 'windup', 2);
    expect(r.c.state).toBe('windup');
    expect(r.c.forceHighRate).toBe(true);
    expect(r.c.stripVisible).toBe(true);
    const windupAt = r.w.clock.simTime;
    runUntil(r, 'charge', 2);
    expect(r.w.clock.simTime - windupAt).toBeGreaterThan(0.95);
    expect(r.w.clock.simTime - windupAt).toBeLessThan(1.1);
    expect(r.c.currentPlan.maxDistance).toBeLessThanOrEqual(CHARGER_ROBOT.maxChargeDistance);
    const locked = r.c.chargeDirection.clone();
    // sidestep: a steered charge would turn, a locked one keeps going straight
    r.w.ctx.player.teleport({ x: 12, y: 0, z: 14 });
    const z0 = r.c.position.z;
    tick(r, 0.5);
    const speed = (r.c.position.z - z0) / 0.5;
    expect(speed).toBeGreaterThanOrEqual(CHARGER_ROBOT.chargeSpeedMin - 0.1);
    expect(speed).toBeLessThanOrEqual(CHARGER_ROBOT.chargeSpeedMax + 0.1);
    expect(Math.abs(r.c.position.x)).toBeLessThan(0.01);
    expect(r.c.chargeDirection.x).toBeCloseTo(locked.x);
    expect(r.c.chargeDirection.z).toBeCloseTo(locked.z);
    // dodged: no damage so far
    expect(r.w.ctx.player.hp).toBe(hp0);
    expect(r.events.some((e) => e.startsWith('charger:hitPlayer'))).toBe(false);
    expect(r.events.filter((e) => e.startsWith('charger:windup'))).toHaveLength(1);
    expect(r.events.filter((e) => e.startsWith('charger:chargeStarted'))).toHaveLength(1);
  });

  it('deals 20 damage once per charge and knocks the player back (AC5)', async () => {
    const r = await rig(0, 0, 14);
    runUntil(r, 'charge', 3);
    tick(r, 2);
    expect(r.w.ctx.player.hp).toBe(100 - CHARGER_ROBOT.damage);
    expect(r.events.filter((e) => e.startsWith('charger:hitPlayer'))).toHaveLength(1);
    const impulse = r.w.ctx.player.pendingImpulse;
    expect(impulse.z).toBeCloseTo(CHARGER_ROBOT.knockbackSpeed, 1);
    expect(impulse.y).toBeCloseTo(CHARGER_ROBOT.knockbackUp, 1);
  });

  it('stops against a wall, stuns for 2.5 s with the rear exposed, then recovers (AC4, AC7)', async () => {
    const r = await rig(-20, 5, -30);
    runUntil(r, 'charge', 3);
    runUntil(r, 'stunned', 4);
    expect(r.c.state).toBe('stunned');
    const stunStart = r.w.clock.simTime;
    expect(r.events.some((e) => e.startsWith('charger:stunned'))).toBe(true);
    // against the wall (face at z = -33.5), front of the body touching
    expect(r.c.position.z - CHARGER_ROBOT.halfExtents.z).toBeGreaterThan(-33.6);
    runUntil(r, 'detect', 3);
    expect(r.w.clock.simTime - stunStart).toBeGreaterThan(CHARGER_ROBOT.wallStunDuration - 0.05);
    expect(r.w.clock.simTime - stunStart).toBeLessThan(CHARGER_ROBOT.wallStunDuration + 0.1);
  });

  it('never leaves the slab: a charge towards the edge ends before it (AC6)', async () => {
    const r = await rig(20, 0, 34);
    let maxZ = -Infinity;
    runUntil(r, 'charge', 3);
    tick(r, 3, () => {
      maxZ = Math.max(maxZ, r.c.position.z + CHARGER_ROBOT.halfExtents.z);
    });
    expect(r.c.currentPlan.endsAt).toBe('edge');
    expect(maxZ).toBeLessThan(40);
    expect(r.c.position.z).toBeLessThan(40 - CHARGER_ROBOT.halfExtents.z);
    expect(r.c.state).not.toBe('charge');
  });

  it('armour in front, crit from the flanks and rear, returned in the result (AC7)', async () => {
    const r = await rig(0, 0, 40);
    // yaw 0 faces -Z: a shot travelling +Z hits the front, one travelling -Z hits the rear
    const front = r.c.applyDamage({ amount: WEAPON.damage, zone: 'body', source: 'player', direction: new Vector3(0, 0, 1) });
    expect(front.zone).toBe('armor');
    expect(front.dealt).toBeCloseTo(2.5);
    const rear = r.c.applyDamage({ amount: WEAPON.damage, zone: 'body', source: 'player', direction: new Vector3(0, 0, -1) });
    expect(rear.zone).toBe('critical');
    expect(rear.dealt).toBeCloseTo(50);
    const side = r.c.applyDamage({ amount: WEAPON.damage, zone: 'body', source: 'player', direction: new Vector3(1, 0, 0) });
    expect(side.zone).toBe('critical');
    expect(r.c.hp).toBe(200 - 2.5 - 50 - 50);
  });

  it('does not charge outside the 8-25 m window or without line of sight (AC1)', async () => {
    const near = await rig(0, 0, 5);
    tick(near, 0.5);
    // too close: it walks away to open the distance instead of charging
    expect(near.events).toEqual([]);
    expect(near.c.state).toBe('detect');
    const far = await rig(0, 0, 38);
    tick(far, 3);
    expect(far.events).toEqual([]);
    expect(far.c.state).toBe('patrol');
  });

  it('starts the ~6 s cooldown when a charge ends (AC1)', async () => {
    const r = await rig(0, 0, 14);
    runUntil(r, 'charge', 3);
    runUntil(r, 'recover', 4);
    expect(r.c.cooldownRemaining).toBeGreaterThan(CHARGER_ROBOT.cooldown - 0.2);
    expect(r.c.forceHighRate).toBe(false);
  });

  it('defers move orders while winding up, charging or stunned', async () => {
    const r = await rig(0, 0, 14);
    runUntil(r, 'windup', 2);
    const patrolBefore = r.c.patrol.length;
    r.c.commandMoveTo(new Vector3(3, 0, 3));
    expect(r.c.patrol.length).toBe(patrolBefore);
    runUntil(r, 'recover', 5);
    tick(r, 0.1);
    expect(r.c.patrol).toHaveLength(1);
  });

  it('removes its strip and colliders when destroyed', async () => {
    const r = await rig(0, 0, 40);
    const before = r.w.physics.colliderCount;
    r.c.applyDamage({ amount: 10_000, zone: 'body', source: 'player', direction: new Vector3(0, 0, -1) });
    expect(r.c.state).toBe('destroyed');
    expect(r.w.physics.colliderCount).toBe(before - 1);
    expect(r.c.stripVisible).toBe(false);
  });
});
