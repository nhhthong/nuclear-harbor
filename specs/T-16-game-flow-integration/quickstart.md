# Quickstart: validating T-16

```bash
export SMOKE_PORT=4xxx
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-16          # slice, full run, browser check
npm run e2e                  # all tickets
```

Manual: `npm run dev`, open `/?autostart`, play; or `/?sandbox&autostart&enemies=sphere,charger&countdown=600` for the slice.
Expected: death shows Game Over with respawn at the last tower; `countdown=3` shows failure without respawn; defeating TITAN-04 shows Victory ~3 s later.
