# Quickstart (T-21)

```bash
npm run typecheck && npm test && npm run build
SMOKE_PORT=4321 npm run e2e -- T-21
```

Manual: `http://127.0.0.1:4173/?autostart&seed=7&debug`, walk to a tower. Debug hook: `window.__NH__.game.ctx.testHooks.dinosaur` (`guards()`, `spawnAt(towerId)`, `list()`, `force(skill)`).
Expected: seed 7 always guards the same two towers; roar + shake on first approach within 35 m; three telegraphed skills; ammo + medkit on death.
