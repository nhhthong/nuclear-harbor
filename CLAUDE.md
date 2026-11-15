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
- Everything is procedural (no CDN, no network at runtime) except the G36C GLB; `docs/reference-models/*.html` are visual references only.
- AI agents: sub-agents should use their own git worktree and not push; one coordinator merges.

## Status (update this block when it changes)
- Latest: **sunset rework, mecha scorpion semi-boss, area streaming** (last section of `docs/DEVIATIONS.md`): one 72 x 122 m quay at sunset (zones about 1.4 times as deep as the first version, port-like irregular container yard; the spawn area is empty of robots; five safe containers heal the player; higher jumps, gravity `PLAYER.gravity` -22; hold right mouse to aim down sights, `R` reloads, Settings toggle for auto reload), no rain, the sun is the only real light; 1 tower guarded by the mecha scorpion STINGER-7 (`src/scorpion`; it replaced the dinosaur), roster of 21 robots (18 regular + 3 cyber samurai elites, `src/enemies/samurai`) streamed by area (`src/enemies/areaSpawner.ts`, 10 alive at most), half-size boss; upgraded robots, pickups, VFX (camera shake), a cinematic menu and a redesigned HUD with a radar; every robot walks with stepping legs paced by distance (`src/enemies/gait.ts`). Verified by `tsc`, 450 unit tests, build and scripted screenshots on the medium preset (no console errors). **Not verified**: a full run, balance, the scorpion fight beyond forced skills, frame rate on a real GPU, whether the reported black screen is fixed (a NaN guard was added before the bloom).
- **All `tests/e2e/*.mjs` are stale** (old coordinates, four towers, grapple): rewrite them before running e2e. `scripts/smoke.mjs` was not run after the reworks either.
- Docs: `docs/PLAN.md` starts with an authoritative "Current state" (its sections 1 to 9 are the original plan, stale). `docs/PLAYTEST.md`, `docs/PERFORMANCE.md`, `docs/tickets/` and `specs/` are historical and carry banners (`specs/README.md` maps each ticket to its fate). Reworks after T-22 had no Spec Kit.
- Known limits: robots and the scorpion are primitive-built and read as low-poly; no ambient audio; bundle ~5.3 MB (Rapier 82%); in-game Restart reloads the page.
- CC0 asset sites are blocked from the cloud sandbox (polyhaven, ambientcg); everything is procedural except the G36C GLB.
- CI: `.github/workflows/pages.yml` (typecheck + unit tests + build on every push and PR; deploy to GitHub Pages on `main`). No smoke or e2e in CI.
- **Next**: playtest on a real GPU (lag, black screen, balance), then follow-ups from it.
