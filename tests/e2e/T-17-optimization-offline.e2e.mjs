/**
 * T-17: settings are applied, static shadow, draw-call budget in every state, credits screen,
 * UI request() no longer forces `playing`, boss checkpoint payload is a copy, warehouse is lit.
 * (Offline boot and the cross-origin check live in scripts/offline.mjs, `npm run offline`.)
 */
export default async function ({ openGame, wait, assert }) {
  // ---- menu: budget, static shadows, credits ----
  {
    const { page, failures } = await openGame('');
    await wait(page, 1.0);
    const m = await page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      const w = ctx.renderer.webgl;
      ctx.renderer.render(ctx.scene);
      return {
        calls: w.info.render.calls,
        budget: ctx.tunables.PERFORMANCE.maxDrawCalls,
        autoUpdate: w.shadowMap.autoUpdate,
        state: ctx.state.current,
      };
    });
    assert.equal(m.state, 'menu');
    assert.ok(m.calls <= m.budget, `menu draw calls ${m.calls} <= ${m.budget}`);
    assert.equal(m.autoUpdate, false, 'shadow map is not auto-updated');

    await page.click('[data-screen="menu"] [data-action="credits"]');
    const credits = await page.evaluate(() => {
      const s = document.querySelector('[data-screen="credits"]');
      return { visible: !s.classList.contains('nh-hidden'), text: s.textContent };
    });
    assert.ok(credits.visible, 'credits screen opens');
    for (const word of ['funnky', 'G36C', 'Three.js', 'Rapier']) assert.match(credits.text, new RegExp(word), `credits mention ${word}`);
    await page.click('[data-screen="credits"] [data-action="back"]');
    assert.ok(await page.evaluate(() => window.__NH__.game.ctx.testHooks.ui.isVisible('menu')), 'Back returns to the menu');
    assert.deepEqual(failures, []);
    await page.close();
  }

  // ---- settings are applied and persisted ----
  {
    const { page, failures } = await openGame('?sandbox&autostart');
    await wait(page, 0.5);
    const read = () =>
      page.evaluate(() => {
        const { ctx, loop } = window.__NH__.game;
        const w = ctx.renderer.webgl;
        const sun = ctx.scene.getObjectByName('sun');
        return {
          shadows: w.shadowMap.enabled,
          far: ctx.camera.far,
          pixelRatio: w.getPixelRatio(),
          interval: loop.minFrameIntervalMs,
          volume: ctx.testHooks.audio?.masterVolume?.(),
          fog: ctx.scene.fog ? [ctx.scene.fog.near, ctx.scene.fog.far] : null,
          sunMap: sun?.shadow.mapSize.x ?? null,
        };
      });
    await page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      ctx.settings.set('quality', 'low');
      ctx.settings.set('fpsCap', 30);
      ctx.settings.set('masterVolume', 0.3);
    });
    const low = await read();
    assert.equal(low.shadows, false, 'low: shadows off');
    assert.equal(low.far, 300, 'low: view distance 300');
    assert.ok(low.pixelRatio <= 1, 'low: pixel ratio capped at 1');
    assert.ok(Math.abs(low.interval - 1000 / 30) < 0.01, 'fps cap 30 sets the frame interval');
    if (low.volume !== undefined) assert.ok(Math.abs(low.volume - 0.3) < 1e-6, `master volume reaches audio (${low.volume})`);
    if (low.fog) assert.ok(low.fog[1] <= 300, `fog far follows the view distance (${low.fog})`);

    await page.evaluate(() => window.__NH__.game.ctx.settings.set('quality', 'high'));
    const high = await read();
    assert.equal(high.shadows, true, 'high: shadows on');
    assert.equal(high.far, 600);
    if (high.sunMap !== null) assert.equal(high.sunMap, 4096, 'high: 4096 shadow map');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nuclear-harbor.settings.v1')));
    assert.equal(stored.quality, 'high');
    assert.equal(stored.fpsCap, 30);
    assert.equal(stored.masterVolume, 0.3);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.__NH__?.ready, null, { timeout: 30_000 });
    const after = await page.evaluate(() => {
      const s = window.__NH__.game.ctx.settings;
      return [s.get('quality'), s.get('fpsCap'), s.get('masterVolume')];
    });
    assert.deepEqual(after, ['high', 30, 0.3], 'settings survive a reload');
    assert.deepEqual(failures, []);
    await page.close();
  }

  // ---- UI request() does not force playing when flow refuses ----
  {
    const { page, failures } = await openGame('?autostart&countdown=2');
    await page.waitForFunction(() => window.__NH__.game.ctx.state.current === 'gameOver', null, { timeout: 30_000 });
    await page.evaluate(() => document.querySelector('[data-screen="gameOver"] [data-action="respawn"]').click());
    await wait(page, 0.3);
    const state = await page.evaluate(() => window.__NH__.game.ctx.state.current);
    assert.equal(state, 'gameOver', 'refused respawn leaves the game over');
    assert.deepEqual(failures, []);
    await page.close();
  }

  // ---- boss checkpoint payload is not the live player vector ----
  {
    const { page, failures } = await openGame('?autostart&boss');
    await page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      window.__cp = null;
      ctx.events.on('game:checkpoint', (e) => {
        if (e.id === 'boss-start') window.__cp = { live: e.position === ctx.player.position, x: e.position.x };
      });
    });
    await page.waitForFunction(() => window.__cp !== null, null, { timeout: 30_000 });
    const cp = await page.evaluate(() => window.__cp);
    assert.equal(cp.live, false, 'boss-start checkpoint carries a copy');
    assert.deepEqual(failures, []);
    await page.close();
  }

  // ---- warehouse interior is lit (tower 1 view), mean brightness of the frame ----
  {
    const { page, failures } = await openGame('?autostart');
    await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 20, y: 0.1, z: 70 }, 0));
    await wait(page, 2.0);
    const mean = await page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      ctx.renderer.render(ctx.scene);
      const gl = ctx.renderer.webgl.getContext();
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const px = new Uint8Array(4);
      let sum = 0;
      let n = 0;
      // lower-middle band: walls and floor, away from the HUD and the weapon model
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(((i % 10) + 0.5) * (w / 10));
        const y = Math.floor(h * (0.35 + 0.1 * Math.floor(i / 10)));
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        sum += (px[0] + px[1] + px[2]) / 3;
        n++;
      }
      return sum / n;
    });
    assert.ok(mean > 35, `warehouse interior is visible (mean ${mean.toFixed(1)} / 255)`);
    assert.deepEqual(failures, []);
    await page.close();
  }
}
