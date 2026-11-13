/**
 * T-21: dinosaur semi-boss.
 *  1. Harbor: `?seed=` picks the same 2 distinct towers every time; only they spawn a dinosaur, once,
 *     when the player first comes within 35 m (roar + shake); the 30-robot population is unchanged.
 *  2. Sandbox (`?sandbox&autostart&dino`): head crit x2, the three skills (telegraph >= 0.8 s, damage,
 *     radius, falloff, stuns), draw calls, drops + collection.
 */
export default async function ({ openGame, assert }) {
  const hook = (page, expr) => page.evaluate(`(() => { const h = window.__NH__.game.ctx.testHooks.dinosaur; return ${expr}; })()`);
  const simWait = async (page, seconds) => {
    const t0 = await page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
    await page.waitForFunction(([a, d]) => window.__NH__.game.ctx.clock.simTime >= a + d, [t0, seconds], { timeout: 60_000, polling: 30 });
  };
  const record = (page) =>
    page.evaluate(() => {
      const ctx = window.__NH__.game.ctx;
      const log = (window.__t21 = []);
      for (const n of ['dino:spawned', 'dino:roar', 'dino:telegraph', 'dino:attack', 'dino:hitPlayer', 'dino:stunned', 'dino:defeated', 'pickup:collected', 'weapon:grantAmmo']) {
        ctx.events.on(n, (e) => log.push({ n, t: ctx.clock.simTime, skill: e.skill, damage: e.damage, duration: e.duration, radius: e.radius, shake: e.shake, kind: e.kind, amount: e.amount }));
      }
    });
  const log = (page) => page.evaluate(() => window.__t21);
  const resetHp = (page) => page.evaluate(() => { const p = window.__NH__.game.ctx.player; p.hp = p.maxHp; p.invulnerableFor = 0; p.pendingImpulse.set(0, 0, 0); });

  // ---- 1. harbor: seeded guards ----------------------------------------------------------------
  let guardsSeed3;
  {
    const { page, failures, booted } = await openGame('?autostart&seed=3');
    assert.ok(booted, 'harbor boots');
    await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length >= 30 && window.__NH__.game.ctx.testHooks.dinosaur?.towers().length === 4, null, { timeout: 30_000 });
    await record(page);
    guardsSeed3 = await hook(page, 'h.guards()');
    assert.equal(guardsSeed3.length, 2, 'two guarded towers');
    assert.equal(new Set(guardsSeed3).size, 2, 'distinct towers');
    assert.ok(guardsSeed3.every((i) => i >= 1 && i <= 4));
    assert.equal(await hook(page, 'h.spawnCount()'), 0, 'nothing spawned at boot');

    const towers = await hook(page, 'h.towers()');
    const free = towers.find((t) => !guardsSeed3.includes(t.id));
    await page.evaluate(() => { window.__NH__.game.ctx.player.invulnerableFor = 1e9; });
    // an unguarded tower never spawns
    await page.evaluate((t) => window.__NH__.game.ctx.player.teleport({ x: t.x + 4, y: t.y, z: t.z + 4 }), free);
    await simWait(page, 1.2);
    assert.equal(await hook(page, 'h.spawnCount()'), 0, `no dinosaur at unguarded tower ${free.id}`);

    // a guarded tower: just outside the radius, then inside
    const first = towers.find((t) => t.id === guardsSeed3[0]);
    await page.evaluate((t) => window.__NH__.game.ctx.player.teleport({ x: t.x + 45, y: 0, z: t.z + 0.5 }), first);
    await simWait(page, 1);
    assert.equal(await hook(page, 'h.spawnCount()'), 0, 'no spawn at 45 m');
    await page.evaluate((t) => window.__NH__.game.ctx.player.teleport({ x: t.x + 30, y: 0, z: t.z + 0.5 }), first);
    await simWait(page, 0.6);
    assert.equal(await hook(page, 'h.spawnCount()'), 1, 'spawn within 35 m');
    const ev = await log(page);
    const roar = ev.find((e) => e.n === 'dino:roar');
    assert.ok(roar && roar.shake > 0, 'roar with camera shake');
    assert.ok(roar.duration > 0, 'roar carries a shake duration');
    const d1 = (await hook(page, 'h.list()'))[0];
    assert.equal(d1.maxHp, 1500);
    assert.ok(Math.hypot(d1.position.x - first.x, d1.position.z - first.z) < 16, 'spawns beside its tower');
    // leaving and returning does not spawn another one
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 0, y: 0, z: 96 }));
    await simWait(page, 0.5);
    await page.evaluate((t) => window.__NH__.game.ctx.player.teleport({ x: t.x + 25, y: 0, z: t.z }), first);
    await simWait(page, 0.5);
    assert.equal(await hook(page, 'h.spawnCount()'), 1, 'only one dinosaur per tower');
    // the second guarded tower
    const second = towers.find((t) => t.id === guardsSeed3[1]);
    await page.evaluate((t) => window.__NH__.game.ctx.player.teleport({ x: t.x + 4, y: t.y, z: t.z + 3 }), second);
    await simWait(page, 0.8);
    assert.equal(await hook(page, 'h.spawnCount()'), 2, 'second guard spawns');
    assert.deepEqual((await hook(page, 'h.spawnedTowers()')).sort(), [...guardsSeed3].sort());
    const all = await hook(page, 'h.list()');
    const d2 = all.find((d) => d.towerId === second.id);
    assert.ok(Math.hypot(d2.position.x - second.x, d2.position.z - second.z) < 16, 'second dinosaur beside its tower');
    // not part of the robot population
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount()), 30, '30 robots, dinosaurs not counted');
    assert.deepEqual(failures, [], 'no console errors (harbor)');
    await page.close();
  }
  {
    // same seed -> same guards; another seed -> a valid (possibly different) pair
    const { page } = await openGame('?autostart&seed=3');
    await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.dinosaur?.towers().length === 4, null, { timeout: 30_000 });
    assert.deepEqual(await hook(page, 'h.guards()'), guardsSeed3, 'same seed, same towers');
    await page.close();
    const pairs = new Set([guardsSeed3.join(',')]);
    for (const seed of [1, 2, 5, 8]) {
      const { page: p2 } = await openGame(`?autostart&seed=${seed}`);
      await p2.waitForFunction(() => window.__NH__.game.ctx.testHooks.dinosaur?.towers().length === 4, null, { timeout: 30_000 });
      pairs.add((await hook(p2, 'h.guards()')).join(','));
      await p2.close();
    }
    assert.ok(pairs.size >= 2, `different seeds give different pairs (${[...pairs].join(' | ')})`);
  }

  // ---- 2. sandbox fight ---------------------------------------------------------------------------
  const { page, failures, booted } = await openGame('?sandbox&autostart&dino');
  assert.ok(booted, 'sandbox boots');
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.dinosaur, null, { timeout: 10_000 });
  await record(page);
  await page.evaluate(() => {
    const c = window.__NH__.game.ctx;
    c.player.invulnerableFor = 1e9;
    c.player.teleport({ x: 0, y: 0, z: 20 }, 0);
  });
  await simWait(page, 0.3);

  // draw calls: with and without a visible dinosaur
  const callsOf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__NH__.game.ctx.renderer.webgl.info.render.calls)))));
  const base = await callsOf();
  const robotsBefore = await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount());
  await hook(page, 'h.passive(true)');
  await hook(page, 'h.spawnAt(0, -8, 0)');
  await simWait(page, 8); // the spawn dust effect has faded: steady-state cost
  const withDino = await callsOf();
  const dinoInfo = (await hook(page, 'h.list()'))[0];
  assert.ok(withDino - base <= 25, `dinosaur adds <= 25 draw calls (${withDino - base}, model ${dinoInfo.drawCalls})`);
  assert.ok(dinoInfo.drawCalls <= 25);
  assert.equal(dinoInfo.state, 'guard', 'rose and guards (passive)');
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.enemies.aliveCount()), robotsBefore, 'dinosaur is not a registered robot');
  await page.evaluate(() => window.__NH__.game.ctx.events.emit('vfx:spawn', { kind: 'spark', position: { x: 0, y: 1, z: 0 } }));

  // head crit x2: real physics rays against the hit volumes
  const hit = await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const d = ctx.testHooks.dinosaur.list()[0];
    const fx = -Math.sin(d.yaw);
    const fz = -Math.cos(d.yaw);
    const shot = (h) => {
      const origin = { x: d.position.x + fx * 25, y: h, z: d.position.z + fz * 25 };
      const r = ctx.physics.raycast(origin, { x: -fx, y: 0, z: -fz }, 60, { groups: 0xffff0025 });
      return r ? { zone: r.meta.hitZone, kind: r.meta.kind, hasTarget: !!r.meta.damageable } : null;
    };
    return { head: shot(8.2), body: shot(4.4), tail: { x: d.position.x - fx * 5, z: d.position.z - fz * 5 } };
  });
  assert.equal(hit.head?.zone, 'critical', 'head ray hits the critical volume');
  assert.equal(hit.body?.zone, 'body', 'body ray hits a body volume');
  assert.ok(hit.head.hasTarget && hit.body.hasTarget, 'volumes carry the damageable');
  const dmg = await page.evaluate(() => {
    const h = window.__NH__.game.ctx.testHooks.dinosaur;
    return { body: h.damage(25, 'body'), head: h.damage(25, 'critical'), hp: h.list()[0].hp };
  });
  assert.equal(dmg.body.dealt, 25);
  assert.equal(dmg.head.dealt, 50, 'head = 2x');
  assert.equal(dmg.hp, 1500 - 75);
  await page.evaluate(() => { window.__NH__.game.ctx.testHooks.dinosaur.damage(75, 'body'); });
  await hook(page, 'h.passive(false)');

  // helper for a skill run
  const runSkill = async (skill, { playerAt, afterLock }) => {
    await page.evaluate(() => { window.__t21.length = 0; });
    await resetHp(page);
    await page.evaluate(([p]) => window.__NH__.game.ctx.player.teleport({ x: p.x, y: 0, z: p.z }, 0), [playerAt]);
    await simWait(page, 0.2);
    const ok = await hook(page, `h.force('${skill}')`);
    assert.ok(ok, `${skill} started`);
    if (afterLock) {
      await simWait(page, 0.7);
      await page.evaluate(([p]) => window.__NH__.game.ctx.player.teleport({ x: p.x, y: 0, z: p.z }, 0), [afterLock]);
    }
    await page.waitForFunction(() => window.__t21.some((e) => e.n === 'dino:attack') , null, { timeout: 15_000 });
    await simWait(page, 3.2);
    return { events: await log(page), hp: await page.evaluate(() => window.__NH__.game.ctx.player.hp) };
  };
  const dinoPos = async () => (await hook(page, 'h.list()'))[0].position;
  const stand = async () => {
    await page.evaluate(() => { const c = window.__NH__.game.ctx.testHooks.dinosaur; c.passive(true); });
    await simWait(page, 0.2);
  };
  const waitIdle = async () => {
    await page.waitForFunction(() => { const s = window.__NH__.game.ctx.testHooks.dinosaur.list()[0].state; return s === 'chase' || s === 'guard'; }, null, { timeout: 15_000 });
    await hook(page, 'h.passive(true)');
    await simWait(page, 0.3);
  };
  await waitIdle();

  // tail spin: inside 9 m = 20 damage, outside = harmless. Fresh dinosaur position each time.
  await hook(page, 'h.passive(false)');
  const p0 = await dinoPos();
  let r = await runSkill('tailSpin', { playerAt: { x: p0.x, z: p0.z + 6 } });
  let tel = r.events.find((e) => e.n === 'dino:telegraph');
  let att = r.events.find((e) => e.n === 'dino:attack');
  assert.ok(att.t - tel.t >= 0.8, `tail spin telegraph >= 0.8 s (${(att.t - tel.t).toFixed(2)})`);
  assert.equal(tel.radius, 9, 'tail ring radius 9 m');
  assert.equal(100 - r.hp, 20, `tail spin deals 20 (hp ${r.hp})`);
  const tailHit = r.events.find((e) => e.n === 'dino:hitPlayer');
  assert.ok(tailHit.t - att.t < 1.0, `damage lands within the 0.8 s spin (${(tailHit.t - att.t).toFixed(2)})`);
  await waitIdle();
  await hook(page, 'h.passive(false)');
  const p1 = await dinoPos();
  r = await runSkill('tailSpin', { playerAt: { x: p1.x, z: p1.z + 11 } });
  assert.equal(100 - r.hp, 0, 'player outside 9 m is unharmed by the tail spin');
  await waitIdle();

  // leap + stomp: centre = 30, falloff at 6 m, nothing beyond 8 m, dinosaur stunned afterwards
  await hook(page, 'h.passive(false)');
  const p2 = await dinoPos();
  const leapCentre = { x: p2.x, z: p2.z + 14 };
  r = await runSkill('leapStomp', { playerAt: leapCentre });
  tel = r.events.find((e) => e.n === 'dino:telegraph');
  const att2 = r.events.filter((e) => e.n === 'dino:attack');
  assert.ok(att2[0].t - tel.t >= 0.8, `leap telegraph >= 0.8 s (${(att2[0].t - tel.t).toFixed(2)})`);
  assert.equal(tel.radius, 8, 'stomp radius 8 m');
  assert.equal(100 - r.hp, 30, `stomp centre hit deals 30 (hp ${r.hp})`);
  const stun = r.events.find((e) => e.n === 'dino:stunned');
  assert.ok(stun && Math.abs(stun.duration - 1.4) < 0.01, 'dinosaur stunned after landing');
  const landing = att2.find((e) => e.t > att2[0].t) ?? att2[att2.length - 1];
  assert.ok(landing.t - att2[0].t > 0.8 && landing.t - att2[0].t < 1.0, `air time ~0.9 s (${(landing.t - att2[0].t).toFixed(2)})`);
  await waitIdle();
  await hook(page, 'h.passive(false)');
  const p3 = await dinoPos();
  r = await runSkill('leapStomp', { playerAt: { x: p3.x, z: p3.z + 14 }, afterLock: { x: p3.x + 6, z: p3.z + 14 } });
  const expected = 30 * (1 - 0.7 * (6 / 8));
  assert.ok(Math.abs(100 - r.hp - expected) < 0.6, `falloff at 6 m: ${(100 - r.hp).toFixed(2)} vs ${expected.toFixed(2)}`);
  await waitIdle();
  await hook(page, 'h.passive(false)');
  const p4 = await dinoPos();
  r = await runSkill('leapStomp', { playerAt: { x: p4.x, z: p4.z + 14 }, afterLock: { x: p4.x + 11, z: p4.z + 14 } });
  assert.equal(100 - r.hp, 0, 'no stomp damage beyond 8 m');
  await waitIdle();

  // ram: telegraph, locked direction, 25 damage; dodging into a wall stuns the dinosaur
  await hook(page, 'h.passive(false)');
  const p5 = await dinoPos();
  r = await runSkill('ram', { playerAt: { x: p5.x, z: p5.z + 12 } });
  tel = r.events.find((e) => e.n === 'dino:telegraph');
  att = r.events.find((e) => e.n === 'dino:attack');
  assert.ok(att.t - tel.t >= 0.8, `ram telegraph >= 0.8 s (${(att.t - tel.t).toFixed(2)})`);
  assert.equal(100 - r.hp, 25, `ram deals 25 (hp ${r.hp})`);
  await stand();
  await waitIdle();
  // wall at z = -34 (x +-20): the dinosaur is moved next to it, the player steps aside after the lock
  await page.evaluate(() => { window.__NH__.game.ctx.player.teleport({ x: 60, y: 0, z: 20 }); });
  await page.evaluate(() => { window.__NH__.game.ctx.testHooks.dinosaur.passive(true); });
  await hook(page, 'h.damage(100000)');
  await simWait(page, 0.2);
  assert.equal((await hook(page, 'h.list()'))[0]?.alive ?? false, false, 'dead after lethal damage');

  // drops
  const drops = await hook(page, 'h.drops()');
  assert.equal(drops.filter((d) => d.kind === 'ammo').length, 4, 'four ammo crates');
  assert.equal(drops.filter((d) => d.kind === 'medkit').length, 1, 'one medkit');
  const ev3 = await log(page);
  assert.ok(ev3.some((e) => e.n === 'dino:defeated'), 'defeated event');
  await page.evaluate(() => { window.__t21.length = 0; const p = window.__NH__.game.ctx.player; p.hp = 40; });
  for (const d of drops) {
    await page.evaluate((x) => window.__NH__.game.ctx.player.teleport({ x: x.x, y: x.y, z: x.z }), d);
    await simWait(page, 0.25);
  }
  const ev4 = await log(page);
  assert.equal(ev4.filter((e) => e.n === 'pickup:collected' && e.kind === 'ammo').length, 4, 'ammo collected');
  assert.equal(ev4.filter((e) => e.n === 'weapon:grantAmmo').length, 4, 'ammo granted to the weapon');
  assert.equal(ev4.filter((e) => e.n === 'pickup:collected' && e.kind === 'medkit').length, 1, 'medkit collected');
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.hp), 80, 'medkit healed 40');
  assert.equal((await hook(page, 'h.drops()')).length, 0, 'all loot taken');

  assert.deepEqual(failures, [], 'no console errors (sandbox)');
  await page.close();

  // ---- 3. ram into the wall (own page: clean state) -----------------------------------------------
  {
    const { page: pg, failures: f2 } = await openGame('?sandbox&autostart&dino');
    await pg.waitForFunction(() => window.__NH__.game.ctx.testHooks.dinosaur, null, { timeout: 10_000 });
    await record(pg);
    await pg.evaluate(() => {
      const c = window.__NH__.game.ctx;
      c.player.invulnerableFor = 1e9;
      c.testHooks.dinosaur.passive(true);
      c.testHooks.dinosaur.spawnAt(0, -4, 0);
      c.player.teleport({ x: 0, y: 0, z: 30 }, 0);
    });
    await simWait(pg, 3);
    await pg.evaluate(() => {
      const c = window.__NH__.game.ctx;
      c.player.teleport({ x: 0, y: 0, z: -29 }, 0);
      c.testHooks.dinosaur.passive(false);
    });
    await simWait(pg, 0.2);
    assert.ok(await hook(pg, "h.force('ram')"), 'ram forced towards the wall');
    await simWait(pg, 0.7);
    await pg.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 40, y: 0, z: 10 }, 0));
    await pg.waitForFunction(() => window.__t21.some((e) => e.n === 'dino:stunned'), null, { timeout: 15_000 });
    const evs = await log(pg);
    const stunned = evs.find((e) => e.n === 'dino:stunned');
    assert.ok(Math.abs(stunned.duration - 2.5) < 0.01, 'wall hit stuns for 2.5 s');
    assert.ok(!evs.some((e) => e.n === 'dino:hitPlayer'), 'dodged: no damage');
    const dd = (await hook(pg, 'h.list()'))[0];
    assert.equal(dd.state, 'stunned');
    assert.ok(dd.position.z < -26 && dd.position.z > -34, `stopped at the wall (z ${dd.position.z.toFixed(1)})`);
    assert.deepEqual(f2, [], 'no console errors (wall ram)');
    await pg.close();
  }
}
