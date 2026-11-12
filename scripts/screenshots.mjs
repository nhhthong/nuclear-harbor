#!/usr/bin/env node
/**
 * Playtest screenshots (T-17): menu, harbor spawn, warehouse interior, boss arena at 1280x720,
 * device scale factor 1, software WebGL. Output: docs/playtest/<label>-<scene>.png
 *
 *   npm run build && SMOKE_PORT=4xxx node scripts/screenshots.mjs before
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { root, startHarness } from './lib/harness.mjs';

const label = process.argv[2] ?? 'shot';
const outDir = path.join(root, 'docs', 'playtest');
mkdirSync(outDir, { recursive: true });

const SCENES = [
  { name: 'menu', query: '', setup: null },
  { name: 'harbor-spawn', query: '?autostart', setup: null },
  { name: 'warehouse-interior', query: '?autostart', setup: { x: 8, z: 74, yaw: 0 } },
  { name: 'warehouse-tower1', query: '?autostart', setup: { x: 20, z: 70, yaw: 0 } },
  { name: 'boss-arena', query: '?autostart&boss', setup: { x: -28, z: -56, yaw: 0 }, waitMs: 6000 },
];

const harness = await startHarness();
try {
  for (const scene of SCENES) {
    const { page, failures } = await harness.openGame(scene.query);
    if (scene.setup) {
      await page.evaluate((s) => {
        const { ctx } = window.__NH__.game;
        ctx.player.teleport({ x: s.x, y: 0.1, z: s.z }, s.yaw);
      }, scene.setup);
    }
    await page.waitForTimeout(scene.waitMs ?? 2500);
    const file = path.join(outDir, `${label}-${scene.name}.png`);
    await page.screenshot({ path: file });
    console.log(`${scene.name}: ${file}${failures.length ? ` FAILURES ${failures.join('; ')}` : ''}`);
    await page.close();
  }
} finally {
  await harness.stop();
}
