/**
 * T-01 e2e: in ?sandbox&autostart hold W (walk, then sprint) and check the measured speed, then that
 * the wall at z = -34 stops the player. Speeds are measured in simulation time, not wall time.
 */
export default async function ({ openGame, setKey, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');
  const sample = () =>
    page.evaluate(() => {
      const { ctx } = window.__NH__.game;
      return { t: ctx.clock.fixedTick * ctx.clock.fixedDt, z: ctx.player.position.z, x: ctx.player.position.x, speed: window.__NH__.game.ctx.testHooks.player.getState().speed };
    });
  const measure = async (seconds) => {
    const a = await sample();
    await wait(page, seconds);
    const b = await sample();
    // displacement/time over a window is quantised by whole ticks (+-1 tick), so also return the
    // controller's reported speed (exact) for the tight tolerance.
    return { avg: Math.abs(b.z - a.z) / (b.t - a.t), speed: b.speed };
  };

  // start on the x = 3 lane: clear of the pillar (x 0, z -14) so the wall at z = -34 is reachable
  await page.evaluate(() => window.__NH__.game.ctx.player.teleport({ x: 3, y: 0, z: 12 }, 0));
  await wait(page, 0.5);
  await setKey(page, 'KeyW', true);
  await wait(page, 0.5);
  const walk = await measure(2);
  assert.ok(walk.speed > 5 * 0.97 && walk.speed < 5 * 1.03, `walk speed ${walk.speed.toFixed(2)} should be ~5 m/s`);
  assert.ok(Math.abs(walk.avg - 5) < 5 * 0.1, `walk displacement speed ${walk.avg.toFixed(2)} should be ~5 m/s`);

  await setKey(page, 'ShiftLeft', true);
  await wait(page, 0.5);
  const sprint = await measure(2);
  assert.ok(sprint.speed > 7.5 * 0.97 && sprint.speed < 7.5 * 1.03, `sprint speed ${sprint.speed.toFixed(2)} should be ~7.5 m/s`);
  assert.ok(Math.abs(sprint.avg - 7.5) < 7.5 * 0.1, `sprint displacement speed ${sprint.avg.toFixed(2)} should be ~7.5 m/s`);

  // keep running into the wall at z = -34 (face), capsule radius 0.35
  for (let i = 0; i < 120; i++) {
    const s = await sample();
    if (s.z < -33.0) break;
    await wait(page, 0.5);
  }
  await wait(page, 1);
  const end = await sample();
  assert.ok(end.z > -33.5 && end.z < -33.0, `wall should stop the player (z=${end.z.toFixed(2)})`);
  assert.ok(end.speed < 0.2, `blocked player should report ~0 speed (${end.speed.toFixed(2)})`);

  await setKey(page, 'KeyW', false);
  await setKey(page, 'ShiftLeft', false);
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
