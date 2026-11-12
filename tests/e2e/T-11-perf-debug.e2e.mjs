/** T-11: debug overlay, snapshot, collider view, benchmark. No FPS thresholds (software GL). */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart&debug');
  await wait(page, 1.0);

  const visible = () => page.evaluate(() => {
    const el = document.getElementById('nh-debug-overlay');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  assert.ok(await visible(), 'overlay visible with ?debug');
  const text = await page.evaluate(() => document.getElementById('nh-debug-overlay').textContent);
  assert.match(text, /FPS\s+\d+/, 'overlay shows numeric fps');
  assert.match(text, /draw calls\s+\d+/, 'overlay shows draw calls');

  const snap = await page.evaluate(() => window.__NH__.game.ctx.testHooks.debug.snapshot());
  for (const k of ['fps', 'avgMs', 'drawCalls', 'triangles', 'geometries', 'textures', 'colliders', 'trackedTotal']) {
    assert.ok(Number.isFinite(snap[k]), `snapshot.${k} finite (${snap[k]})`);
  }
  assert.ok(snap.colliders > 0, 'colliders counted');

  // collider view: F4
  const key = (code) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
  const lineCount = () => page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const o = ctx.scene.getObjectByName('debug-colliders');
    return { visible: o.visible, draw: o.geometry.drawRange.count };
  });
  assert.equal((await lineCount()).visible, false, 'collider view off by default');
  await key('F4');
  await wait(page, 0.6);
  const on = await lineCount();
  assert.ok(on.visible && on.draw > 0, 'collider view shows lines');

  // benchmark
  const report = await page.evaluate(() => window.__NH__.game.ctx.testHooks.debug.startBenchmark(2));
  assert.ok(report.frames > 0 && Number.isFinite(report.fps.avg), 'benchmark report has fps stats');
  assert.ok(Number.isFinite(report.delta.geometries), 'benchmark has resource deltas');
  const last = await page.evaluate(() => window.__NH__.game.ctx.testHooks.debug.lastReport);
  assert.ok(last && last.frames === report.frames, 'lastReport stored');

  // F6 delta reset, toggle hides
  await key('F6');
  await key('Backquote');
  await wait(page, 0.2);
  assert.equal(await visible(), false, 'toggle hides overlay');
  await key('F3');
  assert.equal(await visible(), true, 'F3 shows overlay');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
