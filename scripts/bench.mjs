#!/usr/bin/env node
/**
 * Benchmark matrix (T-17, AC1): three scenes x three quality presets using the T-11 benchmark.
 * Software WebGL in headless Chromium: numbers are RELATIVE (draw calls, triangles, resources are
 * exact; fps / frame time are not representative of real hardware).
 *
 *   npm run build && SMOKE_PORT=4xxx npm run bench [secondsPerRun=4]
 *
 * Real devices: open the built game with `?autostart&bench=20` (or `?sandbox&autostart&bench=20`), keep
 * the tab focused, and copy the `BENCH {json}` line from the console (see docs/PERFORMANCE.md).
 */
import { startHarness } from './lib/harness.mjs';

const SECONDS = Number(process.argv[2] ?? 4);
const SCENES = [
  { name: 'spawn', query: '?autostart', at: null },
  { name: 'yard-robots', query: '?autostart', at: { x: -60, z: 0, yaw: 0 } },
  { name: 'boss-fight', query: '?autostart&boss', at: { x: -28, z: -56, yaw: 0 }, settle: 5000 },
];
const PRESETS = ['low', 'medium', 'high'];

const harness = await startHarness();
const rows = [];
try {
  for (const scene of SCENES) {
    for (const preset of PRESETS) {
      const { page } = await harness.openGame(scene.query);
      await page.evaluate(
        ([p, at]) => {
          const { ctx } = window.__NH__.game;
          ctx.settings.set('quality', p);
          if (at) ctx.player.teleport({ x: at.x, y: 0.1, z: at.z }, at.yaw);
        },
        [preset, scene.at],
      );
      await page.waitForTimeout(scene.settle ?? 2000);
      const report = await page.evaluate((s) => window.__NH__.game.ctx.testHooks.debug.startBenchmark(s), SECONDS);
      const alive = await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount());
      rows.push({
        scene: scene.name,
        preset,
        robotsAlive: alive,
        fpsAvg: +report.fps.avg.toFixed(1),
        frameMsAvg: +report.frameMs.avg.toFixed(1),
        frameMsMax: +report.frameMs.max.toFixed(1),
        maxDrawCalls: report.maxDrawCalls,
        maxTriangles: report.maxTriangles,
        geometries: report.end.geometries,
        textures: report.end.textures,
        heapMb: Number.isFinite(report.end.heapMb) ? +report.end.heapMb.toFixed(1) : null,
      });
      await page.close();
    }
  }
} finally {
  await harness.stop();
}
console.log(JSON.stringify(rows, null, 1));
