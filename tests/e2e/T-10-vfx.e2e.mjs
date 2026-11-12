/**
 * T-10 VFX: flooding vfx:spawn drops effects instead of growing, impacts/hits show feedback by
 * themselves, and everything returns to zero live particles.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');
  await wait(page, 0.3);

  const hooks = () => page.evaluate(() => {
    const h = window.__NH__.game.ctx.testHooks.vfx;
    return { live: h.liveParticles(), emitters: h.liveEmitters(), dropped: h.dropped(), capacity: h.capacity() };
  });

  const start = await hooks();
  assert.equal(start.live, 0, 'no particles at start');
  assert.ok(start.capacity > 0, 'capacity reported');

  // AC2: hits and impacts produce particles without any other module
  await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    const V = ctx.player.position.constructor;
    const v = (x, y, z) => new V(x, y, z);
    ctx.events.emit('combat:impact', { point: v(0, 1, -5), normal: v(0, 1, 0) });
    ctx.events.emit('combat:hit', { targetId: 'x', targetKind: 'robot', zone: 'weakpoint', dealt: 1, killed: false, absorbed: false, point: v(1, 1, -5), normal: v(0, 1, 0) });
  });
  await wait(page, 0.1);
  assert.ok((await hooks()).live > 0, 'impact and hit spawn particles');

  // AC4: 500 requests in one frame
  await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    const V = ctx.player.position.constructor;
    const kinds = ['spark', 'armor-spark', 'explosion', 'big-explosion', 'smoke', 'dust', 'pickup', 'telegraph-ring'];
    for (let i = 0; i < 500; i++) {
      ctx.events.emit('vfx:spawn', { kind: kinds[i % kinds.length], position: new V(0, 1, -6), scale: 2 });
    }
  });
  await wait(page, 0.2);
  const flood = await hooks();
  assert.ok(flood.live <= flood.capacity, `live ${flood.live} <= capacity ${flood.capacity}`);
  assert.ok(flood.dropped > 0, 'flood dropped some effects');

  // draw calls: scene objects used by vfx stay within the particle budget (2 Points)
  const pointsCount = await page.evaluate(() => {
    let n = 0;
    window.__NH__.game.ctx.scene.traverse((o) => {
      if (o.isPoints) n++;
    });
    return n;
  });
  assert.ok(pointsCount <= 3, `particle draw calls <= 3 (got ${pointsCount})`);

  // everything finishes
  await wait(page, 5);
  const end = await hooks();
  assert.equal(end.live, 0, 'particles return to zero');
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
