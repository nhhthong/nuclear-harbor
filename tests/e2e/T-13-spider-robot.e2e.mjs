/**
 * T-13: spider robot in the sandbox. Spawns as type `spider` with 150 HP, reaches `flank` then
 * `attack` when the player is in range with line of sight, damages the player in 12-point hits,
 * takes double damage on the dome, and is destroyed by applyDamage. Two spiders flank opposite sides.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=spider');
  assert.ok(booted, 'game boots');

  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });
  const [spider] = await page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list());
  assert.equal(spider.type, 'spider');
  assert.equal(spider.hp, 150);
  assert.equal(spider.state, 'patrol');

  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    window.__t13 = { states: [], destroyed: 0, alerted: 0, attacked: 0 };
    ctx.events.on('enemy:destroyed', () => window.__t13.destroyed++);
    ctx.events.on('enemy:alerted', () => window.__t13.alerted++);
    ctx.events.on('enemy:attacked', () => window.__t13.attacked++);
    const sample = () => {
      const e = ctx.enemies.all()[0];
      if (e) {
        const last = window.__t13.states[window.__t13.states.length - 1];
        if (last !== e.state) window.__t13.states.push(e.state);
      }
      requestAnimationFrame(sample);
    };
    sample();
    ctx.player.teleport({ x: 8, y: 0, z: -12 });
  });

  await page.waitForFunction(() => window.__NH__.game.ctx.player.hp < 100, null, { timeout: 25_000 });
  const seen = await page.evaluate(() => ({ ...window.__t13, hp: window.__NH__.game.ctx.player.hp }));
  assert.ok(seen.alerted >= 1, 'spider alerted');
  assert.ok(seen.attacked >= 1, 'spider attacked');
  assert.ok(seen.states.includes('flank'), `flank state observed (${seen.states.join(',')})`);
  assert.ok(seen.states.includes('attack'), `attack state observed (${seen.states.join(',')})`);
  assert.ok(seen.states.indexOf('flank') < seen.states.indexOf('attack'), 'flank before attack');
  assert.ok((100 - seen.hp) % 12 === 0, `player lost HP in 12-point hits (hp ${seen.hp})`);

  // dome takes double damage
  const dmg = await page.evaluate(() => {
    const e = window.__NH__.game.ctx.enemies.all()[0];
    const body = e.applyDamage({ amount: 10, zone: 'body', source: 'player' });
    const crit = e.applyDamage({ amount: 10, zone: 'critical', source: 'player' });
    return { body: body.dealt, crit: crit.dealt };
  });
  assert.equal(dmg.crit, dmg.body * 2, 'critical zone deals double damage');

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

  // two spiders pick opposite flank sides
  const two = await openGame('?sandbox&autostart&enemies=spider,spider');
  await two.page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 2, null, { timeout: 10_000 });
  const sides = await two.page.evaluate(() => window.__NH__.game.ctx.enemies.all().map((e) => e.flankSide));
  assert.ok(sides[0] !== undefined && sides[0] === -sides[1], `opposite flank sides (${sides.join(',')})`);
  assert.deepEqual(two.failures, [], 'no console errors (two spiders)');
  await two.page.close();
}
