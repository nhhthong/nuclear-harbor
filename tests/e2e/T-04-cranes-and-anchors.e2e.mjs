/**
 * T-04 e2e: cranes, perches, anchors and coverage in the full harbor (`?anchors` debug view on).
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?autostart&anchors');
  await wait(page, 0.5);

  const data = await page.evaluate(() => {
    const ctx = window.__NH__.game.ctx;
    const hooks = ctx.testHooks.structures;
    return {
      summary: hooks.summary(),
      coverage: hooks.coverage(),
      los: hooks.coverageLos(),
      kinds: [...new Set(ctx.grappleAnchors.all().map((a) => a.kind))],
      perchLandings: ctx.grappleAnchors.all().filter((a) => a.kind === 'perch' && a.landing).length,
      debugLine: document.getElementById('structures-anchors-debug')?.textContent ?? '',
      lods: ctx.scene.children.filter((o) => o.isLOD && o.name.startsWith('crane-')).length,
    };
  });

  assert.equal(data.summary.cranes, 6, 'six cranes');
  assert.equal(data.lods, 6, 'six LOD objects in the scene');
  assert.ok(data.summary.craneLods.every((n) => n === 2), 'two LOD levels per crane');
  for (const h of [8, 14, 20]) assert.ok(data.summary.perches[h] >= 2, `at least two perches at ${h} m`);
  assert.ok(data.perchLandings >= 8, 'perch anchors carry landing points');
  assert.equal(data.summary.platformTop, 10, 'tower 3 platform top at y = 10');
  for (const k of ['crane', 'beam', 'lamp-post', 'perch']) assert.ok(data.kinds.includes(k), `anchor kind ${k}`);
  for (const zone of ['B', 'D']) {
    const c = data.coverage.find((z) => z.zone === zone);
    assert.ok(c && c.total > 0 && c.covered === c.total, `zone ${zone} fully covered by range`);
    const l = data.los.find((z) => z.zone === zone);
    assert.ok(l && l.covered / l.total >= 0.95, `zone ${zone} line-of-sight coverage >= 95%`);
  }
  assert.match(data.debugLine, /Anchor range/, 'debug view prints coverage');

  // sandbox builds nothing
  const sandbox = await openGame('?sandbox&autostart');
  const hasHooks = await sandbox.page.evaluate(() => 'structures' in window.__NH__.game.ctx.testHooks);
  assert.equal(hasHooks, false, 'no structures in the sandbox');
  await sandbox.page.close();

  assert.deepEqual(failures, [], 'no console errors');
  await page.close();
}
