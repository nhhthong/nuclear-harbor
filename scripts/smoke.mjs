#!/usr/bin/env node
/**
 * Smoke test: serves the production build with `vite preview`, opens it in headless Chromium and
 * checks that the game boots, renders and simulates without console errors.
 *
 *   npm run build && npm run smoke
 *
 * Options (env): SMOKE_PORT (default 4173), SMOKE_HEADED=1, SMOKE_SCREENSHOT_DIR=<dir>.
 * Playwright is resolved from the project or from the global install (NODE_PATH); browsers must
 * already be installed (never run `playwright install` in CI containers that ship them).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SMOKE_PORT ?? 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const require = createRequire(import.meta.url);

/** Pages to check: the real game and the sandbox test scene. */
const SCENARIOS = [
  { name: 'harbor', query: '?autostart' },
  { name: 'sandbox', query: '?sandbox&autostart', expectColliders: true },
  { name: 'menu', query: '', expectState: 'menu' },
];

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('smoke: cannot resolve "playwright". Install it globally or add it as a devDependency.');
    process.exit(2);
  }
}

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() - start > timeoutMs) throw new Error(`preview server did not start at ${url}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function runScenario(browser, scenario) {
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') failures.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => failures.push(`requestfailed: ${req.url()} ${req.failure()?.errorText ?? ''}`));
  page.on('response', (res) => {
    if (res.status() >= 400) failures.push(`http ${res.status()}: ${res.url()}`);
  });

  await page.goto(`${baseUrl}/${scenario.query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__NH__ && (window.__NH__.ready || window.__NH__.error), null, {
      timeout: 30_000,
    });
  } catch {
    failures.push('game did not become ready within 30 s');
  }

  const first = await page.evaluate(() => {
    const nh = window.__NH__;
    if (!nh?.game) return { error: nh?.error ?? 'no game instance' };
    return { frame: nh.game.loop.frameCount, tick: nh.game.loop.fixedTickCount };
  });
  if (first.error) failures.push(`boot error: ${first.error}`);

  if (!first.error) {
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const { game } = window.__NH__;
      const { ctx, loop } = game;
      const canvas = ctx.canvas;
      // Render and read back in the same task (the drawing buffer is not preserved).
      ctx.renderer.render(ctx.scene);
      const gl = ctx.renderer.webgl.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const pixels = new Uint8Array(4 * 64);
      let lit = 0;
      const seen = new Set();
      for (let i = 0; i < 64; i++) {
        const x = Math.floor(((i % 8) + 0.5) * (w / 8));
        const y = Math.floor((Math.floor(i / 8) + 0.5) * (h / 8));
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels, i * 4);
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        if (r + g + b > 24) lit++;
        seen.add(`${r >> 3},${g >> 3},${b >> 3}`);
      }
      return {
        frame: loop.frameCount,
        tick: loop.fixedTickCount,
        state: ctx.state.current,
        colliders: ctx.physics.colliderCount,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        litSamples: lit,
        distinctColors: seen.size,
        drawCalls: ctx.renderer.webgl.info.render.calls,
        contextLost: gl.isContextLost(),
      };
    });

    const expectState = scenario.expectState ?? 'playing';
    if (result.contextLost) failures.push('WebGL context lost');
    if (result.canvasWidth < 300 || result.canvasHeight < 150) failures.push(`canvas too small: ${result.canvasWidth}x${result.canvasHeight}`);
    if (result.frame <= first.frame) failures.push('render loop is not advancing');
    if (result.state !== expectState) failures.push(`state is "${result.state}", expected "${expectState}"`);
    if (expectState === 'playing' && result.tick <= first.tick) failures.push('fixed simulation is not advancing');
    if (expectState !== 'playing' && result.tick !== 0) failures.push('simulation ran outside the playing state');
    if (result.litSamples === 0) failures.push('canvas is black (nothing rendered)');
    if (scenario.expectColliders) {
      if (result.colliders < 5) failures.push(`expected sandbox colliders, got ${result.colliders}`);
      if (result.distinctColors < 2) failures.push('sandbox scene rendered a single flat colour');
    }
    const fps = ((result.frame - first.frame) / 1.5).toFixed(0);
    console.log(
      `  ${scenario.name}: state=${result.state} frames/s~${fps} ticks=${result.tick} colliders=${result.colliders} ` +
        `drawCalls=${result.drawCalls} lit=${result.litSamples}/64 colours=${result.distinctColors}`,
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
  if (!existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('smoke: dist/ not found. Run `npm run build` first.');
    process.exit(2);
  }
  const { chromium } = loadPlaywright();
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [viteBin, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  let browser;
  let failed = false;
  try {
    await waitForServer(baseUrl);
    browser = await chromium.launch({
      headless: !process.env.SMOKE_HEADED,
      // software WebGL so the test also runs on machines without a GPU
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    });
    console.log(`smoke: ${baseUrl}`);
    for (const scenario of SCENARIOS) {
      const failures = await runScenario(browser, scenario);
      if (failures.length > 0) {
        failed = true;
        console.error(`  FAIL ${scenario.name}`);
        for (const f of failures) console.error(`    - ${f}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error('smoke: crashed', error);
    if (serverLog) console.error(serverLog);
  } finally {
    await browser?.close();
    server.kill();
  }
  console.log(failed ? 'smoke: FAILED' : 'smoke: OK');
  process.exit(failed ? 1 : 0);
}

main();
