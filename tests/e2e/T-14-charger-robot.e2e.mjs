/**
 * T-14: Charger in the sandbox. With the player ~10 m away it telegraphs (charger:windup), charges
 * ~1 s later, hits the sandbox wall and is stunned for ~2.5 s; frontal shots deal 2.5, rear shots 50.
 * A second Charger aimed along the slab edge stops before it and stays on the slab.
 */
export default async function ({ openGame, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=charger');
  assert.ok(booted, 'game boots');
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });

  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const log = (window.__t14 = { events: [], states: [] });
    for (const name of ['charger:windup', 'charger:chargeStarted', 'charger:stunned', 'charger:hitPlayer']) {
      ctx.events.on(name, (e) => log.events.push({ name, t: ctx.clock.simTime, dir: e.direction ? { x: e.direction.x, z: e.direction.z } : null }));
    }
    const c = ctx.enemies.all()[0];
    let last = c.state;
    log.states.push({ s: last, t: ctx.clock.simTime });
    const poll = () => {
      if (c.state !== last) {
        last = c.state;
        log.states.push({ s: last, t: ctx.clock.simTime });
      }
    };
    ctx.events.on('weapon:fired', poll);
    window.__t14.timer = setInterval(poll, 5);
    // stand ~10 m from the charger on the wall side, then it must wind up
    const dx = 8;
    const dz = -6;
    ctx.player.teleport({ x: c.position.x + dx, y: 0, z: c.position.z + dz });
  });

  await page.waitForFunction(() => window.__t14.events.some((e) => e.name === 'charger:chargeStarted'), null, { timeout: 25_000 });
  // dodge: leave the line completely after the charge starts
  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    ctx.player.teleport({ x: -20, y: 0, z: 10 });
  });
  await page.waitForFunction(() => window.__t14.events.some((e) => e.name === 'charger:stunned'), null, { timeout: 15_000 });

  const wind = await page.evaluate(() => window.__t14.events);
  const at = (n) => wind.find((e) => e.name === n);
  const gap = at('charger:chargeStarted').t - at('charger:windup').t;
  assert.ok(gap > 0.9 && gap < 1.3, `charge starts ~1 s after the wind-up (gap ${gap.toFixed(2)})`);
  assert.ok(!wind.some((e) => e.name === 'charger:hitPlayer'), 'dodged: no contact');

  // stunned for ~2.5 s of simulation time
  await page.waitForFunction(
    () => {
      const st = window.__t14.states;
      const i = st.findIndex((s) => s.s === 'stunned');
      return i >= 0 && st[i + 1] !== undefined;
    },
    null,
    { timeout: 15_000 },
  );
  const stun = await page.evaluate(() => {
    const st = window.__t14.states;
    const i = st.findIndex((s) => s.s === 'stunned');
    return { duration: st[i + 1].t - st[i].t, next: st[i + 1].s };
  });
  assert.ok(stun.duration > 2.4 && stun.duration < 2.7, `stunned ~2.5 s (got ${stun.duration.toFixed(2)})`);

  // damage zones: facing vector = (-sin yaw, -cos yaw); a shot travelling along it hits the rear
  const dmg = await page.evaluate(() => {
    const c = window.__NH__.game.ctx.enemies.all()[0];
    const f = { x: -Math.sin(c.yaw), y: 0, z: -Math.cos(c.yaw) };
    const front = c.applyDamage({ amount: 25, zone: 'body', source: 'player', direction: { x: -f.x, y: 0, z: -f.z } });
    const rear = c.applyDamage({ amount: 25, zone: 'body', source: 'player', direction: f });
    return { front, rear, hp: c.hp };
  });
  assert.equal(dmg.front.zone, 'armor');
  assert.equal(dmg.front.dealt, 2.5);
  assert.equal(dmg.rear.zone, 'critical');
  assert.equal(dmg.rear.dealt, 50);
  assert.equal(dmg.hp, 200 - 52.5);

  // slab edge: charger at z = 20 charging towards +Z must stop before z = 40
  await page.evaluate(() => {
    clearInterval(window.__t14.timer);
    const ctx = window.__NH__.game.ctx;
    ctx.testHooks.enemies.killAll();
    ctx.testHooks.enemies.spawn('charger', { x: 30, z: 20 });
    window.__t14b = { started: false, maxZ: -Infinity, minX: Infinity, maxX: -Infinity };
    ctx.events.on('charger:chargeStarted', () => {
      window.__t14b.started = true;
      ctx.player.teleport({ x: 10, y: 0, z: 10 });
    });
    window.__t14b.timer = setInterval(() => {
      const e = ctx.enemies.all()[0];
      if (!e) return;
      window.__t14b.maxZ = Math.max(window.__t14b.maxZ, e.position.z + 1.3);
      window.__t14b.minX = Math.min(window.__t14b.minX, e.position.x);
      window.__t14b.maxX = Math.max(window.__t14b.maxX, e.position.x);
    }, 5);
    ctx.player.teleport({ x: 30, y: 0, z: 34 });
  });
  await page.waitForFunction(() => window.__t14b.started, null, { timeout: 25_000 });
  await page.waitForFunction(
    () => {
      const e = window.__NH__.game.ctx.enemies.all()[0];
      return e && e.state !== 'charge' && e.state !== 'windup';
    },
    null,
    { timeout: 15_000 },
  );
  const edge = await page.evaluate(() => {
    clearInterval(window.__t14b.timer);
    const e = window.__NH__.game.ctx.enemies.all()[0];
    return { ...window.__t14b, state: e.state, z: e.position.z };
  });
  assert.ok(edge.maxZ < 40, `stayed on the slab (front reached z ${edge.maxZ.toFixed(2)})`);
  assert.equal(edge.state, 'recover', 'ended the charge in recover');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
