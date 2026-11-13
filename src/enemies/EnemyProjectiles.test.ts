import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { EnemyProjectiles } from './EnemyProjectiles';
import { addGround, makeTestWorld } from './testUtils';
import { ENEMY_PROJECTILE } from './tunables';

describe('EnemyProjectiles', () => {
  it('has a hard cap and drops shots when the pool is empty (AC5)', async () => {
    const w = await makeTestWorld();
    const p = new EnemyProjectiles(w.ctx, w.ctx.resources.scope('enemies'));
    let accepted = 0;
    for (let i = 0; i < 100; i++) {
      if (p.fire(new Vector3(0, 5, 0), new Vector3(0, 0, -1), 30, 8)) accepted++;
    }
    expect(accepted).toBe(ENEMY_PROJECTILE.poolCap);
    expect(p.liveCount).toBe(ENEMY_PROJECTILE.poolCap);
    expect(p.droppedCount).toBe(100 - ENEMY_PROJECTILE.poolCap);
  });

  it('is blocked by world geometry with a spark, and damages the player on hit (AC5)', async () => {
    const w = await makeTestWorld();
    addGround(w.physics);
    w.physics.addStaticBox({ center: { x: 0, y: 2, z: -10 }, halfExtents: { x: 5, y: 2, z: 0.5 } });
    w.physics.syncQueries();
    const sparks: string[] = [];
    w.events.on('vfx:spawn', (e) => sparks.push(e.kind));
    const p = new EnemyProjectiles(w.ctx, w.ctx.resources.scope('enemies'));

    // into the wall
    w.ctx.player.position.set(0, 0, -20); // player is behind the wall
    p.fire(new Vector3(0, 1.2, 0), new Vector3(0, 0, -1), 30, 8);
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(sparks).toContain('spark');
    expect(w.ctx.player.hp).toBe(100);
    expect(p.liveCount).toBe(0);

    // at an exposed player
    w.ctx.player.position.set(20, 0, 0);
    p.fire(new Vector3(0, 1.2, 0), new Vector3(1, 0, 0), 30, 8);
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(w.ctx.player.hp).toBe(92);
    expect(p.liveCount).toBe(0);
  });

  it('rockets: own bounded pool, slow flight, explosion with splash falloff (T-20)', async () => {
    const w = await makeTestWorld();
    addGround(w.physics);
    w.physics.addStaticBox({ center: { x: 0, y: 2, z: -20 }, halfExtents: { x: 8, y: 2, z: 0.5 } });
    w.physics.syncQueries();
    const booms: string[] = [];
    w.events.on('vfx:spawn', (e) => booms.push(e.kind));
    const p = new EnemyProjectiles(w.ctx, w.ctx.resources.scope('enemies'));

    let accepted = 0;
    for (let i = 0; i < 40; i++) if (p.fireRocket(new Vector3(0, 30, 0), new Vector3(0, 1, 0), 25, 12, 3)) accepted++;
    expect(accepted).toBe(ENEMY_PROJECTILE.rocketPoolCap);
    expect(p.rocketsDropped).toBe(40 - ENEMY_PROJECTILE.rocketPoolCap);
    p.releaseAll();
    expect(p.liveRockets).toBe(0);

    // speed: 25 m/s
    p.fireRocket(new Vector3(0, 1.2, 0), new Vector3(0, 0, 1), 25, 12, 3);
    w.ctx.player.position.set(100, 0, 100);
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    const rocket = w.ctx.scene.children.find((c) => c.visible && c.position.z > 1);
    expect(rocket?.position.z).toBeCloseTo(12.5, 1);
    p.releaseAll();

    // splash: the rocket hits the wall about 1.3 m from the player's capsule -> partial damage
    w.ctx.player.position.set(1.5, 0, -18.5);
    const hp0 = w.ctx.player.hp;
    p.fireRocket(new Vector3(0, 1.2, 0), new Vector3(0, 0, -1), 25, 12, 3);
    for (let i = 0; i < 120; i++) p.step(1 / 60);
    const lost = hp0 - w.ctx.player.hp;
    expect(lost).toBeGreaterThan(0);
    expect(lost).toBeLessThan(12);
    expect(booms).toContain('explosion');
    expect(p.liveRockets).toBe(0);

    // direct hit = full damage
    w.ctx.player.position.set(0, 0, 15);
    const hp1 = w.ctx.player.hp;
    p.fireRocket(new Vector3(0, 1.2, 0), new Vector3(0, 0, 1), 25, 12, 3);
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(hp1 - w.ctx.player.hp).toBe(12);
  });
});
