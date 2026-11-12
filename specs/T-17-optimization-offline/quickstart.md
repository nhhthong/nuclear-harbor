# Quickstart / validation (T-17)

```bash
npm run typecheck && npm test && npm run build
SMOKE_PORT=4xxx npm run smoke          # prints draw calls per state
SMOKE_PORT=4xxx npm run e2e -- T-17    # offline boot, settings, credits
npm run bench; npm run leakcheck       # JSON output
```

Owner, real devices: open `?bench` (see docs/PERFORMANCE.md) on a low-end and a mid machine and paste the JSON.
