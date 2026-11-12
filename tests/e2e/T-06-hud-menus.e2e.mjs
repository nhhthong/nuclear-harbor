/**
 * T-06 e2e: menus, HUD text from events, settings persistence, game over / victory buttons.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('');
  const ui = (fn, arg) => page.evaluate(fn, arg);
  // the player controller (T-01) requests pointer lock while playing, which stalls Playwright clicks
  const click = async (selector) => {
    await ui(() => document.exitPointerLock?.());
    await page.waitForTimeout(300);
    await page.click(selector);
  };
  const state = () => ui(() => window.__NH__.game.ctx.state.current);
  const visible = (s) => ui((name) => window.__NH__.game.ctx.testHooks.ui.isVisible(name), s);
  const hudText = () => ui(() => window.__NH__.game.ctx.testHooks.ui.getHudText());
  const emit = (name, payload) =>
    ui(([n, p]) => window.__NH__.game.ctx.events.emit(n, p), [name, payload]);

  // main menu, simulation paused
  assert.equal(await state(), 'menu');
  assert.ok(await visible('menu'), 'main menu visible');
  assert.ok(!(await visible('hud')), 'hud hidden in menu');
  const frame0 = await ui(() => window.__NH__.game.ctx.clock.frame);
  await wait(page, 0.3);
  const simTime = await ui(() => window.__NH__.game.ctx.clock.simTime);
  assert.equal(simTime, 0, 'simulation does not run in menu');
  void frame0;
  const controlsText = await ui(() => document.querySelector('.nh-controls').textContent);
  assert.ok(/RMB/.test(controlsText) && /R/.test(controlsText), 'controls list shows reload bindings');

  // Play
  await click('[data-screen="menu"] [data-action="play"]');
  assert.equal(await state(), 'playing');
  assert.ok(await visible('hud'), 'hud visible while playing');
  assert.ok(!(await visible('menu')));

  // let the objectives module (T-08) register its real towers before the test injects its own
  await wait(page, 0.5);

  // HUD from events
  await emit('weapon:ammoChanged', { mag: 17, reserve: 99, magSize: 30, name: 'TEST GUN' });
  await emit('countdown:tick', { remaining: 125, critical: false });
  await emit('tower:registered', { towerId: 0, position: { x: 0, y: 0, z: -20 }, total: 4 });
  await emit('tower:registered', { towerId: 1, position: { x: 30, y: 0, z: 0 }, total: 4 });
  await emit('tower:activated', { towerId: 0, activatedCount: 1, total: 4, position: { x: 0, y: 0, z: -20 } });
  await emit('interact:prompt', { text: 'Hold E to activate' });
  await emit('tower:activationProgress', { towerId: 1, progress: 0.5 });
  await wait(page, 0.2);
  let t = await hudText();
  assert.equal(t.ammo, '17 / 99');
  assert.equal(t.weapon, 'TEST GUN');
  assert.equal(t.countdown, '02:05');
  assert.equal(t.towers, '1/4');
  assert.equal(t.prompt, 'Hold E to activate');
  assert.notEqual(t.compass, '', 'compass shows the remaining inactive tower');
  await emit('tower:activationCancelled', { towerId: 1, reason: 'released' });
  await emit('interact:prompt', { text: null });
  await emit('tower:activated', { towerId: 1, activatedCount: 2, total: 4, position: { x: 30, y: 0, z: 0 } });
  // the real objectives module (T-08) also registers towers in the harbor: mark those active too
  for (const id of [0, 2, 3, 4]) {
    await emit('tower:activated', { towerId: id, activatedCount: id + 1, total: 4, position: { x: 0, y: 0, z: 0 } });
  }
  await wait(page, 0.2);
  t = await hudText();
  assert.equal(t.prompt, '');
  // compass hiding when every tower is active is covered by the nearestInactive unit tests; with the real
  // objectives module registering its own towers in the harbor, this e2e cannot isolate that state.

  // boss
  await emit('boss:spawned', { name: 'TITAN-04', coreHp: 4000, weakPoints: 4, position: { x: 0, y: 0, z: 0 } });
  t = await hudText();
  assert.equal(t.bossName, 'TITAN-04');
  assert.equal(t.bossCore, 'CORE LOCKED');
  await emit('boss:coreExposed', {});
  await emit('boss:coreDamaged', { hp: 3000, maxHp: 4000 });
  t = await hudText();
  assert.equal(t.bossCore, 'CORE 3000 / 4000');

  // damage updates HP
  await ui(() => {
    const p = window.__NH__.game.ctx.player;
    p.applyDamage({ amount: 25, zone: 'body', source: 'enemy' });
  });
  await wait(page, 0.1);
  t = await hudText();
  assert.equal(t.hp, String(await ui(() => Math.ceil(window.__NH__.game.ctx.player.hp))));

  // pause via P and back
  await page.keyboard.press('KeyP');
  assert.equal(await state(), 'paused');
  assert.ok(await visible('pause'));
  await page.keyboard.press('KeyP');
  assert.equal(await state(), 'playing');

  // game over offers respawn and restart, which emit requests
  await ui(() => {
    const c = window.__NH__.game.ctx;
    window.__reqs = [];
    c.events.on('game:requestRespawn', () => window.__reqs.push('respawn'));
    c.events.on('game:requestRestart', () => window.__reqs.push('restart'));
  });
  await emit('game:over', { reason: 'player-died' });
  await ui(() => window.__NH__.game.ctx.state.set('gameOver'));
  assert.ok(await visible('gameOver'));
  assert.ok(await ui(() => !!document.querySelector('[data-action="respawn"]').offsetParent), 'respawn shown on death');
  await click('[data-screen="gameOver"] [data-action="respawn"]');
  assert.deepEqual(await ui(() => window.__reqs), ['respawn']);
  // T-17: the UI no longer forces `playing`; the synthetic game over is not a real flow state, so flow
  // refuses the respawn and the state is left alone.
  assert.equal(await state(), 'gameOver');
  await ui(() => window.__NH__.game.ctx.state.set('playing'));
  await emit('game:over', { reason: 'countdown-expired' });
  await ui(() => window.__NH__.game.ctx.state.set('gameOver'));
  assert.ok(await ui(() => !document.querySelector('[data-action="respawn"]').offsetParent), 'no respawn on timeout');
  await click('[data-screen="gameOver"] [data-action="restart"]');
  assert.deepEqual(await ui(() => window.__reqs), ['respawn', 'restart']);
  await ui(() => window.__NH__.game.ctx.state.set('playing')); // T-17: the UI no longer resumes by itself

  // victory
  await emit('game:victory', { timeRemaining: 300 });
  await ui(() => window.__NH__.game.ctx.state.set('victory'));
  assert.ok(await visible('victory'));
  assert.ok((await ui(() => document.querySelector('[data-screen="victory"]').textContent)).includes('05:00'));
  await ui(() => window.__NH__.game.ctx.state.set('menu'));

  // settings: quality persists across reload; rebinding works
  await click('[data-screen="menu"] [data-action="settings"]');
  assert.ok(await visible('settings'));
  await page.selectOption('select[data-setting="quality"]', 'high');
  assert.equal(await ui(() => window.__NH__.game.ctx.settings.get('quality')), 'high');
  await click('[data-bind="interact"]');
  await page.keyboard.press('KeyF');
  assert.deepEqual(await ui(() => window.__NH__.game.ctx.settings.get('bindings').interact), ['KeyF']);
  assert.deepEqual(await ui(() => window.__NH__.game.ctx.input.getBindings().interact), ['KeyF']);
  await page.keyboard.press('Escape');
  assert.ok(await visible('menu'), 'Escape closes settings');

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__NH__ && window.__NH__.ready, null, { timeout: 30_000 });
  assert.equal(await ui(() => window.__NH__.game.ctx.settings.get('quality')), 'high');

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
