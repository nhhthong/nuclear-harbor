/** T-15 e2e: TITAN-04 spawn, absorb rules, weak points, core, attacks and defeat in the sandbox. */
const RECORD = `
  window.__rec = {};
  const ev = window.__NH__.game.ctx.events;
  for (const n of ['boss:spawned','boss:phaseChanged','boss:weakPointDamaged','boss:weakPointDestroyed',
    'boss:coreExposed','boss:coreDamaged','boss:attackTelegraph','boss:attack','boss:defeated','game:checkpoint','vfx:spawn']) {
    window.__rec[n] = [];
    ev.on(n, (p) => window.__rec[n].push({ t: window.__NH__.game.ctx.clock.simTime, p: JSON.parse(JSON.stringify(p)) }));
  }
`;

export default async function ({ openGame, assert }) {
  // software GL can run slower than real time: wait in simulated seconds
  const wait = async (page, seconds) => {
    const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
    await page.waitForFunction(([a, d]) => window.__NH__.game.ctx.clock.simTime >= a + d, [t0, seconds], {
      timeout: 120_000,
      polling: 50,
    });
  };
  const hook = (page, expr) => page.evaluate(`(() => { const b = window.__NH__.game.ctx.testHooks.boss; return ${expr}; })()`);
  const count = (page, name) => page.evaluate((n) => window.__rec[n].length, name);

  // run 1: ?boss spawns by itself, at sandbox scale and position
  {
    const { page, failures } = await openGame('?sandbox&autostart&boss');
    await wait(page, 1);
    const st = await hook(page, 'b.getState()');
    assert.equal(st.spawned, true, 'boss spawned via ?boss');
    assert.equal(st.scale, 0.4);
    assert.ok(['awakening', 'weakpoint-hunt'].includes(st.phase));
    assert.deepEqual(st.weakPoints, [500, 500, 500, 500]);
    assert.equal(st.coreHp, 4000);
    assert.ok(st.meshCount <= 25, `boss body draw calls ${st.meshCount} <= 25`);
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }

  // run 2: full fight through the hooks
  {
    const { page, failures } = await openGame('?sandbox&autostart');
    await page.evaluate(RECORD);
    assert.equal((await hook(page, 'b.getState()')).spawned, false, 'no boss before the event');
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('objectives:allActivated', { timeRemaining: 100 }));
    await wait(page, 0.3);
    assert.equal(await count(page, 'boss:spawned'), 1, 'boss:spawned once');
    const rec0 = await page.evaluate(() => window.__rec);
    assert.equal(rec0['boss:spawned'][0].p.weakPoints, 4);
    assert.equal(rec0['boss:spawned'][0].p.coreHp, 4000);
    assert.equal(rec0['game:checkpoint'].at(-1).p.id, 'boss-start');
    assert.equal(rec0['boss:phaseChanged'][0].p.phase, 'awakening');

    // invulnerable while awakening
    const early = await hook(page, 'b.damageWeakPoint(0, 100)');
    assert.equal(early.absorbed, true, 'absorbed while awakening');

    await wait(page, 4.3);
    assert.equal((await hook(page, 'b.getState()')).phase, 'weakpoint-hunt');

    // core absorbs everything before the weak points are gone
    const core = await hook(page, 'b.damageCore(4000)');
    assert.equal(core.absorbed, true);
    assert.equal(core.dealt, 0);
    assert.equal((await hook(page, 'b.getState()')).coreHp, 4000, 'core hp unchanged');

    const wp = await hook(page, 'b.damageWeakPoint(0, 100)');
    assert.equal(wp.dealt, 100);
    assert.equal(await count(page, 'boss:weakPointDamaged'), 1);

    // ground slam: telegraph, then damage to a nearby player on the ground
    await page.evaluate(() => {
      const p = window.__NH__.game.ctx.player;
      p.hp = p.maxHp;
      p.teleport({ x: -20, y: 0, z: 28.5 });
    });
    await wait(page, 0.2);
    const hp0 = await page.evaluate(() => window.__NH__.game.ctx.player.hp);
    assert.equal(await hook(page, "b.forceAttack('ground-slam')"), true);
    await wait(page, 0.6);
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.hp), hp0, 'no damage during telegraph');
    await wait(page, 1.6);
    const rec1 = await page.evaluate(() => window.__rec);
    const tele = rec1['boss:attackTelegraph'].find((e) => e.p.attack === 'ground-slam');
    const hit = rec1['boss:attack'].find((e) => e.p.attack === 'ground-slam');
    assert.ok(tele && hit, 'telegraph then attack events');
    assert.ok(hit.t - tele.t >= 1.5 - 0.05, `telegraph lasted ${hit.t - tele.t}s`);
    assert.ok(tele.p.duration === 1.5);
    const hp1 = await page.evaluate(() => window.__NH__.game.ctx.player.hp);
    assert.equal(hp1, hp0 - 35, 'slam damaged the nearby grounded player');

    // destroy the remaining weak points
    await hook(page, 'b.damageWeakPoint(0, 500)');
    for (const i of [1, 2, 3]) await hook(page, `b.damageWeakPoint(${i}, 500)`);
    assert.equal(await count(page, 'boss:weakPointDestroyed'), 4);
    assert.equal(await count(page, 'boss:coreExposed'), 1);
    const phases = await page.evaluate(() => window.__rec['boss:phaseChanged'].map((e) => e.p.phase));
    assert.deepEqual(phases, ['awakening', 'weakpoint-hunt', 'core-exposed']);
    const dealt = await hook(page, 'b.damageCore(100)');
    assert.equal(dealt.dealt, 100);
    assert.equal(await count(page, 'boss:coreDamaged'), 1);

    // kill the core: collapse, then exactly one defeat
    await hook(page, 'b.damageCore(4000)');
    assert.equal((await hook(page, 'b.getState()')).phase, 'destroyed');
    await wait(page, 3.6);
    assert.equal(await count(page, 'boss:defeated'), 1, 'defeated once');
    assert.ok((await page.evaluate(() => window.__rec['vfx:spawn'].some((e) => e.p.kind === 'big-explosion'))), 'big explosion requested');
    await hook(page, 'b.damageCore(4000)');
    await wait(page, 0.5);
    assert.equal(await count(page, 'boss:defeated'), 1, 'still once');
    const st = await hook(page, 'b.getState()');
    assert.equal(st.liveShots + st.liveMissiles, 0, 'projectiles released');
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }

  // run 3: heavy cannon hits a standing player and can be avoided; missile barrage lands in its area
  {
    const { page, failures } = await openGame('?sandbox&autostart');
    await page.evaluate(RECORD);
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('objectives:allActivated', { timeRemaining: 100 }));
    await wait(page, 4.4);
    const place = (x, z) =>
      page.evaluate(([px, pz]) => {
        const p = window.__NH__.game.ctx.player;
        p.hp = p.maxHp;
        p.teleport({ x: px, y: 0, z: pz });
      }, [x, z]);
    await place(-20, 12);
    await wait(page, 0.3);
    assert.equal(await hook(page, "b.forceAttack('heavy-cannon')"), true);
    await wait(page, 3);
    let hp = await page.evaluate(() => window.__NH__.game.ctx.player.hp);
    assert.equal(hp, 70, 'cannon splash hit the player standing on the marker');
    const tele = await page.evaluate(() => window.__rec['boss:attackTelegraph'].find((e) => e.p.attack === 'heavy-cannon'));
    assert.ok(tele && tele.p.duration === 1.2 && tele.p.radius === 4);

    // avoid: step away once the marker is down
    await place(-20, 12);
    await wait(page, 0.2);
    await hook(page, "b.forceAttack('heavy-cannon')");
    await wait(page, 0.4);
    await place(-34, 12);
    await wait(page, 3);
    hp = await page.evaluate(() => window.__NH__.game.ctx.player.hp);
    assert.equal(hp, 100, 'cannon avoided by leaving the marked area');

    // missile barrage: telegraph then attack, projectiles stay within the pool cap
    await place(-20, 6);
    assert.equal(await hook(page, "b.forceAttack('missile-barrage')"), true);
    await wait(page, 2.6);
    const st = await hook(page, 'b.getState()');
    assert.ok(st.liveMissiles > 0 || (await count(page, 'boss:attack')) >= 3, 'missiles launched');
    assert.equal(st.droppedShots, 0);
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }
}
