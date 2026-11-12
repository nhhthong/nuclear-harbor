/**
 * T-16 full run in the harbor (`?autostart`): success path (menu/playing -> four towers -> boss ->
 * victory), death -> game over -> respawn at the last checkpoint with the countdown unchanged, and
 * countdown expiry -> game over without a respawn option.
 */
const RECORD = `
  window.__ev = [];
  const ev = window.__NH__.game.ctx.events;
  for (const n of ['game:over','game:victory','game:respawn','game:checkpoint','game:stateChanged','tower:activated','objectives:allActivated',
    'boss:spawned','boss:defeated','countdown:stopped','countdown:expired','player:died','pickup:spawned']) {
    ev.on(n, (p) => window.__ev.push({ n, t: window.__NH__.game.ctx.clock.simTime, reason: p.reason, id: p.id, checkpointId: p.checkpointId,
      to: p.to, towerId: p.towerId, kind: p.kind, timeRemaining: p.timeRemaining, x: p.position?.x, y: p.position?.y, z: p.position?.z }));
  }
`;

export default async function ({ openGame, setKey, assert }) {
  const mk = (page) => {
    const wait = async (seconds) => {
      const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
      await page.waitForFunction(([a, d]) => window.__NH__.game.ctx.clock.simTime >= a + d, [t0, seconds], { timeout: 180_000, polling: 50 });
    };
    const hook = (name, expr) => page.evaluate(`(() => { const h = window.__NH__.game.ctx.testHooks.${name}; return ${expr}; })()`);
    const ev = () => page.evaluate(() => window.__ev);
    const state = () => page.evaluate(() => window.__NH__.game.ctx.state.current);
    const remaining = () => hook('objectives', 'h.getState().remaining');
    const kill = () => page.evaluate(() => { window.__NH__.game.ctx.player.invulnerableFor = 0; return window.__NH__.game.ctx.player.applyDamage({ amount: 10_000, zone: 'body', source: 'enemy' }); });
    return { wait, hook, ev, state, remaining, kill };
  };
  const ready = async (page) => {
    await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length >= 30, null, { timeout: 30_000 });
    await page.evaluate(RECORD);
  };

  // ---- run 1: success path ------------------------------------------------------------------
  {
    const { page, failures, booted } = await openGame('?autostart');
    assert.ok(booted, 'harbor boots');
    await ready(page);
    const t = mk(page);
    assert.equal(await t.state(), 'playing');
    assert.equal(await t.hook('flow', 'h.getStatus()'), 'running');
    assert.equal(await t.hook('flow', 'h.getCheckpoint().id'), 'spawn');
    const start = await t.remaining();
    assert.ok(start > 0, `countdown running (${start})`);

    // tower 1 for real: walk to it and hold E (invulnerable: the walk-in is not what is tested here)
    await page.evaluate(() => {
      window.__NH__.game.ctx.player.invulnerableFor = 1e9;
      window.__NH__.game.ctx.player.teleport({ x: 20, y: 0, z: 63.5 }, 0);
    });
    await t.wait(0.4);
    await setKey(page, 'KeyE', true);
    await page.waitForFunction(() => window.__ev.some((e) => e.n === 'tower:activated'), null, { timeout: 60_000 });
    await setKey(page, 'KeyE', false);
    assert.equal(await t.hook('flow', 'h.getCheckpoint().id'), 'tower-1', 'tower 1 is the checkpoint');
    // towers 2..4 through the hook
    for (const id of [2, 3, 4]) assert.equal(await t.hook('objectives', `h.forceActivate(${id})`), true);
    await page.waitForFunction(() => window.__ev.some((e) => e.n === 'boss:spawned'), null, { timeout: 30_000 });
    const ev1 = await t.ev();
    assert.equal(ev1.filter((e) => e.n === 'tower:activated').length, 4, 'four towers');
    assert.equal(ev1.filter((e) => e.n === 'objectives:allActivated').length, 1);
    assert.equal(await t.hook('flow', 'h.getCheckpoint().id'), 'boss-start', 'boss-start checkpoint');
    assert.ok(ev1.filter((e) => e.n === 'pickup:spawned').length >= 8, 'boss supplies spawned');
    await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.counts());
    const bossSt = await t.hook('boss', 'h.getState()');
    assert.equal(bossSt.spawned, true);
    assert.equal(bossSt.scale > 0.9, true, `harbor boss at full scale (${bossSt.scale})`);

    await t.wait(4.6);
    for (const i of [0, 1, 2, 3]) await t.hook('boss', `h.damageWeakPoint(${i}, 500)`);
    await t.hook('boss', 'h.damageCore(4000)');
    await page.waitForFunction(() => window.__NH__.game.ctx.state.current === 'victory', null, { timeout: 180_000 });
    const ev2 = await t.ev();
    assert.equal(ev2.filter((e) => e.n === 'game:victory').length, 1, 'victory once');
    const defeated = ev2.find((e) => e.n === 'boss:defeated');
    const victory = ev2.find((e) => e.n === 'game:victory');
    assert.ok(victory.t - defeated.t >= 2.9 && victory.t - defeated.t < 3.5, `victory ~3 s after the defeat (${(victory.t - defeated.t).toFixed(2)} s)`);
    assert.ok(victory.timeRemaining > 0 && victory.timeRemaining <= start, `time remaining reported (${victory.timeRemaining})`);
    const best = await t.hook('flow', 'h.getBest()');
    assert.equal(best.completed, true);
    assert.equal(await t.hook('flow', 'h.getStatus()'), 'won');
    assert.deepEqual(failures, [], 'no console errors (success path)');
    await page.close();
  }

  // ---- run 2: death -> respawn (spawn, then tower checkpoint), countdown unchanged ----------------
  {
    const { page, failures } = await openGame('?autostart');
    await ready(page);
    const t = mk(page);

    // a) no checkpoint yet: respawn at the level spawn
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 30, y: 0, z: 80 }, 1));
    await t.wait(0.3);
    await t.kill();
    assert.equal(await t.state(), 'gameOver', 'death -> gameOver');
    let ev = await t.ev();
    assert.equal(ev.find((e) => e.n === 'game:over').reason, 'player-died');
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.ui.isVisible('gameOver')), true);
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.hp), 0);
    const cdBefore = await t.remaining();
    await page.click('[data-action="respawn"]');
    assert.equal(await t.state(), 'playing', 'respawn button resumes play');
    let p = await page.evaluate(() => ({ ...window.__NH__.game.ctx.player.position, hp: window.__NH__.game.ctx.player.hp }));
    assert.ok(Math.hypot(p.x - 0, p.z - 96) < 1.5, `back at the spawn (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    assert.equal(p.hp, 100, 'full HP');
    assert.equal(await t.hook('flow', 'h.getStatus()'), 'running');
    await t.wait(0.5);
    const cdAfter = await t.remaining();
    assert.ok(cdBefore - cdAfter >= 0 && cdBefore - cdAfter < 3, `countdown not reset (${cdBefore} -> ${cdAfter})`);

    // b) tower 1 active + one robot destroyed: both persist across the respawn
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 20, y: 0, z: 63.5 }, 0));
    await t.wait(0.3);
    assert.equal(await t.hook('objectives', 'h.forceActivate(1)'), true);
    const cp = await t.hook('flow', 'h.getCheckpoint()');
    assert.equal(cp.id, 'tower-1');
    await page.evaluate(() => window.__NH__.game.ctx.enemies.all().find((e) => e.type === 'sphere').applyDamage({ amount: 1000, zone: 'body', source: 'player' }));
    const aliveBefore = await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount());
    assert.equal(aliveBefore, 29);
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 100, y: 0, z: 70 }, 0));
    await t.wait(0.3);
    const cd1 = await t.remaining();
    await t.kill();
    assert.equal(await t.state(), 'gameOver');
    await page.waitForTimeout(300);
    assert.equal((await t.remaining()), cd1, 'countdown frozen while game over');
    await page.click('[data-action="respawn"]');
    assert.equal(await t.state(), 'playing');
    p = await page.evaluate(() => ({ ...window.__NH__.game.ctx.player.position, hp: window.__NH__.game.ctx.player.hp }));
    assert.ok(Math.hypot(p.x - cp.x, p.z - cp.z) < 1.5, `respawned at the tower-1 checkpoint (${p.x.toFixed(1)}, ${p.z.toFixed(1)} vs ${cp.x.toFixed(1)}, ${cp.z.toFixed(1)})`);
    assert.equal(p.hp, 100);
    const rs = (await t.ev()).filter((e) => e.n === 'game:respawn').at(-1);
    assert.equal(rs.checkpointId, 'tower-1');
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount()), 29, 'destroyed robot stays destroyed');
    assert.equal(await t.hook('objectives', 'h.getState().towers.find((x) => x.id === 1).active'), true, 'tower stays active');
    assert.ok((await t.remaining()) <= cd1, 'countdown never goes back up');
    const st = await t.hook('flow', 'h.stats()');
    assert.equal(st.deaths, 2);
    assert.equal(st.respawns, 2);

    // respawn while playing does nothing
    const pos0 = await page.evaluate(() => window.__NH__.game.ctx.player.position.x);
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('game:requestRespawn', {}));
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.position.x), pos0);
    assert.deepEqual(failures, [], 'no console errors (death path)');
    await page.close();
  }

  // ---- run 3: countdown expiry -> failure, no respawn ----------------------------------------------
  {
    const { page, failures } = await openGame('?autostart&countdown=3');
    await ready(page);
    const t = mk(page);
    await page.evaluate(() => { window.__NH__.game.ctx.player.invulnerableFor = 1e9; });
    await page.waitForFunction(() => window.__NH__.game.ctx.state.current === 'gameOver', null, { timeout: 60_000 });
    const ev = await t.ev();
    assert.equal(ev.filter((e) => e.n === 'game:over').length, 1);
    assert.equal(ev.find((e) => e.n === 'game:over').reason, 'countdown-expired');
    assert.equal(await t.hook('flow', 'h.getStatus()'), 'expired');
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.ui.isVisible('gameOver')), true);
    const hidden = await page.evaluate(() => document.querySelector('[data-action="respawn"]').classList.contains('nh-hidden'));
    assert.equal(hidden, true, 'respawn button hidden');
    assert.equal(await t.hook('flow', 'h.respawn()'), false, 'respawn refused');
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('game:requestRespawn', {}));
    assert.equal(await t.state(), 'gameOver', 'still game over after a respawn request');
    // later events are ignored: a death after the failure changes nothing
    await page.evaluate(() => { const p = window.__NH__.game.ctx.player; p.invulnerableFor = 0; p.applyDamage({ amount: 1e4, zone: 'body', source: 'enemy' }); });
    assert.equal(await t.hook('flow', 'h.getStatus()'), 'expired');
    assert.equal((await t.ev()).filter((e) => e.n === 'game:over').length, 1, 'game:over only once');
    assert.deepEqual(failures, [], 'no console errors (failure path)');
    await page.close();
  }
}
