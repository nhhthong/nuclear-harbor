# Quickstart: validating T-20

Prerequisites: `node_modules` present, `npm run build` done.

1. Units: `npm run typecheck && npm test` (new tests: armyBrain, motion, salvo, splash, EnemyProjectiles rockets).
2. Sandbox run: `?sandbox&autostart&enemies=sphere` spawns one mech; teleport the player 28 m away with line of sight.
   Expect: alert event, advance, settle in 18-25 m, telegraph glow, salvo of 2-3 rockets, cooldown >= 3 s, player HP drops in splash steps.
3. Close in under 8 m: the mech retreats while facing the player.
4. Draw calls: harbor and sandbox with a single mech near/far: read `renderer.info.render.calls` difference.
5. Screenshots (`scripts/screenshots.mjs` style, deviceScaleFactor 1): mech near, far, rocket in flight; compare with the reference page.
6. `npm run smoke`, then every `tests/e2e/*.e2e.mjs` separately with its own `SMOKE_PORT`.
