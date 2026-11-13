# Quickstart (T-19)

```bash
npm run typecheck && npm test && npm run build
SMOKE_PORT=4719 npm run smoke
SMOKE_PORT=4719 npm run e2e -- T-13   # Spot
SMOKE_PORT=4719 npm run e2e -- T-14   # Duck
```

Manual: `npm run dev`, open `/?sandbox&autostart&enemies=charger` (duck) or `enemies=spider` (Spot). Expect: duck hops to you, arms at about 2.5 m, 3 beeps, 15 HP loss inside 4 m; Spot runs, crouches with glowing optics, leaps for 10 HP and backs off.
