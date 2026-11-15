import { Mesh, Vector3, type LOD, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { EnemyManager } from '../EnemyManager';
import { addGround, makeTestWorld, type TestWorld } from '../testUtils';
import type { Duck } from './Duck';
import { DUCK } from './tunables';

interface Rig {
  w: TestWorld;
  m: EnemyManager;
  d: Duck;
  log: string[];
}

async function rig(playerZ: number): Promise<Rig> {
  const w = await makeTestWorld({ sandbox: true, params: 'enemies=none' });
  addGround(w.physics);
  w.physics.syncQueries();
  const m = new EnemyManager(w.ctx, w.ctx.resources.scope('enemies'));
  m.start();
  const d = m.spawn({ type: 'duck', position: new Vector3(0, 0, 0), patrol: [] }) as unknown as Duck;
  w.ctx.player.teleport({ x: 0, y: 0, z: playerZ });
  const log: string[] = [];
  w.events.on('duck:beep', (e) => log.push(`beep${e.count}@${w.clock.simTime.toFixed(2)}`));
  w.events.on('duck:explode', (e) => log.push(`explode:${e.hitPlayer}@${w.clock.simTime.toFixed(2)}`));
  w.events.on('duck:windup', (e) => log.push(`windup:${e.duration}`));
  w.events.on('enemy:destroyed', () => log.push('destroyed'));
  return { w, m, d, log };
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

function runUntilState(r: Rig, state: string, maxSeconds: number): void {
  const dt = r.w.clock.fixedDt;
  for (let i = 0; i < Math.round(maxSeconds / dt) && r.d.state !== state; i++) tick(r, dt);
}

describe('Bomber Duck (headless physics)', () => {
  it('has 60 HP, the duck id, a head crit volume and a model of at most 5 meshes (the feet step separately) near, 1 far', async () => {
    const r = await rig(40);
    expect(r.d.type).toBe('duck');
    expect(r.d.maxHp).toBe(60);
    expect(r.d.state).toBe('patrol');
    expect(r.d.hitVolumeCount).toBe(2);
    let lod: LOD | null = null;
    (r.d as unknown as { root: Object3D }).root.traverse((o) => {
      if ((o as LOD).isLOD) lod = o as LOD;
    });
    const levels = (lod as unknown as LOD).levels;
    expect(levels.length).toBe(2);
    const count = (o: Object3D | undefined): number => {
      let n = 0;
      o?.traverse((c) => {
        if ((c as Mesh).isMesh) n++;
      });
      return n;
    };
    expect(count(levels[0]?.object)).toBeLessThanOrEqual(5);
    expect(count(levels[1]?.object)).toBe(1);
    const second = r.m.spawn({ type: 'duck', position: new Vector3(5, 0, 0), patrol: [] }) as unknown as Duck;
    const geo = (e: Duck) => (e as unknown as { footL: Mesh }).footL.geometry;
    expect(geo(second)).toBe(geo(r.d));
  });

  it('hops at the player faster than the walk and slower than the sprint, arms near 2.5 m', async () => {
    const r = await rig(18);
    runUntilState(r, 'hop', 2);
    expect(r.d.state).toBe('hop');
    // measure the average speed over 1.5 s of hopping (far enough from the player)
    const x0 = r.d.position.z;
    tick(r, 1.5);
    const speed = (r.d.position.z - x0) / 1.5;
    expect(speed).toBeGreaterThan(PLAYER.walkSpeed);
    expect(speed).toBeLessThan(PLAYER.sprintSpeed);
    runUntilState(r, 'arming', 4);
    expect(r.d.state).toBe('arming');
    const gap = Math.hypot(r.w.ctx.player.position.x - r.d.position.x, r.w.ctx.player.position.z - r.d.position.z);
    expect(gap).toBeLessThanOrEqual(DUCK.armDistance + 0.01);
    expect(gap).toBeGreaterThan(DUCK.armDistance - 0.6);
    expect(r.d.ringVisible).toBe(true);
    expect(r.d.forceHighRate).toBe(true);
  });

  it('beeps 3-2-1 and explodes after 3 s for exactly 15 damage inside the blast radius', async () => {
    const r = await rig(6);
    const hp0 = r.w.ctx.player.hp;
    runUntilState(r, 'arming', 4);
    const armedAt = r.w.clock.simTime;
    tick(r, 3.5);
    const beeps = r.log.filter((l) => l.startsWith('beep'));
    expect(beeps.map((b) => b.split('@')[0])).toEqual(['beep3', 'beep2', 'beep1']);
    const t = (s: string) => Number(s.split('@')[1]) - armedAt;
    expect(t(beeps[0] as string)).toBeLessThan(0.1);
    expect(t(beeps[1] as string)).toBeGreaterThan(0.9);
    expect(t(beeps[1] as string)).toBeLessThan(1.1);
    expect(t(beeps[2] as string)).toBeGreaterThan(1.9);
    const boom = r.log.find((l) => l.startsWith('explode')) as string;
    expect(boom.startsWith('explode:true')).toBe(true);
    expect(t(boom)).toBeGreaterThan(2.95);
    expect(t(boom)).toBeLessThan(3.1);
    expect(hp0 - r.w.ctx.player.hp).toBe(15);
    expect(r.log.filter((l) => l === 'destroyed').length).toBe(1);
    expect(r.w.ctx.enemies.all().length).toBe(0);
    expect(r.log.find((l) => l.startsWith('windup'))).toBe('windup:3');
  });

  it('pops harmlessly when the player is outside the radius at zero', async () => {
    const r = await rig(6);
    const hp0 = r.w.ctx.player.hp;
    runUntilState(r, 'arming', 4);
    tick(r, 1);
    r.w.ctx.player.teleport({ x: 0, y: 0, z: r.d.position.z + DUCK.blastRadius + 3 });
    tick(r, 2.5);
    expect(r.log.some((l) => l.startsWith('explode:false'))).toBe(true);
    expect(r.w.ctx.player.hp).toBe(hp0);
    expect(r.w.ctx.enemies.all().length).toBe(0);
  });

  it('deals no blast damage when shot dead before zero', async () => {
    const r = await rig(6);
    const hp0 = r.w.ctx.player.hp;
    runUntilState(r, 'arming', 4);
    tick(r, 1.5);
    r.d.applyDamage({ amount: 1000, zone: 'body', source: 'player' });
    tick(r, 4);
    expect(r.w.ctx.player.hp).toBe(hp0);
    expect(r.log.some((l) => l.startsWith('explode'))).toBe(false);
    expect(r.log.filter((l) => l === 'destroyed').length).toBe(1);
  });

  it('takes double damage on the head and ignores a defend order while armed', async () => {
    const r = await rig(6);
    runUntilState(r, 'arming', 4);
    r.d.commandMoveTo(new Vector3(30, 0, 30));
    tick(r, 0.2);
    expect(r.d.state).toBe('arming');
    const body = r.d.applyDamage({ amount: 5, zone: 'body', source: 'player' });
    const crit = r.d.applyDamage({ amount: 5, zone: 'critical', source: 'player' });
    expect(crit.dealt).toBe(body.dealt * 2);
  });

  it('an armed duck that goes dormant pops harmlessly (consistent state)', async () => {
    const r = await rig(6);
    const hp0 = r.w.ctx.player.hp;
    runUntilState(r, 'arming', 4);
    r.w.ctx.player.teleport({ x: 0, y: 0, z: 400 });
    tick(r, 3.4);
    expect(r.d.simLevel).toBe('dormant');
    expect(r.log.some((l) => l.startsWith('explode:false'))).toBe(true);
    expect(r.w.ctx.player.hp).toBe(hp0);
  });
});
