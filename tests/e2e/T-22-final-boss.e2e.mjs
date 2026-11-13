/**
 * T-22 e2e: spherical walker final boss in the harbor. Landing cinematic (locked, invulnerable,
 * ~6 s, skip with E only after 2 s), landing spot clear of the player standing in the arena,
 * height above the warehouse, <= 40 draw calls, damage only through the knee lights.
 */
const RECORD = `
  window.__rec = { events: [] };
  const ev = window.__NH__.game.ctx.events;
  for (const n of ['objectives:allActivated','boss:spawned','boss:phaseChanged','game:checkpoint','vfx:spawn']) {
    ev.on(n, (p) => window.__rec.events.push({ n, t: window.__NH__.game.ctx.clock.simTime, phase: p.phase, kind: p.kind, id: p.id }));
  }
`;

export default async function ({ openGame, setKey, assert }) {
  const sim = (page) => page.evaluate(() => window.__NH__.game.ctx.clock.simTime);
  const until = (page, expr, timeout = 180_000) =>
    page.waitForFunction(`(() => { const b = window.__NH__.game.ctx.testHooks.boss.getState(); return ${expr}; })()`, null, { timeout, polling: 30 });
  const state = (page) => page.evaluate(() => window.__NH__.game.ctx.testHooks.boss.getState());
  const events = (page, n) => page.evaluate((name) => window.__rec.events.filter((e) => e.n === name), n);
  const WAREHOUSE_HEIGHT = 10;

  // ---- run 1: player stands ON the arena centre; skip rules; control and invulnerability -------
  {
    const { page, failures, booted } = await openGame('?autostart');
    assert.ok(booted, 'harbor boots');
    await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.boss, null, { timeout: 30_000 });
    await page.evaluate(RECORD);
    const hp0 = await page.evaluate(() => {
      const p = window.__NH__.game.ctx.player;
      p.teleport({ x: -28, y: 0.1, z: -90 }, 0);
      return p.hp;
    });
    assert.equal((await state(page)).spawned, false, 'no boss before the event');
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('objectives:allActivated', { timeRemaining: 100 }));
    await until(page, 'b.spawned');
    let st = await state(page);
    assert.equal(st.cinematic.active, true, 'cinematic running');
    assert.equal(st.phase, 'awakening');
    assert.ok(st.cinematic.duration >= 5.5 && st.cinematic.duration <= 7, `about 6 s (${st.cinematic.duration})`);
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.controlsLocked), true, 'player locked');
    assert.ok(await page.evaluate(() => window.__NH__.game.ctx.player.invulnerableFor > 0), 'player invulnerable');
    const dmg = await page.evaluate(() => window.__NH__.game.ctx.player.applyDamage({ amount: 50, zone: 'body', source: 'boss' }));
    assert.equal(dmg.dealt, 0, 'no damage during the cinematic');
    assert.equal(await page.evaluate((h) => window.__NH__.game.ctx.player.hp === h, hp0), true);

    // landing: not on the player standing at the arena centre
    const dPlayer = Math.hypot(st.landing.x - -28, st.landing.z - -90);
    assert.equal(st.landing.clear, true, 'a clear landing spot was found');
    assert.ok(dPlayer >= 12 + 8 - 0.01, `landing ${dPlayer.toFixed(1)} m from the player (footprint 12 + clearance 8)`);
    assert.ok(Math.hypot(st.landing.x - -28, st.landing.z - -90) <= 28, 'landing inside the arena');
    assert.ok(st.position.y > 100, `boss starts high in the sky (${st.position.y.toFixed(0)} m)`);
    assert.ok(st.height > WAREHOUSE_HEIGHT * 1.5 && st.height < 20, `boss about 18 m, above the 10 m warehouse (${st.height.toFixed(1)})`);
    assert.ok(st.meshCount <= 40, `boss body draw calls ${st.meshCount} <= 40`);

    // E before 2 s does nothing
    if (st.cinematic.t < 1.6) {
      await setKey(page, 'KeyE', true);
      await setKey(page, 'KeyE', false);
      const t0 = await sim(page);
      await page.waitForFunction((a) => window.__NH__.game.ctx.clock.simTime >= a + 0.25, t0, { timeout: 60_000, polling: 30 });
      st = await state(page);
      if (st.cinematic.t < 2) assert.equal(st.cinematic.active && st.cinematic.t < 5, true, 'E ignored before 2 s');
    }
    await until(page, 'b.cinematic.t >= 2.05');
    await setKey(page, 'KeyE', true);
    await setKey(page, 'KeyE', false);
    await until(page, 'b.cinematic.impacted', 60_000);
    st = await state(page);
    assert.ok(st.cinematic.impacted, 'impact happened during the skip');
    assert.ok(Math.abs(st.position.y) < 1e-6, 'boss landed');
    await until(page, "b.phase === 'weakpoint-hunt'");
    st = await state(page);
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.controlsLocked), false, 'control returned');
    assert.ok(await page.evaluate(() => window.__NH__.game.ctx.player.invulnerableFor > 0), 'short grace period after the cinematic');
    assert.equal((await events(page, 'boss:spawned')).length, 1, 'boss:spawned (roar) once, at the impact');
    const pl = await page.evaluate(() => ({ x: window.__NH__.game.ctx.player.position.x, z: window.__NH__.game.ctx.player.position.z }));
    assert.ok(Math.hypot(st.position.x - pl.x, st.position.z - pl.z) >= 12, 'boss feet ring does not overlap the player');

    // damage only through the knee lights
    await page.evaluate(() => { window.__NH__.game.ctx.player.invulnerableFor = 1e9; });
    const probe = (from, to) =>
      page.evaluate(([f, t]) => {
        const d = { x: t.x - f.x, y: t.y - f.y, z: t.z - f.z };
        const len = Math.hypot(d.x, d.y, d.z);
        const hit = window.__NH__.game.ctx.physics.raycast(f, { x: d.x / len, y: d.y / len, z: d.z / len }, len + 30, { groups: 0xffffffff });
        return hit ? { zone: hit.meta.hitZone ?? null, weakPoint: hit.meta.owner?.weakPoint ?? null } : null;
      }, [from, to]);
    st = await state(page);
    for (let i = 0; i < 4; i++) {
      const k = st.kneeWorld[i];
      const cx = st.position.x;
      const cz = st.position.z;
      const ox = k.x - cx;
      const oz = k.z - cz;
      const l = Math.hypot(ox, oz);
      const from = { x: k.x + (ox / l) * 12, y: k.y + 1, z: k.z + (oz / l) * 12 };
      const hit = await probe(from, k);
      assert.deepEqual(hit, { zone: 'weakpoint', weakPoint: i }, `ray at knee ${i} hits weak point ${i}`);
    }
    const body = await probe({ x: st.position.x + 30, y: 8.4, z: st.position.z }, { x: st.position.x, y: 8.4, z: st.position.z });
    assert.equal(body?.zone, 'armor', 'hull is armour');
    const absorbed = await page.evaluate(() => window.__NH__.game.ctx.testHooks.boss.damageCore(4000));
    assert.equal(absorbed.absorbed, true, 'eye (core) closed before the knee lights are gone');
    for (let i = 0; i < 4; i++) await page.evaluate((n) => window.__NH__.game.ctx.testHooks.boss.damageWeakPoint(n, 500), i);
    st = await state(page);
    assert.equal(st.phase, 'core-exposed', 'eye opens after four knee lights');
    const core = await page.evaluate(() => window.__NH__.game.ctx.testHooks.boss.damageCore(100));
    assert.equal(core.dealt, 100, 'eye takes damage');
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }

  // ---- run 2: full-length cinematic timeline, nobody in the arena ---------------------------
  {
    const { page, failures } = await openGame('?autostart');
    await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.boss, null, { timeout: 30_000 });
    await page.evaluate(RECORD);
    await page.evaluate(() => window.__NH__.game.ctx.events.emit('objectives:allActivated', { timeRemaining: 100 }));
    await until(page, "b.phase === 'weakpoint-hunt'");
    const st = await state(page);
    assert.equal(st.landing.x, -28, 'empty arena: lands on the arena centre');
    assert.equal(st.landing.z, -90);
    const ev = await page.evaluate(() => window.__rec.events);
    const t0 = ev.find((e) => e.n === 'objectives:allActivated').t;
    const impact = ev.find((e) => e.n === 'boss:spawned').t - t0;
    const hunt = ev.find((e) => e.n === 'boss:phaseChanged' && e.phase === 'weakpoint-hunt').t - t0;
    assert.ok(impact >= 3.7 && impact <= 4.3, `impact at ~3.9 s (${impact.toFixed(2)})`);
    assert.ok(hunt >= 6.0 && hunt <= 6.6, `hunt starts after ~6.2 s (${hunt.toFixed(2)})`);
    assert.ok(ev.some((e) => e.n === 'vfx:spawn' && e.kind === 'dust'), 'dust requested at the impact');
    assert.equal(ev.filter((e) => e.n === 'game:checkpoint').at(-1).id, 'boss-start');
    assert.equal(await page.evaluate(() => window.__NH__.game.ctx.player.controlsLocked), false);
    assert.deepEqual(failures, [], 'no console errors');
    await page.close();
  }
}
