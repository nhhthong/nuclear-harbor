# Quickstart: validating the grappling hook

```bash
export SMOKE_PORT=4312
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-12
# manual: npm run dev -> http://localhost:5173/?sandbox&autostart
```

Manual checks in `?sandbox`: aim at the yellow pillar and press Space (rise above 8 m, auto release); aim at the ground (`grapple:failed`); press again within 1 s (`cooldown`); grapple the perch anchor (stand on platform, y about 8); grapple the stacked container top (end on roof).
