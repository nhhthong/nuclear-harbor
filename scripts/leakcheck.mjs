#!/usr/bin/env node
/**
 * Leak check (T-17, AC5). Boots the harbor, then repeats N cycles of: play a scripted stretch
 * (fire, teleport among robots so effects spawn and robots die, collect pickups by walking), then
 * dispose the whole game and build a new one in the same page (`window.__NH__.restart()`).
 * After every cycle the GPU geometry/texture counts, tracked ResourceTracker totals, net event
 * listeners on window/document/canvas and live intervals are compared with the baseline taken after
 * the first boot. Prints JSON; exits 1 when a counter exceeds baseline + tolerance.
 *
 *   npm run build && SMOKE_PORT=4xxx npm run leakcheck [cycles=3]
 */
import { setKey, startHarness } from './lib/harness.mjs';

const CYCLES = Number(process.argv[2] ?? 3);
const TOLERANCE = 2;

const harness = await startHarness();
let ok = false;
try {
  const { page, failures } = await harness.openGame('?autostart');
  // Count net listeners / intervals from now on (the first game is already built, so the
  // baseline below includes its listeners).
  await page.evaluate(() => {
    const live = [];
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      const capture = typeof opts === 'object' ? !!opts?.capture : !!opts;
      if (!live.some((e) => e[0] === this && e[1] === type && e[2] === fn && e[3] === capture)) live.push([this, type, fn, capture]);
      return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      const capture = typeof opts === 'object' ? !!opts?.capture : !!opts;
      const i = live.findIndex((e) => e[0] === this && e[1] === type && e[2] === fn && e[3] === capture);
      if (i >= 0) live.splice(i, 1);
      return remove.call(this, type, fn, opts);
    };
    const intervals = new Set();
    const si = window.setInterval;
    const ci = window.clearInterval;
    window.setInterval = (...a) => {
      const id = si(...a);
      intervals.add(id);
      return id;
    };
    window.clearInterval = (id) => {
      intervals.delete(id);
      return ci(id);
    };
    window.__leak = {
      listeners: () => live.filter((e) => e[0] === window || e[0] === document || e[0] === document.getElementById('game-canvas')).length,
      intervals: () => intervals.size,
    };
  });

  const measure = (label) =>
    page.evaluate((l) => {
      const { ctx } = window.__NH__.game;
      const info = ctx.renderer.webgl.info;
      const mem = performance.memory?.usedJSHeapSize;
      return {
        label: l,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        tracked: ctx.resources.totalLiveResources,
        enemies: ctx.enemies.aliveCount(),
        listeners: window.__leak.listeners(),
        intervals: window.__leak.intervals(),
        heapMb: mem ? +(mem / 1048576).toFixed(1) : null,
      };
    }, label);

  const play = async () => {
    // fire in place, then walk into robot ranges so bolts, impacts, casings and kills happen
    await page.evaluate(() => window.__NH__.game.ctx.input.handleCode('Mouse0', true));
    for (const [x, z] of [[0, 80], [-60, 0], [-72, -10], [60, -90]]) {
      await page.evaluate(([px, pz]) => window.__NH__.game.ctx.player.teleport({ x: px, y: 0.1, z: pz }, 0), [x, z]);
      await page.waitForTimeout(1200);
    }
    await page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      ctx.input.handleCode('Mouse0', false);
      // kill a few robots through the damage path so death effects / pickups run
      for (const e of ctx.enemies.alive().slice(0, 5)) e.applyDamage({ amount: 1e6, zone: 'body', source: 'environment' });
    });
    await page.waitForTimeout(800);
  };

  const samples = [];
  // Warm-up restart: the listener/interval counters only see registrations made after they were
  // installed, so the baseline is taken from a game built after that point.
  await page.evaluate(() => window.__NH__.restart());
  await page.waitForTimeout(1500);
  const baseline = await measure('baseline');
  samples.push(baseline);
  for (let i = 1; i <= CYCLES; i++) {
    await play();
    await page.evaluate(() => window.__NH__.restart());
    await page.waitForTimeout(1500);
    samples.push(await measure(`after-cycle-${i}`));
  }
  const last = samples[samples.length - 1];
  const checks = ['geometries', 'textures', 'tracked', 'listeners', 'intervals'].map((k) => ({
    counter: k,
    baseline: baseline[k],
    final: last[k],
    pass: last[k] <= baseline[k] + TOLERANCE,
  }));
  const heap = samples.map((s) => s.heapMb).filter((h) => h !== null);
  const heapMonotonic = heap.length > 2 && heap.every((h, i) => i === 0 || h > heap[i - 1] + 0.5);
  ok = checks.every((c) => c.pass) && !heapMonotonic && failures.length === 0;
  console.log(JSON.stringify({ cycles: CYCLES, tolerance: TOLERANCE, samples, checks, heapMonotonicGrowth: heapMonotonic, failures, pass: ok }, null, 1));
} catch (error) {
  console.error('leakcheck crashed:', error instanceof Error ? error.message : error);
} finally {
  await harness.stop();
}
process.exit(ok ? 0 : 1);
