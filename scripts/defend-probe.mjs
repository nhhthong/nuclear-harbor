#!/usr/bin/env node
/**
 * Defend-phase lethality probe (T-17, PLAYTEST finding 2). For each harbor tower: teleport next to
 * it, hold E for the full activation time WITHOUT shooting or dodging (worst case for a passive
 * player) and report HP lost, whether the tower activated, time of death and robots within 30 m.
 * Uses wall-clock waiting on software GL, so results vary a little between runs.
 *
 *   npm run build && SMOKE_PORT=4xxx node scripts/defend-probe.mjs [towerIds, e.g. 1,2,4]
 */
import { setKey, startHarness } from './lib/harness.mjs';

const TOWERS = { 1: [20, 0, 62], 2: [-72, 0, -12], 3: [72, 10, -12], 4: [60, 0, -96] };
const ids = (process.argv[2] ?? '1,2,3,4').split(',').map(Number);
const harness = await startHarness();
const results = [];
try {
  for (const id of ids) {
    const [x, y, z] = TOWERS[id];
    const { page } = await harness.openGame('?autostart&countdown=3000');
    await page.evaluate(
      ([px, py, pz]) => window.__NH__.game.ctx.player.teleport({ x: px, y: py + 0.1, z: pz + 1.2 }, 0),
      [x, y, z],
    );
    await page.waitForTimeout(600);
    const before = await page.evaluate(([tx, tz]) => {
      const { ctx, loop } = window.__NH__.game;
      let near = 0;
      const types = {};
      for (const e of ctx.enemies.all()) {
        if (e.position && Math.hypot(e.position.x - tx, e.position.z - tz) < 30) {
          near++;
          types[e.type] = (types[e.type] ?? 0) + 1;
        }
      }
      window.__dmg = [];
      ctx.events.on('player:damaged', (d) => window.__dmg.push([+(loop.simTime).toFixed(2), d.amount]));
      return { hp: ctx.player.hp, near, types, sim: loop.simTime };
    }, [x, z]);
    await setKey(page, 'KeyE', true);
    // poll in simulated time (software GL runs slower than real time)
    const outcome = await page.evaluate(async (towerId) => {
      const { ctx, loop } = window.__NH__.game;
      const start = loop.simTime;
      let deathAt = null;
      let activatedAt = null;
      while (loop.simTime - start < 6.5) {
        await new Promise((r) => setTimeout(r, 50));
        if (deathAt === null && !ctx.player.alive) deathAt = loop.simTime - start;
        const t = ctx.testHooks.objectives.getState().towers.find((q) => q.id === towerId);
        if (activatedAt === null && t?.active) {
          activatedAt = loop.simTime - start;
          break;
        }
        if (deathAt !== null) break;
      }
      return { hp: ctx.player.hp, deathAt, activatedAt, hits: window.__dmg.length, firstHits: window.__dmg.slice(0, 40) };
    }, id);
    await setKey(page, 'KeyE', false);
    results.push({ tower: id, hpBefore: before.hp, robotsWithin30m: before.near, types: before.types, hits: outcome.hits, hitLog: process.env.HITLOG ? outcome.firstHits : undefined, hpAfter: outcome.hp, hpLost: before.hp - outcome.hp, activatedAtSimS: outcome.activatedAt, diedAtSimS: outcome.deathAt });
    await page.close();
  }
} finally {
  await harness.stop();
}
console.log(JSON.stringify(results, null, 1));
