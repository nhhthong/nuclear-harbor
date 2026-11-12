/**
 * Example e2e check (foundation): the placeholder fly camera moves forward when W is held.
 * Copy this file as a template: tests/e2e/T-XX-name.e2e.mjs.
 */
export default async function ({ openGame, setKey, wait, assert }) {
  const { page, failures } = await openGame('?sandbox&autostart');
  const before = await page.evaluate(() => window.__NH__.game.ctx.player.position.z);
  await setKey(page, 'KeyW', true);
  await wait(page, 0.5);
  await setKey(page, 'KeyW', false);
  const after = await page.evaluate(() => window.__NH__.game.ctx.player.position.z);
  assert.ok(after < before - 0.5, `player should move north (z ${before} -> ${after})`);
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
