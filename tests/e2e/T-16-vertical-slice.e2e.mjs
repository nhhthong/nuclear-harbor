/**
 * T-16 vertical slice (GDD 15.1) in the sandbox: walk, shoot, grapple, kill the army mech, survive the
 * Bomber Duck countdown, collect the crate, activate the tower, boss spawns, weak points and core
 * die, victory is reached and stored. Zero console errors.
 */
export default async function ({ openGame, setKey, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=army,duck&countdown=600');
  assert.ok(booted, 'game boots');

  // software GL can run slower than real time: wait in simulated seconds
  const wait = async (seconds) => {
    const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
    await page.waitForFunction(([a, d]) => window.__NH__.game.ctx.clock.simTime >= a + d, [t0, seconds], { timeout: 120_000, polling: 50 });
  };
  const ev = () => page.evaluate(() => window.__ev);
  const place = (x, y, z, yaw = 0) => page.evaluate(([a, b, c, w]) => window.__NH__.game.ctx.player.teleport({ x: a, y: b, z: c }, w), [x, y, z, yaw]);
  const aimAt = (x, y, z) =>
    page.evaluate(([tx, ty, tz]) => {
      const { player } = window.__NH__.game.ctx;
      const dx = tx - player.position.x;
      const dy = ty - (player.position.y + player.eyeHeight);
      const dz = tz - player.position.z;
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    }, [x, y, z]);
  const press = async (code) => {
    await setKey(page, code, true);
    await wait(0.06);
    await setKey(page, code, false);
  };
  const hook = (name, expr) => page.evaluate(`(() => { const h = window.__NH__.game.ctx.testHooks.${name}; return ${expr}; })()`);

  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 2, null, { timeout: 10_000 });
  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    ctx.player.invulnerableFor = 1e9; // the slice checks the loop, not survival (death flow is in the full-run test)
    window.__ev = [];
    for (const n of [
      'combat:hit', 'grapple:attached', 'grapple:released', 'enemy:destroyed', 'duck:windup', 'duck:beep',
      'duck:explode', 'pickup:collected', 'tower:activated', 'objectives:allActivated', 'boss:spawned',
      'boss:weakPointDestroyed', 'boss:coreExposed', 'boss:defeated', 'game:checkpoint', 'game:victory', 'game:over',
    ]) {
      ctx.events.on(n, (p) => window.__ev.push({ n, targetKind: p.targetKind, killed: p.killed, anchorId: p.anchorId, reason: p.reason, type: p.type, id: p.id, kind: p.kind }));
    }
    window.__maxEyeY = 0;
    setInterval(() => {
      window.__maxEyeY = Math.max(window.__maxEyeY, ctx.player.position.y + ctx.player.eyeHeight);
    }, 16);
  });
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.state.current), 'playing');

  // 1. move: hold W for a second
  await wait(0.4);
  const z0 = await page.evaluate(() => window.__NH__.game.ctx.player.position.z);
  await setKey(page, 'KeyW', true);
  await wait(1);
  await setKey(page, 'KeyW', false);
  const z1 = await page.evaluate(() => window.__NH__.game.ctx.player.position.z);
  assert.ok(z0 - z1 > 2, `walked north (${z0.toFixed(1)} -> ${z1.toFixed(1)})`);

  // 2. shoot a dummy
  await place(-6, 0, 2);
  await wait(0.3);
  await aimAt(-6, 1, -8);
  for (let i = 0; i < 6 && !(await ev()).some((e) => e.n === 'combat:hit' && e.targetKind === 'prop'); i++) {
    assert.equal(await hook('weapon', 'h.fireOnce()'), true, 'weapon fires');
    await wait(0.15);
  }
  assert.ok((await ev()).some((e) => e.n === 'combat:hit' && e.targetKind === 'prop'), 'hit a dummy');

  // 3. grapple the pillar
  await place(0, 0, 6);
  await wait(0.3);
  await aimAt(0, 11.5, -12.5);
  await press('Space');
  await page.waitForFunction(() => window.__ev.some((e) => e.n === 'grapple:released'), null, { timeout: 30_000 });
  const gr = await ev();
  assert.ok(gr.some((e) => e.n === 'grapple:attached' && e.anchorId === 'sandbox-pillar'), 'attached to the pillar');
  assert.equal(gr.find((e) => e.n === 'grapple:released').reason, 'arrived');
  assert.ok((await page.evaluate(() => window.__maxEyeY)) > 8, 'rose above 8 m');
  await wait(1.5);

  // 4. kill the army mech with real shots (re-aimed each time); finish through the damage path if shots miss
  await place(8, 0, -8);
  const sphereId = await page.evaluate(() => window.__NH__.game.ctx.enemies.all().find((e) => e.type === 'army').id);
  let shots = 0;
  for (; shots < 50; shots++) {
    const alive = await page.evaluate((id) => window.__NH__.game.ctx.enemies.all().some((e) => e.id === id && e.alive), sphereId);
    if (!alive) break;
    await page.evaluate((id) => {
      const { player, enemies } = window.__NH__.game.ctx;
      const e = enemies.all().find((x) => x.id === id);
      const dx = e.position.x - player.position.x;
      const dy = e.position.y - (player.position.y + player.eyeHeight);
      const dz = e.position.z - player.position.z;
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    }, sphereId);
    await hook('weapon', 'h.fireOnce()');
    await wait(0.12);
  }
  const enemyHits = (await ev()).filter((e) => e.n === 'combat:hit' && e.targetKind === 'enemy').length;
  assert.ok(enemyHits >= 1, `real shots hit a robot (${enemyHits} hits in ${shots} shots)`);
  await page.evaluate((id) => window.__NH__.game.ctx.enemies.all().find((e) => e.id === id)?.applyDamage({ amount: 1000, zone: 'body', source: 'player' }), sphereId);
  assert.ok((await ev()).some((e) => e.n === 'enemy:destroyed' && e.type === 'army'), 'army mech destroyed');

  // 5. Bomber Duck: stand ~10 m away, it hops over, arms, counts 3-2-1 and detonates
  await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const c = ctx.enemies.all().find((e) => e.type === 'duck');
    ctx.player.teleport({ x: c.position.x + 8, y: 0, z: c.position.z - 6 });
  });
  await page.waitForFunction(() => window.__ev.some((e) => e.n === 'duck:explode'), null, { timeout: 60_000 });
  assert.ok((await ev()).some((e) => e.n === 'duck:windup'), 'telegraphed');
  assert.ok((await ev()).filter((e) => e.n === 'duck:beep').length === 3, 'three beeps');

  // 6. ammo crate
  await place(0, 0, 12);
  await wait(0.3);
  const ammo0 = await hook('weapon', 'h.getAmmo()');
  await place(4, 0, 6);
  await page.waitForFunction(() => window.__ev.some((e) => e.n === 'pickup:collected' && e.kind === 'ammo'), null, { timeout: 15_000 });
  const ammo1 = await hook('weapon', 'h.getAmmo()');
  assert.ok(ammo1.reserve > ammo0.reserve, `crate added ammo (${ammo0.reserve} -> ${ammo1.reserve})`);

  // 7. tower: hold E, boss spawns with a boss-start checkpoint
  await place(8, 0, 3.5);
  await wait(0.3);
  await setKey(page, 'KeyE', true);
  await page.waitForFunction(() => window.__ev.some((e) => e.n === 'boss:spawned'), null, { timeout: 60_000 });
  await setKey(page, 'KeyE', false);
  const mid = await ev();
  assert.ok(mid.some((e) => e.n === 'tower:activated'), 'tower activated');
  assert.ok(mid.some((e) => e.n === 'objectives:allActivated'), 'all towers activated');
  assert.ok(mid.some((e) => e.n === 'game:checkpoint' && e.id === 'boss-start'), 'boss-start checkpoint');
  assert.equal(await hook('flow', 'h.getCheckpoint().id'), 'boss-start', 'flow stored the checkpoint');

  // 8. boss: wait for the awakening, destroy weak points, then the core
  await wait(4.5);
  for (const i of [0, 1, 2, 3]) await hook('boss', `h.damageWeakPoint(${i}, 500)`);
  assert.equal((await ev()).filter((e) => e.n === 'boss:weakPointDestroyed').length, 4);
  assert.ok((await ev()).some((e) => e.n === 'boss:coreExposed'), 'core exposed');
  await hook('boss', 'h.damageCore(4000)');

  // 9. victory about 3 s after the defeat (plus the boss collapse), best result stored
  await page.waitForFunction(() => window.__NH__.game.ctx.state.current === 'victory', null, { timeout: 120_000 });
  const fin = await ev();
  assert.equal(fin.filter((e) => e.n === 'boss:defeated').length, 1);
  assert.equal(fin.filter((e) => e.n === 'game:victory').length, 1);
  assert.ok(!fin.some((e) => e.n === 'game:over'), 'no game over');
  assert.equal(await hook('flow', 'h.getStatus()'), 'won');
  const best = await hook('flow', 'h.getBest()');
  assert.equal(best.completed, true);
  assert.ok(best.bestTimeRemaining > 0 && best.bestTimeRemaining <= 600, `best time stored (${best.bestTimeRemaining})`);
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.ui.isVisible('victory')), true, 'victory screen visible');
  const stats = await hook('flow', 'h.stats()');
  assert.ok(stats.shots >= 3 && stats.hits >= 2 && stats.kills >= 1, `stats tracked ${JSON.stringify(stats)}`);

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
