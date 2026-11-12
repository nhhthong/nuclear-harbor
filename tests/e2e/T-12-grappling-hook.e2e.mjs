/**
 * T-12 e2e (?sandbox&autostart): pillar grapple (speed, auto release), failures, cooldown, manual
 * release, perch landing and the stacked container roof. Aiming sets yaw/pitch directly.
 */
export default async function ({ openGame, setKey, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');

  await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    window.__ev = [];
    for (const t of ['fired', 'attached', 'released', 'failed', 'cooldown']) {
      ctx.events.on(`grapple:${t}`, (p) => window.__ev.push({ t, ...p, point: undefined, origin: undefined, direction: undefined }));
    }
    window.__speeds = [];
    window.__maxEyeY = 0;
    setInterval(() => {
      const { player } = ctx;
      const st = ctx.testHooks.grapple.getState();
      window.__maxEyeY = Math.max(window.__maxEyeY, player.position.y + player.eyeHeight);
      if (st.phase === 'pulling' && player.externalVelocity) window.__speeds.push(player.velocity.length());
    }, 16);
  });

  const place = (x, y, z) => page.evaluate(([a, b, c]) => window.__NH__.game.ctx.player.teleport({ x: a, y: b, z: c }, 0), [x, y, z]);
  const aimAt = (x, y, z) =>
    page.evaluate(([tx, ty, tz]) => {
      const { player } = window.__NH__.game.ctx;
      const ex = player.position.x;
      const ey = player.position.y + player.eyeHeight;
      const ez = player.position.z;
      const dx = tx - ex;
      const dy = ty - ey;
      const dz = tz - ez;
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    }, [x, y, z]);
  const press = async () => {
    await setKey(page, 'Space', true);
    await wait(page, 0.05);
    await setKey(page, 'Space', false);
  };
  const events = () => page.evaluate(() => window.__ev.splice(0));
  /** Collects events until `pred(all)` holds (or 6 s of wall time pass); returns all collected. */
  const collect = async (pred, timeout = 6) => {
    const all = [];
    for (let t = 0; t < timeout; t += 0.1) {
      all.push(...(await events()));
      if (pred(all)) break;
      await wait(page, 0.1);
    }
    return all;
  };
  const state = () => page.evaluate(() => window.__NH__.game.ctx.testHooks.grapple.getState());
  const feet = () => page.evaluate(() => {
    const { player } = window.__NH__.game.ctx;
    return { x: player.position.x, y: player.position.y, z: player.position.z, grounded: player.grounded, ext: player.externalVelocity !== null };
  });

  await wait(page, 0.5);

  // 1. failure on the ground, then cooldown
  await place(3, 0, 12);
  await wait(page, 0.3);
  await page.evaluate(() => { window.__NH__.game.ctx.player.pitch = -0.7; });
  await press();
  let ev = await collect((a) => a.some((e) => e.t === 'failed'));
  assert.ok(ev.some((e) => e.t === 'failed' && e.reason === 'not-grappleable'), 'ground -> not-grappleable');
  await collect((a) => a.some((e) => e.t === 'cooldown' && e.remaining === 0));
  await page.evaluate(() => { window.__NH__.game.ctx.player.pitch = 0.9; });
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'failed'));
  assert.ok(ev.some((e) => e.t === 'failed' && e.reason === 'no-target'), 'sky -> no-target ' + JSON.stringify(ev));
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'failed'));
  assert.ok(ev.some((e) => e.t === 'failed' && e.reason === 'cooldown'), 'press during cooldown -> cooldown');
  assert.ok(ev.some((e) => e.t === 'cooldown' && e.remaining > 0), 'cooldown events carry remaining time');
  await collect((a) => a.some((e) => e.t === 'cooldown' && e.remaining === 0));

  // 2. pillar anchor: attach, ~18 m/s, rises above 8 m, auto-release
  await place(0, 0, 6);
  await wait(page, 0.3);
  await aimAt(0, 11.5, -12.5);
  await events();
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'released'), 10);
  assert.ok(ev.some((e) => e.t === 'attached' && e.anchorId === 'sandbox-pillar'), 'attached to the pillar anchor ' + JSON.stringify(ev));
  const rel = ev.find((e) => e.t === 'released');
  assert.ok(rel && rel.reason === 'arrived', `released on arrival (got ${rel?.reason})`);
  const maxY = await page.evaluate(() => window.__maxEyeY);
  assert.ok(maxY > 8, `eye rose above 8 m (max ${maxY.toFixed(1)})`);
  const speeds = await page.evaluate(() => window.__speeds.slice().sort((a, b) => a - b));
  const median = speeds[Math.floor(speeds.length / 2)] ?? 0;
  assert.ok(median > 18 * 0.95 && median < 18 * 1.05, `pull speed ${median.toFixed(2)} should be ~18 m/s`);
  assert.equal((await feet()).ext, false, 'externalVelocity cleared after release');
  await wait(page, 1.5);

  // 3. manual release with a second press
  await place(0, 0, 6);
  await wait(page, 0.3);
  await aimAt(0, 11.5, -12.5);
  await events();
  await press();
  await collect((a) => a.some((e) => e.t === 'attached'));
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'released'));
  assert.ok(ev.some((e) => e.t === 'released' && e.reason === 'manual'), 'second press releases manually');
  assert.equal((await feet()).ext, false, 'externalVelocity cleared after manual release');
  await wait(page, 1.5);

  // 4. a wall appears between player and anchor mid-pull: the capsule cannot pass, release as stuck
  await place(0, 0, 6);
  await wait(page, 0.3);
  await aimAt(0, 11.5, -12.5);
  await events();
  await press();
  await collect((a) => a.some((e) => e.t === 'attached'));
  await page.evaluate(() => {
    window.__NH__.game.ctx.physics.addStaticBox({
      center: { x: 0, y: 10, z: -2 },
      halfExtents: { x: 15, y: 10, z: 0.3 },
      meta: { kind: 'static' },
    });
    window.__NH__.game.ctx.physics.syncQueries?.();
  });
  ev = await collect((a) => a.some((e) => e.t === 'released'), 8);
  const rel2 = ev.find((e) => e.t === 'released');
  assert.ok(rel2 && (rel2.reason === 'stuck' || rel2.reason === 'timeout'), `released against the wall (got ${rel2?.reason})`);
  const blocked = await feet();
  assert.ok(blocked.z > -1.7, `player did not pass through the wall (z=${blocked.z.toFixed(2)})`);
  assert.equal(blocked.ext, false, 'externalVelocity cleared');
  await collect((a) => a.some((e) => e.t === 'cooldown' && e.remaining === 0));

  // 5. perch anchor: end standing on the platform (y ~ 8)
  await place(12, 9, -8);
  await aimAt(12, 10.2, -16.55);
  await events();
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'released'), 10);
  await wait(page, 1);
  assert.ok(ev.some((e) => e.t === 'attached' && e.anchorId === 'sandbox-perch'), 'attached to the perch anchor');
  const perch = await feet();
  assert.ok(Math.abs(perch.y - 8) < 0.3 && perch.grounded, `standing on the perch (y=${perch.y.toFixed(2)}, grounded=${perch.grounded})`);
  assert.ok(Math.abs(perch.x - 12) < 3.2 && perch.z < -10.9 && perch.z > -17.1, 'on the platform footprint');
  await wait(page, 1.2);

  // 6. stacked container top (x -12, z -18, roof 5.18): end up on the roof
  await place(-12, 0, -6);
  await wait(page, 0.3);
  await aimAt(-12, 4.9, -16.78);
  await events();
  await press();
  ev = await collect((a) => a.some((e) => e.t === 'released'), 10);
  await wait(page, 2);
  assert.ok(ev.some((e) => e.t === 'attached'), 'attached to the container top');
  const roof = await feet();
  assert.ok(roof.y > 5.0 && roof.y < 5.6 && roof.z < -16.8 && roof.z > -19.2, `on the container roof (y=${roof.y.toFixed(2)}, z=${roof.z.toFixed(2)})`);

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
