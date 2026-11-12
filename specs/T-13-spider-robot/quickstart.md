# Quickstart: validating the spider

```bash
npm run typecheck && npm test && npm run build
SMOKE_PORT=4313 npm run smoke
SMOKE_PORT=4313 npm run e2e -- T-13
# manual: npm run dev -> http://localhost:5173/?sandbox&autostart&enemies=spider,spider
```

Expected: spider spawns with 150 HP, reaches `flank` then `attack` with the player in range, player HP drops in 12 steps, `applyDamage` destroys it and the registry empties.
