/**
 * T-14 / T-19: Bomber Duck (enemy type `duck`) in the sandbox. It hops to the player, arms at
 * about 2.5 m, beeps 3-2-1 one second apart and detonates about 3 s after arming for exactly 15 HP
 * inside the blast radius. A duck shot dead before zero deals no damage; a player outside the radius
 * takes none. 60 HP, head crit x2.
 */
export default async function ({ openGame, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=duck');
  assert.ok(booted, 'game boots');
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });
  const [duck] = await page.evaluate(() => window.__NH__.game.ctx.testHooks.enemies.list());
  assert.equal(duck.type, 'duck');
  assert.equal(duck.hp, 60);

  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const log = (window.__t14 = { events: [], states: [], hp: ctx.player.hp, maxHop: 0 });
    for (const name of ['duck:windup', 'duck:beep', 'duck:explode', 'duck:hitPlayer', 'enemy:destroyed']) {
      ctx.events.on(name, (e) => log.events.push({ name, t: ctx.clock.simTime, count: e.count, hit: e.hitPlayer }));
    }
    const c = ctx.enemies.all()[0];
    let last = c.state;
    log.states.push(last);
    window.__t14.timer = setInterval(() => {
      if (c.state !== last) {
        last = c.state;
        log.states.push(last);
      }
    }, 5);
    ctx.player.teleport({ x: c.position.x + 8, y: 0, z: c.position.z - 6 });
  });

  // draw calls of one near duck while armed (ring visible), measured as the difference with the robot hidden
  await page.waitForFunction(() => window.__NH__.game.ctx.enemies.all()[0]?.state === 'arming', null, { timeout: 40_000 });
  const calls = await page.evaluate(async () => {
    const ctx = window.__NH__.game.ctx;
    const info = ctx.renderer.webgl.info;
    const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const root = ctx.enemies.all()[0].root;
    await frame();
    const withRobot = info.render.calls;
    root.visible = false;
    await frame();
    const without = info.render.calls;
    root.visible = true;
    return withRobot - without;
  });
  assert.ok(calls >= 1 && calls <= 6, `near duck draw calls while armed (${calls})`);

  await page.waitForFunction(() => window.__t14.events.some((e) => e.name === 'duck:explode'), null, { timeout: 40_000 });
  const r = await page.evaluate(() => ({ events: window.__t14.events, states: window.__t14.states, hp: window.__NH__.game.ctx.player.hp }));
  assert.ok(r.states.includes('hop') && r.states.includes('arming'), `hop then arming (${r.states.join(',')})`);
  const at = (n, i = 0) => r.events.filter((e) => e.name === n)[i];
  const beeps = r.events.filter((e) => e.name === 'duck:beep');
  assert.deepEqual(beeps.map((b) => b.count), [3, 2, 1], 'beeps 3-2-1');
  const fuse = at('duck:explode').t - at('duck:windup').t;
  assert.ok(fuse > 2.9 && fuse < 3.2, `explodes 3 s after arming (${fuse.toFixed(2)})`);
  assert.ok(beeps[1].t - beeps[0].t > 0.9 && beeps[1].t - beeps[0].t < 1.1, 'one second per count');
  assert.equal(at('duck:explode').hit, true, 'player inside the blast radius');
  assert.equal(100 - r.hp, 15, `exactly 15 HP lost (hp ${r.hp})`);
  assert.equal((await page.evaluate(() => window.__NH__.game.ctx.enemies.all().length)), 0, 'duck destroyed');

  // shot dead before zero: no damage
  await page.evaluate(() => {
    clearInterval(window.__t14.timer);
    const ctx = window.__NH__.game.ctx;
    ctx.player.hp = ctx.player.maxHp;
    window.__t14b = { explode: 0, hp: ctx.player.hp };
    ctx.events.on('duck:explode', () => window.__t14b.explode++);
    ctx.events.on('duck:beep', (e) => {
      if (e.count === 2) ctx.enemies.all()[0]?.applyDamage({ amount: 1000, zone: 'body', source: 'player' });
    });
    ctx.testHooks.enemies.spawn('duck', { x: 20, z: -20 });
    ctx.player.teleport({ x: 20, y: 0, z: -10 });
  });
  await page.waitForFunction(() => window.__NH__.game.ctx.enemies.all().length === 0, null, { timeout: 40_000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 3500)));
  const early = await page.evaluate(() => ({ ...window.__t14b, hp: window.__NH__.game.ctx.player.hp }));
  assert.equal(early.explode, 0, 'no explosion when shot dead');
  assert.equal(early.hp, 100, 'no blast damage when shot dead');

  // head takes double damage
  const crit = await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    ctx.testHooks.enemies.spawn('duck', { x: -20, z: -20 });
    const e = ctx.enemies.all()[0];
    const body = e.applyDamage({ amount: 5, zone: 'body', source: 'player' });
    const head = e.applyDamage({ amount: 5, zone: 'critical', source: 'player' });
    return { body: body.dealt, head: head.dealt };
  });
  assert.equal(crit.head, crit.body * 2, 'head crit x2');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
