#!/usr/bin/env node
/**
 * Offline proof (T-17, GDD 14, AC6 + AC7): loads the production build once online, waits for the
 * service worker to precache, then blocks the network and reloads. The game must boot, reach
 * `playing` and simulate with zero failed requests. Also asserts that no request ever leaves the
 * origin, and that the web manifest and icons are served.
 *
 *   npm run build && SMOKE_PORT=4xxx npm run offline
 */
import assert from 'node:assert/strict';
import { startHarness } from './lib/harness.mjs';

const harness = await startHarness();
let ok = false;
try {
  const context = await harness.browser.newContext({ viewport: { width: 1280, height: 720 } });
  const origin = new URL(harness.baseUrl).origin;
  const foreign = [];
  const failed = [];
  const errors = [];
  const page = await context.newPage();
  page.on('request', (req) => {
    const u = req.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  page.on('requestfailed', (req) => failed.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  const boot = async (label) => {
    await page.goto(`${harness.baseUrl}/?autostart`, { waitUntil: 'load' });
    console.error('stage', label);
    await page.waitForFunction(() => window.__NH__ && (window.__NH__.ready || window.__NH__.error), null, { timeout: 60_000 });
    const info = await page.evaluate(async () => {
      const { ctx, loop } = window.__NH__.game;
      const t0 = loop.fixedTickCount;
      await new Promise((r) => setTimeout(r, 1200));
      return { error: window.__NH__.error, state: ctx.state.current, ticks: loop.fixedTickCount - t0 };
    });
    assert.equal(info.error, null, `${label}: boot error ${info.error}`);
    assert.equal(info.state, 'playing', `${label}: state`);
    assert.ok(info.ticks > 0, `${label}: simulation advances`);
    return info;
  };

  // 1. online first load
  await boot('online');
  const cacheInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const name = keys.find((k) => k.startsWith('nh-'));
    const entries = name ? await (await caches.open(name)).keys() : [];
    return { active: !!reg.active, scope: reg.scope, caches: keys, entries: entries.map((r) => new URL(r.url).pathname) };
  });
  assert.ok(cacheInfo.active, 'service worker active');
  assert.equal(cacheInfo.caches.length, 1, `exactly one versioned cache: ${cacheInfo.caches}`);
  assert.ok(cacheInfo.entries.some((p) => p.endsWith('.glb')), 'GLB precached');
  assert.ok(cacheInfo.entries.some((p) => /assets\/vendor-three-.*\.js$/.test(p)), 'three chunk precached');
  assert.ok(cacheInfo.entries.some((p) => p.endsWith('manifest.webmanifest')), 'manifest precached');
  const manifestOk = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const m = await (await fetch(link.href)).json();
    const icons = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, link.href))).ok));
    return { name: m.name, display: m.display, icons: icons.every(Boolean), count: m.icons.length };
  });
  assert.ok(manifestOk.icons && manifestOk.count >= 2, 'manifest icons load');

  // 2. network blocked, reload
  await context.setOffline(true);
  const failedBefore = failed.length;
  const offlineInfo = await boot('offline');
  const offlineFailures = failed.slice(failedBefore);
  assert.deepEqual(offlineFailures, [], 'no failed requests while offline');
  assert.deepEqual(errors, [], 'no console errors');
  assert.deepEqual(foreign, [], 'no cross-origin requests');

  console.log(
    JSON.stringify(
      {
        offlineBoot: 'ok',
        state: offlineInfo.state,
        ticksIn1_2s: offlineInfo.ticks,
        precachedEntries: cacheInfo.entries.length,
        cacheName: cacheInfo.caches[0],
        crossOriginRequests: foreign.length,
        failedRequestsOffline: offlineFailures.length,
        manifest: manifestOk,
      },
      null,
      1,
    ),
  );
  ok = true;
} catch (error) {
  console.error('offline check FAILED:', error instanceof Error ? error.message : error);
} finally {
  await harness.stop();
}
process.exit(ok ? 0 : 1);
