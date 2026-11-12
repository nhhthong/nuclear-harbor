/**
 * T-09 pickups: medkit heals 40 (and is refused at full HP), crate emits weapon:grantAmmo { amount: 30 },
 * every collection emits pickup:collected, pickups cost at most 4 draw calls.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');

  await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    window.__t09 = { grants: [], collected: [] };
    ctx.events.on('weapon:grantAmmo', (e) => window.__t09.grants.push({ ...e }));
    ctx.events.on('pickup:collected', (e) =>
      window.__t09.collected.push({ kind: e.kind, amount: e.amount, x: e.position.x, z: e.position.z }),
    );
  });

  const counts = await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.counts());
  assert.equal(counts.ammo, 1, 'sandbox has one crate');
  assert.equal(counts.medkit, 1, 'sandbox has one medkit');

  const teleport = (x, z) =>
    page.evaluate(
      ([px, pz]) => window.__NH__.game.ctx.player.teleport({ x: px, y: 0, z: pz }),
      [x, z],
    );

  // full HP: medkit is not consumed
  await teleport(-4, 6);
  await wait(page, 0.3);
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.counts().medkit), 1, 'medkit kept at full HP');

  // damage 50, then medkit -> 90 HP
  await page.evaluate(() =>
    window.__NH__.game.ctx.player.applyDamage({ amount: 50, zone: 'body', source: 'enemy' }),
  );
  await wait(page, 0.3);
  const hp = await page.evaluate(() => window.__NH__.game.ctx.player.hp);
  assert.equal(hp, 90, `hp after medkit (got ${hp})`);
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.pickups.counts().medkit), 0, 'medkit consumed');

  // crate
  await teleport(4, 6);
  await wait(page, 0.3);
  const state = await page.evaluate(() => window.__t09);
  assert.deepEqual(state.grants, [{ amount: 30 }], 'grantAmmo 30 observed');
  assert.deepEqual(
    state.collected.map((c) => [c.kind, c.amount]),
    [
      ['medkit', 40],
      ['ammo', 30],
    ],
    'pickup:collected events',
  );

  // draw calls: spawn some extras and count pickup meshes in the scene
  const drawMeshes = await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    ctx.testHooks.pickups.spawn('ammo', { x: 10, y: 0, z: 10 });
    ctx.testHooks.pickups.spawn('medkit', { x: 12, y: 0, z: 10 });
    let n = 0;
    ctx.scene.traverse((o) => {
      if (o.name.startsWith('pickups-')) n++;
    });
    return n;
  });
  assert.ok(drawMeshes <= 4, `pickup meshes ${drawMeshes}`);

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
