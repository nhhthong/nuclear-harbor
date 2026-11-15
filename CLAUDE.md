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
- Latest: **sunset rework, mecha scorpion semi-boss, area streaming** (last section of `docs/DEVIATIONS.md`): one 72 x 86 m quay at sunset, no rain, the sun is the only real light; 1 tower guarded by the mecha scorpion STINGER-7 (`src/scorpion`; it replaced the dinosaur), roster of 18 robots streamed by area (`src/enemies/areaSpawner.ts`, 10 alive at most), half-size boss; upgraded robots, pickups, VFX (camera shake), a cinematic menu and a redesigned HUD with a radar. Verified by `tsc`, 417 unit tests, build and scripted screenshots on the medium preset (no console errors). **Not verified**: a full run, balance, the scorpion fight beyond forced skills, frame rate on a real GPU, whether the owner's black-screen report is fixed (a NaN guard was added before the bloom).
- **All `tests/e2e/*.mjs` are stale** (old coordinates, four towers, grapple): rewrite them before running e2e. `scripts/smoke.mjs` was not run after the reworks either.
- Docs that describe older versions: `docs/PLAN.md` (module table), `docs/PLAYTEST.md`, `docs/PERFORMANCE.md`, tickets and `specs/`.
- Known limits: robots and the scorpion are primitive-built and read as low-poly; no ambient audio; bundle ~5.3 MB (Rapier 82%); in-game Restart reloads the page.
- CC0 asset sites are blocked from the cloud sandbox (polyhaven, ambientcg); everything is procedural except the G36C GLB.
- **Next**: owner playtest on a real GPU (lag, black screen, balance), then follow-ups from it.
