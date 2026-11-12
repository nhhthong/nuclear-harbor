/** T-08 e2e: tower activation, interruption and countdown expiry in the sandbox. */
const RECORD = `
  window.__rec = {};
  const ev = window.__NH__.game.ctx.events;
  for (const n of ['tower:registered','tower:activationStarted','tower:activationCancelled','tower:activated',
    'objectives:defendStarted','objectives:allActivated','countdown:stopped','countdown:expired','game:checkpoint']) {
    window.__rec[n] = [];
    ev.on(n, (p) => window.__rec[n].push(JSON.parse(JSON.stringify(p))));
  }
`;

export default async function ({ openGame, setKey, wait: _wall, assert }) {
  // software GL can run slower than real time: wait in simulated seconds
  const wait = async (page, seconds) => {
    const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
    await page.waitForFunction(([a, d]) => window.__NH__.game.ctx.clock.simTime >= a + d, [t0, seconds], { timeout: 120_000, polling: 50 });
  };
  // run 1: full activation
  {
    const { page, failures } = await openGame('?sandbox&autostart&countdown=60');
    await page.evaluate(RECORD);
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 8, y: 0, z: 3.5 }));
    await wait(page, 0.3);
    await setKey(page, 'KeyE', true);
    await wait(page, 5.5);
    await setKey(page, 'KeyE', false);
    const rec = await page.evaluate(() => window.__rec);
    assert.equal(rec['tower:activated'].length, 1, 'tower:activated once');
    assert.equal(rec['tower:activated'][0].total, 1);
    assert.equal(rec['objectives:defendStarted'].length, 1, 'defendStarted once');
    assert.equal(rec['objectives:allActivated'].length, 1, 'allActivated once');
    assert.equal(rec['game:checkpoint'][0].id, 'tower-1');
    const st = await page.evaluate(() => window.__NH__.game.ctx.testHooks.objectives.getState());
    assert.equal(st.towers[0].active, true);
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }
  // run 2: release at ~3 s cancels and resets
  {
    const { page, failures } = await openGame('?sandbox&autostart&countdown=60');
    await page.evaluate(RECORD);
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 8, y: 0, z: 3.5 }));
    await wait(page, 0.3);
    await setKey(page, 'KeyE', true);
    await wait(page, 3);
    await setKey(page, 'KeyE', false);
    await wait(page, 0.4);
    const rec = await page.evaluate(() => window.__rec);
    assert.equal(rec['tower:activationCancelled'].length, 1);
    assert.equal(rec['tower:activationCancelled'][0].reason, 'released');
    assert.equal(rec['tower:activated'].length, 0);
    const st = await page.evaluate(() => window.__NH__.game.ctx.testHooks.objectives.getState());
    assert.equal(st.towers[0].progress, 0, 'progress reset');
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }
  // run 3: countdown expires exactly once
  {
    const { page, failures } = await openGame('?sandbox&autostart&countdown=2');
    await page.evaluate(RECORD);
    // game over stops the clock, so wait for the event itself rather than simulated time
    await page.waitForFunction(() => (window.__rec['countdown:expired'] ?? []).length > 0, null, { timeout: 60_000 });
    const rec = await page.evaluate(() => window.__rec);
    assert.equal(rec['countdown:expired'].length, 1, 'expired exactly once');
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }
}
