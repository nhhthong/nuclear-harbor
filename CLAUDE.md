# Last Stand: Nuclear Harbor: start here

Browser FPS (Three.js + TypeScript + Vite + Rapier), single player, offline. Design intent: `docs/GDD.md`; **what is actually built and where it deviates: `docs/DEVIATIONS.md` (read it with the GDD)**.

## Read first (in this order)
1. `docs/DEVIATIONS.md`, then the GDD sections you need.
2. `docs/PLAN.md`: architecture, module boundaries, events, conventions, definition of done.
3. `docs/tickets/README.md`: ticket list and status; `docs/tickets/ROBOT-REFRESH.md` for the latest robot work.
4. `.specify/memory/constitution.md` and `docs/SPECKIT.md`: working rules and Spec Kit policy.
5. `docs/PLAYTEST.md` (findings, open issues), `docs/PERFORMANCE.md`, `docs/OFFLINE.md`, `docs/ASSETS.md`.

## Commands
```bash
npm install
npm run dev               # http://localhost:5173/  (?sandbox test scene, ?autostart skips the menu, ?debug overlay, ?boss, ?viewmodel=procedural; ?enemies=army,spot,duck|none in the sandbox)
npx tsc --noEmit && npm test && npm run build
npm run smoke / npm run e2e -- T-XX    # browser checks, see policy below
```

## Rules for agents (owner decisions)
- Branches: develop on `claude/wizardly-cori-697x6r`; `main` is the release line (merge through a PR). Never push other branches without asking. Sub-agents work in their own git worktree, do not push; the coordinator merges.
- **Spec Kit is required for feature tickets** (`docs/SPECKIT.md`). **Sonnet 5.5 writes both the Spec Kit files and the code**; no Haiku for Spec Kit. Cleanup/rename tickets are exempt.
- **Tests: do not run smoke/e2e unless the owner asks** (4 CPUs + software GL = slow and flaky). Always run `npx tsc --noEmit`, owned unit tests, and `npm run build` when needed. Never claim something is verified that was not run; write "skipped per owner".
- Token discipline: read only what the task needs, pass file paths instead of pasting files, at most two agents at once.
- Never commit `node_modules` (a committed symlink once broke the checkout). Raw third-party archives stay out of git (`tools/asset-pipeline/input/`).
- Everything is procedural (no CDN, no network at runtime) except the G36C GLB; `docs/reference-models/*.html` are visual references only.

## Status (update this block when it changes)
- Latest: **tiny night quay rework** (last section of `docs/DEVIATIONS.md`): one 72 x 86 m level, 1 tower, 8 robots, half-size boss, no dinosaur; night rain look with modelled containers, wet-ground shader + planar reflection, flood lights with shadows and beams, rain, bloom/AO/grade. Verified by `tsc`, 397 unit tests, build and manual screenshots on all three quality presets (no console errors). **Not verified**: a full run, enemy behaviour and balance on the new level, frame rate on a real GPU, the boss fight at half size beyond spawning it.
- **All `tests/e2e/*.mjs` are stale** (old coordinates, four towers, grapple, dinosaur): rewrite them before running e2e. `scripts/smoke.mjs` was not run after the rework either.
- Docs that describe older versions: `docs/PLAN.md` (module table), `docs/PLAYTEST.md`, `docs/PERFORMANCE.md`, tickets and `specs/`.
- Known limits: robots and the tower are visually simpler than the environment; no rain/thunder audio; heavy shaders target a desktop GPU (low preset for integrated graphics); bundle ~5.3 MB (Rapier 82%); in-game Restart reloads the page.
- CC0 asset sites are blocked from the cloud sandbox (polyhaven, ambientcg); everything is procedural except the G36C GLB.
- **Next**: owner playtest on a real GPU, then UI improvements (scope to be defined by the owner).
