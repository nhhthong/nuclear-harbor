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
});
