/**
 * T-13 / T-19: Spot dog (enemy type `spot`) in the sandbox. 70 HP, patrols, then chases, crouches
 * (telegraph) and lunges; each lunge that connects costs exactly 10 HP; the nose takes double damage;
 * applyDamage destroys it once. Two lunges are at least 2.5 s apart. Draw calls stay within budget.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=spot');
  assert.ok(booted, 'game boots');

  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });
  const [spot] = await page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list());
  assert.equal(spot.type, 'spot');
  assert.equal(spot.hp, 70);
  assert.equal(spot.state, 'patrol');

  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    window.__t13 = { states: [], destroyed: 0, alerted: 0, attacked: 0, hits: [], lungeStart: [], lungeEnd: [] };
    ctx.events.on('enemy:destroyed', () => window.__t13.destroyed++);
    ctx.events.on('enemy:alerted', () => window.__t13.alerted++);
    ctx.events.on('enemy:attacked', () => window.__t13.attacked++);
    let hp = ctx.player.hp;
    let last = null;
    ctx.events.on('player:damaged', () => {
      window.__t13.hits.push(hp - ctx.player.hp);
      hp = ctx.player.hp;
    });
    const sample = () => {
      const e = ctx.enemies.all()[0];
      if (e && e.state !== last) {
        if (e.state === 'lunge') window.__t13.lungeStart.push(ctx.clock.simTime);
        if (last === 'lunge') window.__t13.lungeEnd.push(ctx.clock.simTime);
        last = e.state;
        window.__t13.states.push(e.state);
      }
      requestAnimationFrame(sample);
    };
    sample();
    ctx.player.teleport({ x: 8, y: 0, z: -12 });
  });

  await page.waitForFunction(() => window.__t13.hits.length >= 1, null, { timeout: 30_000 });
  const seen = await page.evaluate(() => ({ ...window.__t13, hp: window.__NH__.game.ctx.player.hp }));
  assert.ok(seen.alerted >= 1, 'Spot alerted');
  assert.ok(seen.attacked >= 1, 'Spot attacked');
  for (const s of ['chase', 'telegraph', 'lunge', 'retreat']) assert.ok(seen.states.includes(s), `state ${s} observed (${seen.states.join(',')})`);
  assert.ok(seen.states.indexOf('telegraph') < seen.states.indexOf('lunge'), 'telegraph before lunge');
  assert.ok(seen.hits.every((h) => h === 10), `every connected lunge costs 10 HP (${seen.hits.join(',')})`);
  for (let i = 1; i < seen.lungeStart.length; i++) {
    assert.ok(seen.lungeStart[i] - seen.lungeEnd[i - 1] >= 2.45, 'cooldown of about 2.5 s between lunges');
  }

  // nose takes double damage
  const dmg = await page.evaluate(() => {
    const e = window.__NH__.game.ctx.enemies.all()[0];
    const body = e.applyDamage({ amount: 10, zone: 'body', source: 'player' });
    const crit = e.applyDamage({ amount: 10, zone: 'critical', source: 'player' });
    return { body: body.dealt, crit: crit.dealt };
  });
  assert.equal(dmg.crit, dmg.body * 2, 'critical zone deals double damage');

  // draw calls of one near Spot (renderer.info): compare with the robot removed
  const calls = await page.evaluate(async () => {
    const ctx = window.__NH__.game.ctx;
    const info = ctx.renderer.webgl.info;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const e = ctx.enemies.all()[0];
    await frame();
    const withRobot = info.render.calls;
    const root = e.root;
    root.visible = false;
    await frame();
    const without = info.render.calls;
    root.visible = true;
    return { withRobot, without };
  });
  assert.ok(calls.withRobot - calls.without <= 6 && calls.withRobot - calls.without >= 1, `near Spot draw calls (${calls.withRobot - calls.without})`);

  await page.evaluate(() => {
    window.__NH__.game.ctx.enemies.all()[0].applyDamage({ amount: 1000, zone: 'body', source: 'player' });
  });
  const after = await page.evaluate(() => ({
    destroyed: window.__t13.destroyed,
    registry: window.__NH__.game.ctx.enemies.all().length,
  }));
  assert.equal(after.destroyed, 1, 'enemy:destroyed emitted once');
  assert.equal(after.registry, 0, 'registry is empty');
  await wait(page, 0.5);
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
