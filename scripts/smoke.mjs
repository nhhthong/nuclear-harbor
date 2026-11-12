#!/usr/bin/env node
/**
 * Smoke test: serves the production build, opens it in headless Chromium and checks that the
 * game boots, renders and simulates without console errors.
 *
 *   npm run build && npm run smoke
 *
 * Env: SMOKE_PORT (default 4173), SMOKE_HEADED=1, SMOKE_SCREENSHOT_DIR=<dir>.
 * FOUNDATION-OWNED: feature tickets add checks under tests/e2e/ instead (see scripts/e2e.mjs).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { startHarness } from './lib/harness.mjs';

/** Pages to check: the real game, the sandbox test scene and the menu state. */
const SCENARIOS = [
  { name: 'harbor', query: '?autostart' },
  { name: 'sandbox', query: '?sandbox&autostart', expectColliders: true },
  { name: 'menu', query: '', expectState: 'menu' },
];
const SAMPLE_SECONDS = 1.5;

async function runScenario(harness, scenario) {
  const { page, failures, booted } = await harness.openGame(scenario.query);
  if (booted) {
    const first = await page.evaluate(() => {
      const { loop } = window.__NH__.game;
      return { frame: loop.frameCount, tick: loop.fixedTickCount };
    });
    await page.waitForTimeout(SAMPLE_SECONDS * 1000);
    const result = await page.evaluate(() => {
      const { ctx, loop } = window.__NH__.game;
      // Render and read back in the same task (the drawing buffer is not preserved).
      ctx.renderer.render(ctx.scene);
      const gl = ctx.renderer.webgl.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(4);
      let lit = 0;
      const seen = new Set();
      for (let i = 0; i < 64; i++) {
        const x = Math.floor(((i % 8) + 0.5) * (w / 8));
        const y = Math.floor((Math.floor(i / 8) + 0.5) * (h / 8));
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        if (px[0] + px[1] + px[2] > 24) lit++;
        seen.add(`${px[0] >> 3},${px[1] >> 3},${px[2] >> 3}`);
      }
      return {
        frame: loop.frameCount,
        tick: loop.fixedTickCount,
        state: ctx.state.current,
        colliders: ctx.physics.colliderCount,
        canvasWidth: ctx.canvas.width,
        canvasHeight: ctx.canvas.height,
        litSamples: lit,
        distinctColors: seen.size,
        drawCalls: ctx.renderer.webgl.info.render.calls,
        shadowAutoUpdate: ctx.renderer.webgl.shadowMap.autoUpdate,
        maxDrawCalls: ctx.tunables.PERFORMANCE.maxDrawCalls,
        contextLost: gl.isContextLost(),
      };
    });

    const expectState = scenario.expectState ?? 'playing';
    if (result.contextLost) failures.push('WebGL context lost');
    if (result.canvasWidth < 300 || result.canvasHeight < 150) {
      failures.push(`canvas too small: ${result.canvasWidth}x${result.canvasHeight}`);
    }
    if (result.frame <= first.frame) failures.push('render loop is not advancing');
    if (result.state !== expectState) failures.push(`state is "${result.state}", expected "${expectState}"`);
    if (expectState === 'playing' && result.tick <= first.tick) failures.push('fixed simulation is not advancing');
    if (expectState !== 'playing' && result.tick !== 0) failures.push('simulation ran outside the playing state');
    // T-17: every state stays within the global draw-call budget, shadows are not auto-updated
    if (result.drawCalls > result.maxDrawCalls) failures.push(`draw calls ${result.drawCalls} > budget ${result.maxDrawCalls}`);
    if (result.shadowAutoUpdate) failures.push('shadowMap.autoUpdate must be false (static shadows, T-17)');
    if (result.litSamples === 0) failures.push('canvas is black (nothing rendered)');
    if (scenario.expectColliders) {
      if (result.colliders < 5) failures.push(`expected sandbox colliders, got ${result.colliders}`);
      if (result.distinctColors < 2) failures.push('sandbox scene rendered a single flat colour');
    }
    const fps = ((result.frame - first.frame) / SAMPLE_SECONDS).toFixed(0);
    console.log(
      `  ${scenario.name}: state=${result.state} fps~${fps} (software GL) ticks=${result.tick} ` +
        `colliders=${result.colliders} drawCalls=${result.drawCalls} lit=${result.litSamples}/64 colours=${result.distinctColors}`,
    );
  }

  const shotDir = process.env.SMOKE_SCREENSHOT_DIR;
  if (shotDir) {
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: path.join(shotDir, `smoke-${scenario.name}.png`) });
  }
  await page.close();
  return failures;
}

async function main() {
  let harness;
  let failed = false;
  try {
    harness = await startHarness();
    console.log(`smoke: ${harness.baseUrl}`);
    for (const scenario of SCENARIOS) {
      const failures = await runScenario(harness, scenario);
      if (failures.length > 0) {
        failed = true;
        console.error(`  FAIL ${scenario.name}`);
        for (const f of failures) console.error(`    - ${f}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error('smoke: crashed:', error instanceof Error ? error.message : error);
  } finally {
    await harness?.stop();
  }
  console.log(failed ? 'smoke: FAILED' : 'smoke: OK');
  process.exit(failed ? 1 : 0);
}

main();
