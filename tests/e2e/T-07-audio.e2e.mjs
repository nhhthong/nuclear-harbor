/**
 * T-07 audio: silent without a gesture, plays after one, voices stay capped, master volume and
 * ambience ducking follow settings/state, no audio requests, dispose closes the context.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));

  const hooks = () => page.evaluate(() => {
    const a = window.__NH__.game.ctx.testHooks.audio;
    return { state: a.contextState(), active: a.activeVoices(), peak: a.peakVoices(), nodes: a.liveNodes(), cap: a.voiceCap };
  });
  const emit = (name, payload) =>
    page.evaluate(([n, p]) => {
      window.__NH__.game.ctx.events.emit(n, p);
    }, [name, payload]);

  // AC2: no gesture => no context, events are harmless
  assert.equal((await hooks()).state, 'none', 'no AudioContext before a gesture');
  await emit('weapon:fired', { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 }, mag: 29, reserve: 90 });
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.playedCount('rifleShot')), 0);

  // gesture => context runs
  await page.mouse.click(200, 200);
  await wait(page, 0.3);
  let h = await hooks();
  assert.equal(h.state, 'running', `context should run after a gesture (is ${h.state})`);

  // AC3: representative events from each group are played
  const v = (x, y, z) => ({ x, y, z });
  await emit('weapon:fired', { origin: v(0, 0, 0), direction: v(0, 0, -1), mag: 28, reserve: 90 });
  await emit('weapon:dryFire', {});
  await emit('weapon:reloadStarted', { duration: 1.6 });
  await emit('player:footstep', { sprinting: false });
  await emit('enemy:alerted', { id: 'e1', type: 'sphere', position: v(10, 1, 10) });
  await emit('charger:windup', { id: 'c1', position: v(0, 1, -15), direction: v(0, 0, 1), duration: 1.2 });
  await emit('countdown:tick', { remaining: 60, critical: true });
  await emit('boss:attack', { attack: 'ground-slam', position: v(0, 0, -30), radius: 8 });
  const counts = await page.evaluate(() => {
    const a = window.__NH__.game.ctx.testHooks.audio;
    return ['rifleShot', 'dryClick', 'reload', 'footstepWalk', 'enemyAlert', 'chargerWindup', 'alarm', 'bossSlam'].map((id) => [id, a.playedCount(id)]);
  });
  for (const [id, n] of counts) assert.ok(n >= 1, `${id} should have played`);

  // AC5: a sound beyond max distance is skipped
  await emit('enemy:destroyed', { id: 'far', type: 'sphere', position: v(5000, 0, 5000), remaining: 1 });
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.playedCount('enemyDestroyed')), 0, 'far sound skipped');

  // AC6: 200 rapid emits never exceed the cap
  for (let i = 0; i < 200; i++) {
    await emit('weapon:fired', { origin: v(0, 0, 0), direction: v(0, 0, -1), mag: 1, reserve: 1 });
    await emit('combat:impact', { point: v(3, 1, -4), normal: v(0, 1, 0) });
    await emit('player:footstep', { sprinting: true });
  }
  h = await hooks();
  assert.ok(h.peak <= h.cap, `peak voices ${h.peak} <= cap ${h.cap}`);
  await wait(page, 3);
  const settled = await hooks();
  assert.ok(settled.active <= 2 && settled.nodes < 60, `voices/nodes settle after fire stops (${JSON.stringify(settled)})`);

  // AC4: master volume follows settings at once
  await page.evaluate(() => window.__NH__.game.ctx.settings.set('masterVolume', 0.25));
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.masterVolume()), 0.25);
  // ambience ducks outside playing
  const playing = await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.ambienceLevel());
  await page.evaluate(() => window.__NH__.game.ctx.state.set('paused'));
  const ducked = await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.ambienceLevel());
  assert.ok(ducked < playing, `ambience ducks when paused (${playing} -> ${ducked})`);
  await page.evaluate(() => window.__NH__.game.ctx.state.set('playing'));
  assert.equal(await page.evaluate(() => window.__NH__.game.ctx.testHooks.audio.ambienceLevel()), playing);

  // AC1: no audio file requests
  const audioReq = requests.filter((u) => /\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)(\?|$)/i.test(u));
  assert.deepEqual(audioReq, [], 'no audio file requests');

  // AC8: dispose closes the context
  await page.evaluate(() => {
    const hooks = window.__NH__.game.ctx.testHooks.audio; // Game.dispose may clear testHooks: keep a handle
    window.__t7 = hooks;
    window.__NH__.game.dispose();
  });
  assert.equal(await page.evaluate(() => window.__t7.contextState()), 'closed');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
