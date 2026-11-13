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
npm run dev               # http://localhost:5173/  (?sandbox test scene, ?autostart skips the menu, ?debug overlay, ?seed=N, ?enemies=army,spot,duck|none)
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
- Tickets T-01..T-18 done and green (unit, build, smoke, all e2e) before the robot refresh. T-19..T-23 (new robots, dinosaur, final boss, cleanup) are merged with typecheck + unit tests (466) + build only: **no e2e, no smoke, no visual check after those merges**.
- Known unverified: full run (4 towers -> boss -> victory) after the refresh (T-16 e2e timed out under CPU load); dinosaur fight (hits/damage never completed in e2e); draw-call total with the new robots; side-by-side look versus the reference models; Bomber Duck beep audio; real-device benchmarks (`docs/PERFORMANCE.md` has the empty table); nobody has played it.
- Known limits: bundle ~5.3 MB (Rapier 82%); shadow refresh rate is lower than frame rate; no boss-leg LOD; in-game Restart reloads the page; optional boss attacks not built.
- **Next: UI improvements** (scope to be defined by the owner; make it a ticket from `docs/tickets/_TEMPLATE.md` with Spec Kit).
