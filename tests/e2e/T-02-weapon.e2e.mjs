/**
 * T-02 weapon e2e: automatic fire rate, hit zones, impact, reload timing, ammo grant, dead state.
 * Runs in ?sandbox&autostart against the foundation target dummies.
 */
export default async function ({ openGame, setKey, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');

  // event log inside the page
  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const log = { hit: [], impact: [], fired: 0, dry: 0, reloadStart: [], reloadEnd: [], ammo: [] };
    window.__log = log;
    ctx.events.on('combat:hit', (e) => log.hit.push({ zone: e.zone, dealt: e.dealt, id: e.targetId }));
    ctx.events.on('combat:impact', (e) =>
      log.impact.push({ p: [e.point.x, e.point.y, e.point.z], n: [e.normal.x, e.normal.y, e.normal.z] }),
    );
    ctx.events.on('weapon:fired', () => log.fired++);
    ctx.events.on('weapon:dryFire', () => log.dry++);
    ctx.events.on('weapon:reloadStarted', () => log.reloadStart.push(ctx.clock.simTime));
    ctx.events.on('weapon:reloadFinished', () => log.reloadEnd.push(ctx.clock.simTime));
    ctx.events.on('weapon:ammoChanged', (e) => log.ammo.push({ mag: e.mag, reserve: e.reserve }));
  });

  const aim = (x, z, targetY, yaw = 0) =>
    page.evaluate(
      ([px, pz, ty, yw]) => {
        const p = window.__NH__.game.ctx.player;
        p.position.set(px, 0, pz);
        p.velocity.set(0, 0, 0);
        p.teleportPending = true;
        p.yaw = yw;
        const eyeY = p.eyeHeight;
        p.pitch = Math.atan2(ty - eyeY, 8);
      },
      [x, z, targetY, yaw],
    );
  // headless software GL runs the simulation slower than wall time: wait in simulated seconds
  const simWait = (seconds) =>
    page.evaluate(
      (sec) =>
        new Promise((resolve) => {
          const c = window.__NH__.game.ctx;
          const target = c.clock.fixedTick + Math.ceil(sec * 60);
          const id = setInterval(() => {
            if (c.clock.fixedTick >= target) {
              clearInterval(id);
              resolve();
            }
          }, 10);
        }),
      seconds,
    );
  const waitFor = (fn, timeoutMs = 15000) => page.waitForFunction(fn, null, { timeout: timeoutMs });
  const hooks = () => page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.getAmmo());
  const fireOnce = () => page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.fireOnce());
  const log = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__log)));

  // initial ammo
  assert.deepEqual(await hooks(), { mag: 30, reserve: 180 }, 'starts with 30 + 180');

  // AC3: body = 25, head (critical box) = 50
  await aim(-6, 0, 0.9);
  assert.ok(await fireOnce(), 'fireOnce shoots');
  await simWait(0.3);
  await aim(-6, 0, 2.05);
  assert.ok(await fireOnce(), 'second fireOnce shoots');
  await simWait(0.1);
  const l1 = await log();
  assert.equal(l1.hit.length, 2, `two combat:hit events (got ${JSON.stringify(l1.hit)})`);
  assert.deepEqual([l1.hit[0].zone, l1.hit[0].dealt], ['body', 25], 'body hit deals 25');
  assert.deepEqual([l1.hit[1].zone, l1.hit[1].dealt], ['critical', 50], 'critical hit deals 50');

  // AC4: impact on the pillar (z = -14, half width 1.5 -> face at z = -12.5)
  await simWait(0.3);
  await aim(0, 0, 1.7);
  await page.evaluate(() => {
    const p = window.__NH__.game.ctx.player;
    p.pitch = 0;
  });
  assert.ok(await fireOnce(), 'impact shot fired');
  await simWait(0.1);
  const l2 = await log();
  assert.equal(l2.impact.length, 1, 'one combat:impact');
  const imp = l2.impact[0];
  assert.ok(Math.abs(imp.p[2] + 12.5) < 0.2, `impact point on pillar face (z=${imp.p[2]})`);
  assert.ok(imp.n[2] > 0.9, `impact normal faces player (${imp.n})`);

  // AC5: grant ammo
  const before = await hooks();
  await page.evaluate(() => window.__NH__.game.ctx.events.emit('weapon:grantAmmo', { amount: 30 }));
  const after = await hooks();
  assert.equal(after.reserve, before.reserve + 30, 'grantAmmo adds 30 to the reserve');
  assert.equal((await log()).ammo.at(-1).reserve, after.reserve, 'ammoChanged emitted');

  // AC2: reload with R takes ~1.8 s and moves the right number of rounds
  await simWait(0.2);
  const pre = await hooks();
  await setKey(page, 'KeyR', true);
  await waitFor(() => window.__NH__.game.ctx.testHooks.weapon.isReloading());
  await setKey(page, 'KeyR', false);
  // firing during the reload must not interrupt it or consume rounds
  await setKey(page, 'Mouse0', true);
  await simWait(0.5);
  await setKey(page, 'Mouse0', false);
  assert.ok(await page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.isReloading()), 'still reloading after firing');
  await waitFor(() => !window.__NH__.game.ctx.testHooks.weapon.isReloading());
  const post = await hooks();
  assert.deepEqual(post, { mag: 30, reserve: pre.reserve - (30 - pre.mag) }, 'reload moved the missing rounds');
  const l3 = await log();
  const dur = l3.reloadEnd[0] - l3.reloadStart[0];
  assert.ok(Math.abs(dur - 1.8) < 0.1, `reload lasts ~1.8 s (sim ${dur.toFixed(3)})`);

  // AC1: hold fire for 1 s => 8 +- 1 shots (aim at dummy, recoil is allowed to drift)
  await aim(-6, 0, 0.9);
  const firedBefore = (await log()).fired;
  const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.fixedTick);
  await setKey(page, 'Mouse0', true);
  await simWait(1);
  await setKey(page, 'Mouse0', false);
  const t1 = await page.evaluate(() => window.__NH__.game.ctx.clock.fixedTick);
  const shots = (await log()).fired - firedBefore;
  const expected = (8 * (t1 - t0)) / 60;
  assert.ok(Math.abs(shots - expected) <= 1.5, `~8 shots per sim second (got ${shots}, expected ${expected.toFixed(1)})`);

  // AC6: effects exist and are bounded
  const fx = await page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.getEffects());
  assert.ok(fx.tracers <= 24 && fx.casings <= 32, `pools bounded ${JSON.stringify(fx)}`);

  // AC8: no firing when dead
  await page.evaluate(() => {
    window.__NH__.game.ctx.player.hp = 0;
  });
  await simWait(0.2);
  assert.equal(await fireOnce(), false, 'no fireOnce while dead');
  const firedDead = (await log()).fired;
  await setKey(page, 'Mouse0', true);
  await simWait(0.5);
  await setKey(page, 'Mouse0', false);
  assert.equal((await log()).fired, firedDead, 'holding fire while dead shoots nothing');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
