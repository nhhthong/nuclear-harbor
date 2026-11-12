# Quickstart: validating TITAN-04

```bash
export SMOKE_PORT=4715
npm run typecheck && npm test && npm run build
SMOKE_PORT=$SMOKE_PORT npm run smoke
SMOKE_PORT=$SMOKE_PORT npm run e2e -- T-15
```

Manual: `npm run dev`, open `/?sandbox&autostart&boss` (scaled) or `/?autostart&boss` (full size). Use `window.__NH__.game.testHooks.boss` (`getState`, `damageWeakPoint`, `damageCore`, `forceAttack`).

Expected: `boss:spawned`, phases awakening -> weakpoint-hunt, core hits absorbed until four weak points are gone, then `boss:coreExposed`, attacks telegraph then hit, `damageCore(4000)` -> one `boss:defeated`.
