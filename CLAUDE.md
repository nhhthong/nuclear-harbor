# Last Stand: Nuclear Harbor: start here

Browser FPS (Three.js + TypeScript + Vite + Rapier), single player, offline. Design intent: `docs/GDD.md`; **what is actually built and where it deviates: `docs/DEVIATIONS.md` (read it with the GDD)**.

## Read first (in this order)
1. `docs/DEVIATIONS.md`, then the GDD sections you need.
2. `docs/PLAN.md`: architecture, module boundaries, events, conventions, definition of done.
3. `docs/tickets/README.md`: historical ticket list and what replaced each (`specs/README.md` too).
4. `.specify/memory/constitution.md` and `docs/SPECKIT.md`: working rules and Spec Kit policy.
5. `docs/PLAYTEST.md` (findings, open issues), `docs/PERFORMANCE.md`, `docs/OFFLINE.md`, `docs/ASSETS.md`.

## Commands
```bash
npm install
npm run dev               # http://localhost:5173/  (?sandbox test scene, ?autostart skips the menu, ?debug overlay, ?boss, ?viewmodel=procedural; ?enemies=army,spot,duck|none in the sandbox)
npx tsc --noEmit && npm test && npm run build
npm run smoke / npm run e2e -- T-XX    # optional browser checks (e2e scripts are stale)
```

## Rules (for contributors and AI agents)
- Branches: `main` is the release line (CI deploys it to GitHub Pages). Work on a feature branch and merge through a pull request. Do not push to `main` directly.
- **Spec Kit** is the default for new features, not for small fixes or tuning (`docs/SPECKIT.md`). Existing `specs/` are historical.
- **Verify with** `npx tsc --noEmit && npm test && npm run build`. Smoke/e2e are optional (slow without a GPU) and the e2e scripts are stale. Never claim something is verified that was not run; write "skipped" instead.
- Read only what the task needs; pass file paths instead of pasting files.
- Never commit `node_modules`. Raw third-party archives stay out of git (`tools/asset-pipeline/input/`).
- Everything is procedural (no CDN, no network at runtime) except the G36C GLB and the free CC0/CC-BY prop GLBs (`docs/ASSETS.md`); `docs/reference-models/*.html` are visual references only.
- AI agents: sub-agents should use their own git worktree and not push; one coordinator merges.

## Status (update this block when it changes)
- Latest: **new robots and crab boss** (PR #15; specs `26-enemy-models-and-biped`, `27-crab-boss`, last sections of `docs/DEVIATIONS.md`): roster of 22 (5 Medium Mech Strikers with bursts and AOE rockets, 6 Spot dogs, 4 Bipeds that leap and claw, 4 Bomber Ducks, 3 cyber samurai; 10 alive at most) from authored CC-BY GLBs with procedural fallbacks; final boss is the Gunslinger Crab Mech (5800 HP, no weak points, skills: bombs, dragonfly drones, 360 spin, four-way laser; `src/boss`). Ammo budget test: 348 hits (roster 116 + boss 232) vs supply 540. Then: STINGER-7 now uses the authored Sketchfab "Scorpion Robot" (spec `28-scorpion-model`, `src/scorpion/scorpionAssets.ts`; 4 legs, no claws; procedural fallback kept). Earlier: cold overcast mood, world dressing, ADS (specs 24, 25), one 72 x 122 m quay, scorpion STINGER-7. Verified by `tsc`, 513 unit tests, build, CI and scripted screenshots on the low preset. **Not verified**: a full run, balance (Striker about 9 dmg/s on a still player), frame rate on a real GPU, smoke/e2e, a pale orange wash on the crab while skills telegraph.
- **All `tests/e2e/*.mjs` are stale** (old coordinates, four towers, grapple): rewrite them before running e2e. `scripts/smoke.mjs` was not run after the reworks either.
- Docs: `docs/PLAN.md` starts with an authoritative "Current state" (its sections 1 to 9 are the original plan, stale). `docs/PLAYTEST.md`, `docs/PERFORMANCE.md`, `docs/tickets/` and `specs/` are historical and carry banners (`specs/README.md` maps each ticket to its fate). Reworks after T-22 had no Spec Kit.
- Known limits: robots are primitive-built and read as low-poly; no ambient audio; bundle ~5.3 MB (Rapier 82%); in-game Restart reloads the page.
- Free-model sites are reachable from the cloud sandbox only if allowed in the environment's network settings; raw downloads stay out of git, only the built GLBs ship.
- CI: `.github/workflows/pages.yml` (typecheck + unit tests + build on every push and PR; deploy to GitHub Pages on `main`). No smoke or e2e in CI.
- **Next**: playtest on a real GPU (lag, black screen, balance), then follow-ups from it.
