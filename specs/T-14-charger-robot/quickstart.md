# Quickstart

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-14-charger-robot SPECIFY_FEATURE_NO_PERSIST=1
npm run typecheck && npm test && npm run build
SMOKE_PORT=4614 npm run smoke
SMOKE_PORT=4614 npm run e2e -- T-14
```

Manual: `npm run dev`, open `/?sandbox&autostart&enemies=charger`, stand 15 m from the Charger, dodge sideways,
lure it into the wall, shoot the rear while stunned.
