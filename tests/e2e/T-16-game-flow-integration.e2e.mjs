/**
 * T-16 browser integration check (harbor): robot and pickup counts, positions on the nav grid,
 * flow hooks, the "Main menu -> Play after a finished run" path and Restart (page reload).
 */
export default async function ({ openGame, assert }) {
  const { page, failures, booted } = await openGame('?autostart&debug');
  assert.ok(booted, 'harbor boots');
  const warnings = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && m.text().includes('[population]')) warnings.push(m.text());
  });
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length >= 30, null, { timeout: 30_000 });

  // robots: 14 / 10 / 6, none within 40 m of the spawn, positions inside the land
  const robots = await page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list());
  const n = (t) => robots.filter((r) => r.type === t).length;
  assert.deepEqual([n('army'), n('spot'), n('duck')], [14, 10, 6]);
  const spawn = { x: 0, z: 96 };
  for (const r of robots) {
    assert.ok(Math.hypot(r.x - spawn.x, r.z - spawn.z) > 40, `${r.type} ${r.id} more than 40 m from the spawn`);
  }

  // pickups: 14 crates and 10 medkits in the zones (boss supplies come later)
  const pk = await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.counts());
  assert.equal(pk.ammo, 14);
  assert.equal(pk.medkit, 10);
  const list = await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.list());
  assert.ok(list.filter((p) => p.position.y > 2.5).length >= 5, 'at least five supplies sit on container tops or the gantry');

  // flow hooks
  const cp = await page.evaluate(() => window.__NH__.game.ctx.testHooks.flow.getCheckpoint());
  assert.deepEqual([cp.id, cp.x, cp.z], ['spawn', 0, 96]);
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.flow.respawn()), false, 'respawn refused while alive');
  assert.deepEqual(warnings, [], 'population needed no nudging in the built harbor');

  // game over by death, then Restart reloads into a fresh run (query string kept)
  await page.evaluate(() => {
    window.__marker = 'before-reload';
    window.__NH__.game.ctx.player.applyDamage({ amount: 1e4, zone: 'body', source: 'enemy' });
  });
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.state.current), 'gameOver');
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 30_000 });
  await page.click('.nh-screen:not(.nh-hidden) [data-action="restart"]');
  await nav;
  await page.waitForFunction(() => window.__NH__?.ready, null, { timeout: 30_000 });
  assert.equal(await page.evaluate(() => window.__marker), undefined, 'page was reloaded');
  assert.ok(page.url().includes('autostart'), 'query string kept');
  await page.waitForFunction(() => window.__NH__.game.ctx.state.current === 'playing', null, { timeout: 15_000 });
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.flow.getStatus()), 'running');
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.hp), 100);

  assert.deepEqual(failures, [], 'no console errors');

  // Main menu after a death, then Play: the finished run is not resumed, a fresh run starts
  await page.evaluate(() => {
    window.__marker = 'second';
    window.__NH__.game.ctx.player.invulnerableFor = 0;
    window.__NH__.game.ctx.player.applyDamage({ amount: 1e4, zone: 'body', source: 'enemy' });
  });
  await page.click('.nh-screen:not(.nh-hidden) [data-action="quit"]');
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.state.current), 'menu');
  const nav2 = page.waitForNavigation({ waitUntil: 'load', timeout: 30_000 });
  await page.click('.nh-screen:not(.nh-hidden) [data-action="play"]');
  await nav2;
  await page.waitForFunction(() => window.__NH__?.ready, null, { timeout: 30_000 });
  assert.equal(await page.evaluate(() => window.__marker), undefined, 'Play after a finished run reloads');
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.hp), 100);
  await page.close();
}
