import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER_SPAWN, SPAWN_SAFE_RADIUS, BOSS_ARENA } from '@/config/level';
import { ENEMY_COUNTS, WEAPON } from '@/config/tunables';
import { SPAWN_L, WAREHOUSE } from '@/config/warehouse';
import { EnemyManager } from '../EnemyManager';
import { DRONE_POSTS, droneRoster, parseEnemyParam } from '../population';
import { addGround, makeTestWorld, type TestWorld } from '../testUtils';
import type { Drone } from './Drone';
import { insideRect, insideWarehouse } from './openings';
import { DRONE, DRONE_NO_FLY } from './tunables';
import { stepWrecks, wreckCount, clearWrecks } from './wrecks';

interface Rig {
  w: TestWorld;
  m: EnemyManager;
  d: Drone;
}

async function rig(at: { x: number; y: number; z: number }, player: { x: number; z: number }, boxes: Array<{ c: [number, number, number]; h: [number, number, number] }> = []): Promise<Rig> {
  const w = await makeTestWorld({ sandbox: true, params: 'enemies=none' });
  addGround(w.physics, 60);
  for (const b of boxes) w.physics.addStaticBox({ center: { x: b.c[0], y: b.c[1], z: b.c[2] }, halfExtents: { x: b.h[0], y: b.h[1], z: b.h[2] } });
  w.physics.syncQueries();
  const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
  m.start();
  w.ctx.player.teleport({ x: player.x, y: 0, z: player.z });
  const d = m.spawn({ type: 'drone', position: new Vector3(at.x, at.y, at.z), patrol: [] }) as unknown as Drone;
  return { w, m, d };
}

function tick(r: Rig, seconds: number, each?: () => void): void {
  const dt = r.w.clock.fixedDt;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    r.w.clock.simTime += dt;
    r.w.clock.fixedTick++;
    r.m.fixedUpdate(dt);
    r.w.physics.syncQueries();
    each?.();
  }
}

describe('drone enemy (headless physics)', () => {
  it('is a 40 HP flyer that dies to two rifle hits, falls and bursts', async () => {
    const r = await rig({ x: 0, y: 5, z: -10 }, { x: 0, z: 30 });
    expect(r.d.type).toBe('drone');
    expect(r.d.maxHp).toBe(DRONE.hp);
    expect(r.d.hitVolumeCount).toBe(1);
    expect(r.d.applyDamage({ amount: WEAPON.damage, zone: 'body', source: 'player' }).killed).toBe(false);
    const kinds: string[] = [];
    r.w.events.on('vfx:spawn', (e) => kinds.push(e.kind));
    let destroyed = 0;
    r.w.events.on('enemy:destroyed', (e) => {
      if (e.type === 'drone') destroyed++;
    });
    expect(r.d.applyDamage({ amount: WEAPON.damage, zone: 'body', source: 'player' }).killed).toBe(true);
    expect(destroyed).toBe(1);
    expect(wreckCount()).toBe(1);
    for (let i = 0; i < 120; i++) stepWrecks(1 / 60);
    expect(wreckCount()).toBe(0);
    expect(kinds.filter((k) => k === 'explosion').length).toBe(2); // the hit and the crash
    expect(kinds).toContain('smoke');
    clearWrecks();
  });

  it('hunts the player in the open: cruise band above the ground, 5 to 10 m stand-off, plasma bolts', async () => {
    const r = await rig({ x: 0, y: 5, z: -25 }, { x: 0, z: 0 });
    let attacks = 0;
    r.w.events.on('enemy:attacked', () => attacks++);
    let hp = 0;
    r.w.events.on('player:damaged', () => hp++);
    tick(r, 12);
    const p = r.d.position;
    const flat = Math.hypot(p.x, p.z);
    expect(flat).toBeGreaterThan(DRONE.standoffMin - 1);
    expect(flat).toBeLessThan(DRONE.standoffMax + 1);
    expect(p.y).toBeGreaterThan(DRONE.cruiseMin - 0.5);
    expect(p.y).toBeLessThan(DRONE.cruiseMax + 0.5);
    expect(r.d.flightMode).toBe('engage');
    expect(attacks).toBeGreaterThan(0);
    expect(hp + attacks).toBeGreaterThan(0);
  });

  it('never passes through a wall between it and the player', async () => {
    // a tall wall (12 m, above the cruise band) between the drone and the player
    const wall = { c: [0, 6, -10] as [number, number, number], h: [8, 6, 0.3] as [number, number, number] };
    const r = await rig({ x: 0, y: 4, z: -20 }, { x: 0, z: 0 }, [wall]);
    const R = DRONE.bodyRadius;
    let crossedThrough = false;
    let last = r.d.position.clone();
    tick(r, 25, () => {
      const p = r.d.position;
      const inX = Math.abs(p.x - wall.c[0]) < wall.h[0] + R - 0.05;
      const inY = p.y < wall.c[1] + wall.h[1] + R - 0.05;
      // the sphere never overlaps the wall
      const overlap = inX && inY && Math.abs(p.z - wall.c[2]) < wall.h[2] + R - 0.05;
      expect(overlap).toBe(false);
      // crossing the wall plane inside its span means it went through
      if ((last.z - wall.c[2]) * (p.z - wall.c[2]) < 0 && inX && inY) crossedThrough = true;
      last = p.clone();
    });
    expect(crossedThrough).toBe(false);
    // it got round (or over) the wall to the player's side
    expect(r.d.position.z).toBeGreaterThan(wall.c[2]);
  });

  it('spawns call-in drones outside the warehouse openings', async () => {
    const r = await rig({ x: 0, y: 5, z: -10 }, { x: 20, z: -20 });
    const ids = r.m.spawnCallIn(2);
    expect(ids).toHaveLength(2);
    for (const s of r.m.snapshot().filter((e) => ids.includes(e.id))) {
      expect(insideWarehouse({ x: s.x, y: s.y, z: s.z })).toBe(false);
      expect(s.y).toBeGreaterThan(1);
    }
    expect(r.m.callInState().alive).toBe(2);
  });
});

describe('drone roster', () => {
  it('has the configured number of roster drones, accepted by ?enemies=', () => {
    expect(DRONE_POSTS).toHaveLength(ENEMY_COUNTS.drone);
    expect(droneRoster()).toHaveLength(ENEMY_COUNTS.drone);
    expect(parseEnemyParam('drone')).toEqual(['drone']);
  });

  it('keeps the posts away from both player spawns, the boss arena, the warehouse and the closed block', () => {
    for (const d of DRONE_POSTS) {
      for (const [x, z] of [d.at, ...d.patrol]) {
        expect(Math.hypot(x - PLAYER_SPAWN.position.x, z - PLAYER_SPAWN.position.z)).toBeGreaterThan(SPAWN_SAFE_RADIUS);
        expect(Math.hypot(x - SPAWN_L.x, z - SPAWN_L.z)).toBeGreaterThan(SPAWN_SAFE_RADIUS);
        expect(Math.hypot(x - BOSS_ARENA.center.x, z - BOSS_ARENA.center.z)).toBeGreaterThan(BOSS_ARENA.radius);
        expect(insideRect(WAREHOUSE.footprint, x, z)).toBe(false);
        expect(insideRect(DRONE_NO_FLY, x, z)).toBe(false);
      }
      expect(d.patrol.length).toBeGreaterThanOrEqual(2);
    }
  });
});
