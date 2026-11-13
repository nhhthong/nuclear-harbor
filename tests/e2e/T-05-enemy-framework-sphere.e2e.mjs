/**
 * T-05 (updated by T-20): the army mech (internal type 'sphere') in the sandbox. It spawns, detects the player
 * teleported within range with line of sight, fires rockets and reduces player HP; killing it through applyDamage emits
 * enemy:destroyed and empties the registry. `?enemies=spider,charger` spawns the placeholders.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=sphere');
  assert.ok(booted, 'game boots');

  const hooks = () => page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list());
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });
  const [robot] = await hooks();
  assert.equal(robot.type, 'sphere');
  assert.equal(robot.hp, 150);
  assert.equal(robot.state, 'patrol');

  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    window.__t05 = { destroyed: [], alerted: 0, attacked: 0 };
    ctx.events.on('enemy:destroyed', (e) => window.__t05.destroyed.push({ id: e.id, remaining: e.remaining }));
    ctx.events.on('enemy:alerted', () => window.__t05.alerted++);
    ctx.events.on('enemy:attacked', () => window.__t05.attacked++);
    // ~16 m from the robot patrol loop around (0, -24), beside the sandbox pillar: clear line of sight
    ctx.player.teleport({ x: 8, y: 0, z: -12 });
  });

  await page.waitForFunction(() => window.__NH__.game.ctx.player.hp < 100, null, { timeout: 15_000 });
  const seen = await page.evaluate(() => ({ ...window.__t05, hp: window.__NH__.game.ctx.player.hp }));
  assert.ok(seen.alerted >= 1, 'robot alerted');
  assert.ok(seen.attacked >= 1, 'robot attacked');
  assert.ok(seen.hp < 100 && (100 - seen.hp) % 12 === 0, `player lost HP in 12-point rocket hits (hp ${seen.hp})`);

  // kill it through the shared damage path
  await page.evaluate(() => {
    const e = window.__NH__.game.ctx.enemies.all()[0];
    e.applyDamage({ amount: 1000, zone: 'body', source: 'player' });
  });
  const after = await page.evaluate(() => ({
    destroyed: window.__t05.destroyed,
    registry: window.__NH__.game.ctx.enemies.all().length,
  }));
  assert.equal(after.destroyed.length, 1, 'enemy:destroyed emitted once');
  assert.equal(after.destroyed[0].remaining, 0);
  assert.equal(after.registry, 0, 'registry is empty');
  await wait(page, 0.5);
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();

  // placeholders spawn through the same framework
  const second = await openGame('?sandbox&autostart&enemies=spider,charger');
  await second.page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 2, null, { timeout: 10_000 });
  const types = (await second.page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list())).map((e) => e.type).sort();
  assert.deepEqual(types, ['charger', 'spider']);
  assert.deepEqual(second.failures, [], 'no console errors (placeholders)');
  await second.page.close();

  // harbor: 14 / 10 / 6 robots (open nav grid when no world module is present yet)
  const harbor = await openGame('?autostart');
  await harbor.page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length >= 30, null, { timeout: 15_000 });
  const counts = await harbor.page.evaluate(() => {
    const list = window.__NH__.game.ctx.testHooks.enemies.list();
    const n = (t) => list.filter((e) => e.type === t).length;
    return { sphere: n('sphere'), spider: n('spider'), charger: n('charger') };
  });
  assert.deepEqual(counts, { sphere: 14, spider: 10, charger: 6 });
  assert.deepEqual(harbor.failures, [], 'no console errors (harbor)');
  await harbor.page.close();
}
