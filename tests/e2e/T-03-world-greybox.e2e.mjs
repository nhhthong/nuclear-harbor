/**
 * T-03 world greybox: boots the harbor, checks hooks, ground ray, container instancing,
 * draw-call budget, sandbox no-op and dispose.
 */
export default async function ({ openGame, wait, assert }) {
  const { page, failures } = await openGame('?autostart');
  await wait(page, 1.5);

  const info = await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    const hooks = ctx.testHooks.world;
    const ground = ctx.physics.raycast({ x: 3, y: 5, z: 96 }, { x: 0, y: -1, z: 0 }, 20);
    const meshes = [];
    ctx.scene.traverse((o) => {
      if (o.isInstancedMesh) meshes.push({ name: o.name, count: o.count, color: !!o.instanceColor });
    });
    const topAnchors = ctx.grappleAnchors.all().filter((a) => a.kind === 'container-top').length;
    const sun = ctx.scene.children.filter((o) => o.isDirectionalLight && o.castShadow).length;
    const lights = ctx.scene.children.filter((o) => o.isLight && o.castShadow).length;
    return {
      hooks,
      groundY: ground ? ground.point.y : null,
      meshes,
      topAnchors,
      sun,
      lights,
      calls: ctx.renderer.webgl.info.render.calls,
      hasLighting: ctx.scene.userData.hasWorldLighting === true,
      hasFog: !!ctx.scene.fog,
    };
  });

  assert.ok(info.hooks, 'world test hook present');
  assert.ok(info.hooks.containerCount >= 250 && info.hooks.containerCount <= 600, `containerCount ${info.hooks.containerCount}`);
  assert.ok(info.hooks.containerColliderCount <= info.hooks.containerCount * 0.4, 'merged container colliders <= 40%');
  assert.ok(info.hooks.colliderCount > 20 && info.hooks.colliderCount < 400, `colliderCount ${info.hooks.colliderCount}`);
  assert.ok(info.hooks.lanes.filter((l) => l.length >= 30 && l.width >= 6).length >= 3, '>= 3 lanes');
  assert.ok(Math.abs(info.groundY) < 1e-3, `ground at spawn y=${info.groundY}`);
  const containers = info.meshes.find((m) => m.name === 'containers');
  assert.ok(containers && containers.color && containers.count === info.hooks.containerCount, 'one InstancedMesh with instanceColor');
  assert.equal(info.topAnchors, info.hooks.anchorCount, 'one container-top anchor per stack');
  assert.equal(info.sun, 1, 'one shadow-casting sun');
  assert.equal(info.lights, 1, 'only one shadow-casting light');
  assert.ok(info.hasLighting && info.hasFog, 'lighting flag and fog');
  assert.ok(info.calls > 0 && info.calls < 350, `draw calls ${info.calls}`);

  // warehouse can be crossed: ray along the door axis at chest height hits nothing inside the building
  const blocked = await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    return ctx.physics.raycast({ x: 0, y: 1, z: 94 }, { x: 0, y: 0, z: -1 }, 60);
  });
  assert.equal(blocked, null, 'door-to-door line through the warehouse is open');
  const wall = await page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    const h = ctx.physics.raycast({ x: -20, y: 1, z: 96 }, { x: 0, y: 0, z: -1 }, 60);
    return h ? h.point.z : null;
  });
  assert.ok(wall !== null && Math.abs(wall - 90) < 0.1, `warehouse south wall blocks rays (z=${wall})`);

  // dispose: scope returns to zero, hook and anchors gone
  const disposed = await page.evaluate(() => {
    const game = window.__NH__.game;
    const { ctx } = game;
    const scope = ctx.resources.scope('world');
    const before = scope.resourceCount;
    game.dispose();
    return { before, after: scope.resourceCount, hook: ctx.testHooks.world ?? null };
  });
  assert.ok(disposed.before > 0, 'world scope holds resources');
  assert.equal(disposed.after, 0, 'world scope empty after dispose');
  assert.equal(disposed.hook, null, 'hook removed');
  assert.deepEqual(failures, [], 'no console errors');
  await page.close();

  // sandbox: nothing built
  const sb = await openGame('?sandbox&autostart');
  const sandbox = await sb.page.evaluate(() => {
    const { ctx } = window.__NH__.game;
    return { hook: ctx.testHooks.world ?? null, anchors: ctx.grappleAnchors.all().filter((a) => a.kind === 'container-top').length };
  });
  assert.equal(sandbox.hook, null, 'world builds nothing in sandbox');
  assert.equal(sandbox.anchors, 0);
  assert.deepEqual(sb.failures, [], 'no console errors in sandbox');
  await sb.page.close();
}
