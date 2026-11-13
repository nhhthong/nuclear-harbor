# Quickstart

```bash
npm run typecheck && npm test && npm run build
SMOKE_PORT=4622 npm run e2e -- T-22     # cinematic, landing, skip, fight
SMOKE_PORT=4622 npm run e2e -- T-15
SMOKE_PORT=4622 npm run e2e -- T-16
```

Manual: open `/?autostart&boss` (cinematic starts after 0.4 s), press E after 2 s to skip. Hook: `__NH__.game.ctx.testHooks.boss.skipCinematic()`, `.getState().cinematic`.
