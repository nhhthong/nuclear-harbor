import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { AreaSpawner, type AreaSpawnerConfig, type LiveRobot } from './areaSpawner';
import type { EnemySpawn } from './BaseEnemy';

const cfg: AreaSpawnerConfig = { liveCap: 3, enterMargin: 2, exitMargin: 6, exitDelay: 1, despawnDistance: 20, minSpawnDistance: 5, spawnRadius: 30, interval: 0.1 };
const areas = {
  A: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 },
  B: { minX: 0, maxX: 20, minZ: 40, maxZ: 60 },
  C: { minX: 100, maxX: 101, minZ: 100, maxZ: 101 },
  D: { minX: 200, maxX: 201, minZ: 200, maxZ: 201 },
};
const post = (x: number, z: number): EnemySpawn => ({ type: 'spot', position: new Vector3(x, 0, z), patrol: [] });

function setup(roster: Array<{ spawn: EnemySpawn; zone: 'A' | 'B' }>) {
  const live: Array<LiveRobot & { alive: boolean }> = [];
  let n = 0;
  const s = new AreaSpawner(roster, areas, cfg, {
    spawn: (sp) => {
      const r = { id: `r${n++}`, alive: true, position: { x: sp.position.x, z: sp.position.z } };
      live.push(r);
      return r;
    },
    despawn: (r) => {
      live.splice(live.indexOf(r as (typeof live)[number]), 1);
    },
  });
  const run = (seconds: number, x: number, z: number): void => {
    for (let t = 0; t < seconds; t += 0.05) s.update(0.05, x, z);
  };
  return { s, live, run };
}

describe('AreaSpawner', () => {
  it('spawns nothing until the player approaches, then one robot per pass up to the cap', () => {
    const { s, live, run } = setup([10, 12, 14, 16, 18].map((x) => ({ spawn: post(x, 15), zone: 'A' as const })));
    run(1, -30, -30);
    expect(live).toHaveLength(0);
    s.update(0.05, 10, 1);
    expect(live).toHaveLength(1);
    run(2, 10, 1);
    expect(live).toHaveLength(cfg.liveCap);
    expect(s.remaining).toBe(5);
  });

  it('never spawns closer than the minimum distance', () => {
    const { live, run } = setup([{ spawn: post(10, 3), zone: 'A' }]);
    run(1, 10, 1);
    expect(live).toHaveLength(0);
    run(1, 10, 18);
    expect(live).toHaveLength(1);
  });

  it('removes survivors after the player left and brings them back, but not the dead', () => {
    const { s, live, run } = setup([
      { spawn: post(10, 15), zone: 'A' },
      { spawn: post(14, 15), zone: 'A' },
    ]);
    run(1, 10, 1);
    expect(live).toHaveLength(2);
    (live[0] as { alive: boolean }).alive = false;
    s.onDestroyed((live[0] as LiveRobot).id);
    live.shift();
    run(3, 10, 50);
    expect(live).toHaveLength(0);
    expect(s.isActive('A')).toBe(false);
    run(1, 10, 1);
    expect(live).toHaveLength(1);
    expect(s.remaining).toBe(1);
  });

  it('only streams in posts within the spawn radius, and never inside a safe disc', () => {
    const { live, run } = setup([
      { spawn: post(10, 15), zone: 'A' },
      { spawn: post(10, 300), zone: 'B' },
    ]);
    // far post of an awake area is not spawned while the player is farther than the radius
    run(1, 10, 1);
    expect(live).toHaveLength(1);
    const safe: Array<LiveRobot & { alive: boolean }> = [];
    const s2 = new AreaSpawner([{ spawn: post(10, 15), zone: 'A' as const }], areas, cfg, {
      spawn: (sp) => {
        const r = { id: 'x', alive: true, position: { x: sp.position.x, z: sp.position.z } };
        safe.push(r);
        return r;
      },
      despawn: () => undefined,
    }, [{ x: 12, z: 15, radius: 6 }]);
    for (let t = 0; t < 1; t += 0.05) s2.update(0.05, 10, 1);
    expect(safe).toHaveLength(0);
  });

  it('keeps robots of a sleeping area while the player is still near them', () => {
    const { live, run } = setup([{ spawn: post(10, 19), zone: 'A' }]);
    run(1, 10, 10);
    expect(live).toHaveLength(1);
    run(3, 10, 30);
    expect(live).toHaveLength(1);
  });
});
