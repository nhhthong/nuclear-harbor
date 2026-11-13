import { Mesh, Vector3, type LOD, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { EnemyManager } from '../EnemyManager';
import { addGround, makeTestWorld, type TestWorld } from '../testUtils';
import type { Spot } from './Spot';
import { SPOT } from './tunables';

interface Rig {
  w: TestWorld;
  m: EnemyManager;
  s: Spot;
}

async function rig(spotZ: number, playerZ: number): Promise<Rig> {
  const w = await makeTestWorld({ sandbox: true, params: 'enemies=none' });
  addGround(w.physics);
  w.physics.syncQueries();
  const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
  m.start();
  const s = m.spawn({ type: 'spider', position: new Vector3(0, 0, spotZ), patrol: [] }) as unknown as Spot;
  w.ctx.player.teleport({ x: 0, y: 0, z: playerZ });
  return { w, m, s };
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

describe('Spot dog (headless physics)', () => {
  it('has 70 HP, the spider id, a nose crit volume and a model of at most 6 draw calls near, 1 far', async () => {
    const r = await rig(0, 60);
    expect(r.s.type).toBe('spider');
    expect(r.s.maxHp).toBe(70);
    expect(r.s.state).toBe('patrol');
    expect(r.s.hitVolumeCount).toBe(2);
    let lod: LOD | null = null;
    (r.s as unknown as { root: Object3D }).root.traverse((o) => {
      if ((o as LOD).isLOD) lod = o as LOD;
    });
    const levels = (lod as unknown as LOD).levels;
    const count = (o: Object3D | undefined): number => {
      let n = 0;
      o?.traverse((c) => {
        if ((c as Mesh).isMesh) n++;
      });
      return n;
    };
    expect(count(levels[0]?.object)).toBeLessThanOrEqual(4);
    expect(count(levels[1]?.object)).toBe(1);
    const crit = r.s.applyDamage({ amount: 5, zone: 'critical', source: 'player' });
    const body = r.s.applyDamage({ amount: 5, zone: 'body', source: 'player' });
    expect(crit.dealt).toBe(body.dealt * 2);
  });

  it('chases, telegraphs, lunges for exactly 10 damage once per lunge with knockback and respects the cooldown', async () => {
    const r = await rig(0, 14);
    const player = r.w.ctx.player;
    const hp0 = player.hp;
    const starts: number[] = [];
    const ends: number[] = [];
    const hits: number[] = [];
    let last = r.s.state;
    let sawTelegraph = false;
    let hp = hp0;
    tick(r, 14, () => {
      if (r.s.state !== last) {
        if (r.s.state === 'lunge') starts.push(r.w.clock.simTime);
        if (last === 'lunge') ends.push(r.w.clock.simTime);
        if (r.s.state === 'telegraph') sawTelegraph = true;
        last = r.s.state;
      }
      if (player.hp < hp) {
        hits.push(hp - player.hp);
        hp = player.hp;
        // keep the player alive and in place for the next lunge
        if (player.hp < 30) player.hp = 100;
        hp = player.hp;
      }
    });
    expect(sawTelegraph).toBe(true);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    for (const h of hits) expect(h).toBe(10);
    expect(player.pendingImpulse.length()).toBeGreaterThan(0);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) {
      expect((starts[i] as number) - (ends[i - 1] as number)).toBeGreaterThanOrEqual(SPOT.cooldown);
    }
    // the lunge count matches the hits (one hit per lunge, a miss is possible)
    expect(hits.length).toBeLessThanOrEqual(r.s.lunges);
  });

  it('the lunge stops at the edge of walkable ground', async () => {
    const r = await rig(37, 44);
    let maxZ = -Infinity;
    tick(r, 3, () => {
      maxZ = Math.max(maxZ, r.s.position.z);
    });
    expect(r.s.lunges).toBeGreaterThanOrEqual(1);
    expect(maxZ).toBeLessThanOrEqual(40.01);
  });

  it('defers a defend order during a lunge and goes dormant consistently', async () => {
    const r = await rig(0, 6);
    let guard = 0;
    while (r.s.state !== 'telegraph' && guard++ < 600) tick(r, 1 / 60);
    r.s.commandMoveTo(new Vector3(20, 0, 20));
    expect(r.s.state).toBe('telegraph');
    r.w.ctx.player.teleport({ x: 0, y: 0, z: 500 });
    tick(r, 1);
    expect(r.s.simLevel).toBe('dormant');
    expect(r.s.alive).toBe(true);
  });
});
