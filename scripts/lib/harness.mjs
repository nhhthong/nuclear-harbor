/**
 * Shared browser-test harness for scripts/smoke.mjs and scripts/e2e.mjs.
 * Serves dist/ with `vite preview` and drives headless Chromium through Playwright.
 * Playwright is resolved from the project or from the global install (NODE_PATH); browsers must
 * already be installed (never run `playwright install` here).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

export async function startHarness({ port = Number(process.env.SMOKE_PORT ?? 4173) } = {}) {
  if (!existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error('dist/ not found. Run `npm run build` first.');
  }
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    throw new Error('cannot resolve "playwright" (install it globally or as a devDependency)');
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  const start = Date.now();
  for (;;) {
    try {
      if ((await fetch(baseUrl)).ok) break;
    } catch {
      // not up yet
    }
    if (server.exitCode !== null || Date.now() - start > 20_000) {
      server.kill();
      throw new Error(`preview server did not start at ${baseUrl}\n${serverLog}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const browser = await chromium.launch({
    headless: !process.env.SMOKE_HEADED,
    // software WebGL so the tests also run on machines without a GPU
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });

  /**
   * Open the game with the given query string (e.g. '?sandbox&autostart') and wait until it is
   * ready. Returns the page plus `failures`, a live array collecting console errors, page errors
   * and failed requests. Game handle in the page: `window.__NH__.game` ({ ctx, loop }).
   */
  async function openGame(query = '?autostart') {
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
    await page.goto(`${baseUrl}/${query}`, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__NH__ && (window.__NH__.ready || window.__NH__.error), null, {
        timeout: 30_000,
      });
    } catch {
      failures.push('game did not become ready within 30 s');
    }
    const bootError = await page.evaluate(() => (window.__NH__?.game ? null : (window.__NH__?.error ?? 'no game instance')));
    if (bootError) failures.push(`boot error: ${bootError}`);
    return { page, failures, booted: !bootError };
  }

  async function stop() {
    await browser.close();
    server.kill();
  }

  return { baseUrl, browser, openGame, stop };
}

/** Press/release a logical key code through the game's InputManager (works without pointer lock). */
export async function setKey(page, code, down) {
  await page.evaluate(([c, d]) => window.__NH__.game.ctx.input.handleCode(c, d), [code, down]);
}

/** Let the simulation run for `seconds` of wall time. */
export async function wait(page, seconds) {
  await page.waitForTimeout(seconds * 1000);
}
