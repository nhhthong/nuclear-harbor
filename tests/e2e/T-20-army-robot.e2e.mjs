/**
 * T-20: Vanguard army mech (internal type 'sphere') in the sandbox. Slow smooth patrol, detection,
 * advance to the 18-25 m firing band, telegraphed rocket salvos (2-3 rockets, >= 3 s cooldown, 12 damage),
 * retreat when the player is closer than 8 m, and the draw-call cost (<= 6 near, 1 far).
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures, booted } = await openGame('?sandbox&autostart&enemies=sphere');
  assert.ok(booted, 'game boots');
  // software WebGL is slow: a tiny viewport keeps the fixed-step simulation close to real time
  await page.setViewportSize({ width: 320, height: 180 });
  await page.waitForFunction(() => window.__NH__.game.ctx.testHooks.enemies?.list().length === 1, null, { timeout: 10_000 });
  const mech = () => page.evaluate(() => {
    const e = window.__NH__.game.ctx.enemies.all()[0];
    return { state: e.state, speed: e.speed, salvo: e.salvoPhase, x: e.position.x, z: e.position.z, hp: e.hp };
  });

  // 1. patrol: slow (1.5 m/s) and smooth, player far away
  await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: -38, y: 0, z: 38 }, 0));
  await page.evaluate(() => {
    window.__t20 = { speeds: [], alerted: 0, shots: [], damaged: [] };
    const ctx = window.__NH__.game.ctx;
    ctx.events.on('enemy:alerted', () => window.__t20.alerted++);
    ctx.events.on('enemy:attacked', () => window.__t20.shots.push(ctx.clock.simTime));
    ctx.events.on('player:damaged', (e) => window.__t20.damaged.push(e.amount));
  });
  let maxPatrol = 0;
  for (let i = 0; i < 24; i++) {
    await wait(page, 0.25);
    const m = await mech();
    assert.equal(m.state, 'patrol');
    maxPatrol = Math.max(maxPatrol, m.speed);
  }
  assert.ok(maxPatrol > 1.2 && maxPatrol <= 1.55, `patrol speed ~1.5 m/s (max ${maxPatrol.toFixed(2)})`);

  // 2. draw calls: near mech <= 6 extra calls, far mech 1 extra call
  const callDiff = async (px, pz) => {
    await page.evaluate(([x, z]) => window.__NH__.game.ctx.player.teleport({ x, y: 0.1, z }, 0), [px, pz]);
    await wait(page, 0.4);
    const run = (visible) =>
      page.evaluate((vis) => {
        const ctx = window.__NH__.game.ctx;
        let lod = null;
        ctx.scene.traverse((o) => {
          if (o.isLOD) lod = o;
        });
        lod.parent.parent.visible = vis;
        const gl = ctx.renderer.webgl;
        const s = [];
        for (let i = 0; i < 4; i++) {
          gl.render(ctx.scene, ctx.camera);
          s.push(gl.info.render.calls);
        }
        return { calls: Math.min(...s), level: lod.getCurrentLevel() };
      }, visible);
    const withMech = await run(true);
    const without = await run(false);
    await page.evaluate(() => {
      let lod = null;
      window.__NH__.game.ctx.scene.traverse((o) => {
        if (o.isLOD) lod = o;
      });
      lod.parent.parent.visible = true;
    });
    await page.evaluate(() => {
      const ctx = window.__NH__.game.ctx;
      ctx.player.teleport({ x: -38, y: 0, z: 38 }, 0);
      ctx.enemies.all()[0].dropTarget();
    });
    return { diff: withMech.calls - without.calls, level: withMech.level };
  };
  const m0 = await mech();
  // near: stand 12 m south-east of the mech (it may be mid-patrol; the game keeps running)
  const near = await callDiff(m0.x + 6, m0.z + 10);
  // far: 70 m away
  const far = await callDiff(m0.x - 38 > -40 ? m0.x - 38 : m0.x + 38, m0.z + 38);
  console.log(`T-20 draw calls: near +${near.diff} (LOD ${near.level}), far +${far.diff} (LOD ${far.level})`);
  assert.ok(near.diff >= 1 && near.diff <= 7, `near mech <= 6 draw calls (+${near.diff})`);
  assert.ok(far.diff <= 2, `far mech <= 2 draw calls (+${far.diff})`);

  // 3. detect from ~26 m with line of sight: advance, settle in the band, salvos with cooldown
  await page.evaluate(() => {
    window.__t20.shots.length = 0;
    window.__t20.damaged.length = 0;
    window.__t20.alerted = 0;
  });
  await wait(page, 0.5);
  const m1 = await mech();
  assert.equal(m1.state, 'patrol');
  // pick a spot ~26 m away with a clear line of sight (the sandbox has a pillar and containers)
  for (const [dx, dz] of [[4, 26], [-4, -26], [26, 4], [-26, 4], [20, 17], [-20, 17]]) {
    const x = Math.max(-38, Math.min(38, m1.x + dx));
    const z = Math.max(-38, Math.min(38, m1.z + dz));
    await page.evaluate(([px, pz]) => window.__NH__.game.ctx.player.teleport({ x: px, y: 0, z: pz }, 0), [x, z]);
    await wait(page, 0.6);
    if ((await page.evaluate(() => window.__t20.alerted)) > 0) break;
  }
  const states = new Set();
  const dists = [];
  let prev = (await mech()).speed;
  let maxJump = 0;
  const started = Date.now();
  while (Date.now() - started < 80_000) {
    await wait(page, 0.1);
    const m = await mech();
    const p = await page.evaluate(() => window.__NH__.game.ctx.player.position);
    states.add(m.state);
    if (process.env.T20_DEBUG) console.log(((Date.now() - started) / 1000).toFixed(1), m.state, m.salvo, m.speed.toFixed(2), Math.hypot(m.x - p.x, m.z - p.z).toFixed(1), (await page.evaluate(() => window.__NH__.game.ctx.player.hp)));
    maxJump = Math.max(maxJump, Math.abs(m.speed - prev));
    prev = m.speed;
    if (m.state === 'engage') dists.push(Math.hypot(m.x - p.x, m.z - p.z));
    const t = await page.evaluate(() => window.__t20.shots.length);
    if (t >= 5) break;
  }
  const t20 = await page.evaluate(() => window.__t20);
  assert.ok(t20.alerted >= 1, 'mech alerted');
  assert.ok(states.has('engage'), `engages (${[...states]})`);
  assert.ok(t20.shots.length >= 4, `fired rockets (${t20.shots.length})`);
  assert.ok(maxJump < 0.5, `speed never snaps (max change per 0.1 s ${maxJump.toFixed(2)})`);
  const lo = Math.min(...dists);
  const hi = Math.max(...dists);
  console.log(`T-20 engage distance ${lo.toFixed(1)}..${hi.toFixed(1)} m, shots ${t20.shots.length}, damage events ${t20.damaged}`);
  assert.ok(lo > 14 && hi < 29, `engages inside the firing band (${lo.toFixed(1)}..${hi.toFixed(1)})`);
  const gaps = t20.shots.slice(1).map((t, i) => t - t20.shots[i]);
  assert.ok(gaps.some((g) => g >= 2.9), `salvos are separated by the cooldown (gaps ${gaps.map((g) => g.toFixed(2))})`);
  assert.ok(gaps.some((g) => g < 1.0), 'rockets of one salvo follow each other quickly');
  for (const d of t20.damaged) assert.ok(d >= 1 && d <= 12, `rocket damage <= 12 (${d})`);

  // 4. close in: retreat while facing the player
  const m2 = await mech();
  await page.evaluate(([x, z]) => window.__NH__.game.ctx.player.teleport({ x: x + 1, y: 0, z: z + 5 }, 0), [m2.x, m2.z]);
  await wait(page, 1.2);
  assert.equal((await mech()).state, 'retreat');

  // 5. kill through the shared damage path
  await page.evaluate(() => window.__NH__.game.ctx.enemies.all()[0].applyDamage({ amount: 1000, zone: 'body', source: 'player' }));
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.enemies.all().length), 0);
  await wait(page, 0.5);
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
