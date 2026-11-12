/**
 * T-18 e2e: the converted G36C model is served same-origin, loads as the view model with
 * `?viewmodel=glb`, animates on fire/reload, and falls back to the procedural model when the
 * file is blocked or corrupt. Default boot stays procedural.
 *
 * `?viewmodel=glb` only takes effect in the game once `src/weapon/index.ts` calls `createViewModel`
 * (foundation request in specs/T-18-weapon-asset-pipeline/foundation-requests.md). Until then the
 * GLB checks run in "pending" mode: the procedural model must remain and shooting must work.
 */
const skinnedCount = (page) =>
  page.evaluate(() => {
    let n = 0;
    window.__NH__.game.ctx.camera.traverse((o) => {
      if (o.isSkinnedMesh) n++;
    });
    return n;
  });

const handPos = (page) =>
  page.evaluate(() => {
    let out = null;
    window.__NH__.game.ctx.camera.traverse((o) => {
      if (o.isBone && o.name === 'Right_Hand') {
        const v = o.getWorldPosition(new o.position.constructor());
        out = [v.x, v.y, v.z];
      }
    });
    return out;
  });

export default async function ({ openGame, assert }) {
  // 1. default: procedural, no GLB request at all
  const def = await openGame('?sandbox&autostart');
  assert.equal(await skinnedCount(def.page), 0, 'default boot uses the procedural model');
  const defRequests = await def.page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
  assert.ok(!defRequests.some((u) => u.endsWith('.glb')), 'no GLB request without ?viewmodel=glb');
  assert.deepEqual(def.failures, [], 'default boot is clean');
  await def.page.close();

  // 2. GLB is shipped, same origin, valid container
  const glb = await openGame('?sandbox&autostart&viewmodel=glb');
  const probe = await glb.page.evaluate(async () => {
    const res = await fetch('assets/weapons/g36c/g36c.glb');
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { ok: res.ok, size: bytes.length, magic: String.fromCharCode(...bytes.slice(0, 4)), origin: location.origin, url: res.url };
  });
  assert.ok(probe.ok && probe.magic === 'glTF', 'GLB served with glTF magic');
  assert.ok(probe.size > 100_000 && probe.size < 4 * 1024 * 1024, `GLB size modest (${probe.size})`);
  assert.ok(probe.url.startsWith(probe.origin), 'GLB is same-origin');

  // 3. with the switch the model loads (or, before the foundation hook lands, stays procedural)
  let active = false;
  try {
    await glb.page.waitForFunction(
      () => {
        let n = 0;
        window.__NH__.game.ctx.camera.traverse((o) => {
          if (o.isSkinnedMesh) n++;
        });
        return n > 0;
      },
      null,
      { timeout: 10_000 },
    );
    active = true;
  } catch {
    console.log('       note: ?viewmodel=glb not wired in src/weapon/index.ts yet (foundation request); pending mode');
  }
  const origins = await glb.page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name).filter((u) => !u.startsWith(location.origin) && !u.startsWith('blob:') && !u.startsWith('data:')),
  );
  assert.deepEqual(origins, [], 'no request outside the page origin');
  assert.deepEqual(glb.failures, [], 'GLB boot has no console errors');

  if (active) {
    assert.equal(await skinnedCount(glb.page), 1, 'one skinned mesh (one draw call)');
    await glb.page.waitForTimeout(2500); // draw clip ends, idle loop runs
    const before = await handPos(glb.page);
    const ammo0 = await glb.page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.getAmmo().mag);
    assert.equal(await glb.page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.fireOnce()), true, 'fires with the GLB model');
    const ammo1 = await glb.page.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.getAmmo().mag);
    assert.equal(ammo1, ammo0 - 1, 'ammo decremented');
    await glb.page.evaluate(() => window.__NH__.game.ctx.input.handleCode('KeyR', true));
    await glb.page.waitForTimeout(100);
    await glb.page.evaluate(() => window.__NH__.game.ctx.input.handleCode('KeyR', false));
    await glb.page.waitForTimeout(1200);
    const during = await handPos(glb.page);
    const moved = Math.hypot(...before.map((v, i) => v - during[i]));
    assert.ok(moved > 0.02, `reload animation moves the hand bone (${moved.toFixed(3)} m)`);
  }
  await glb.page.close();

  // 4. fallback: corrupt file keeps the procedural model and the weapon works
  const bad = (await openGame('?sandbox&autostart&viewmodel=glb')).page;
  const pageErrors = [];
  const warnings = [];
  bad.on('pageerror', (e) => pageErrors.push(e.message));
  bad.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()));
  await bad.route('**/g36c.glb', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: 'not a glb at all' }));
  await bad.reload({ waitUntil: 'load' });
  await bad.waitForFunction(() => window.__NH__ && window.__NH__.ready, null, { timeout: 30_000 });
  await bad.waitForTimeout(2500);
  assert.equal(await skinnedCount(bad), 0, 'corrupt GLB keeps the procedural model');
  assert.equal(await bad.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.fireOnce()), true, 'weapon still fires after fallback');
  assert.deepEqual(pageErrors, [], 'fallback raises no uncaught error');
  if (active) assert.equal(warnings.filter((w) => w.includes('GLB view model unavailable')).length, 1, 'fallback logged once');
  await bad.close();

  // 5. fallback: blocked file (network error)
  const missing = (await openGame('?sandbox&autostart&viewmodel=glb')).page;
  const missingErrors = [];
  missing.on('pageerror', (e) => missingErrors.push(e.message));
  await missing.route('**/g36c.glb', (route) => route.abort());
  await missing.reload({ waitUntil: 'load' });
  await missing.waitForFunction(() => window.__NH__ && window.__NH__.ready, null, { timeout: 30_000 });
  await missing.waitForTimeout(2000);
  assert.equal(await skinnedCount(missing), 0, 'blocked GLB keeps the procedural model');
  assert.equal(await missing.evaluate(() => window.__NH__.game.ctx.testHooks.weapon.fireOnce()), true, 'weapon fires with blocked GLB');
  assert.deepEqual(missingErrors, [], 'blocked GLB raises no uncaught error');
  await missing.close();
}
