# Tasks: Optimisation, Offline Packaging and Backlog (T-17)

**Input**: spec.md, plan.md, research.md, data-model.md, quickstart.md

## Phase 1: Setup and measurement

- [x] T001 Baseline: build, record bundle sizes, smoke draw calls per state, and "before" screenshots (menu, harbor, warehouse, boss arena) into docs/playtest/ via a scratch Playwright script
- [x] T002 Investigate menu draw calls (renderer.info per pass / scene objects visible behind menu) and record cause in docs/PERFORMANCE.md

## Phase 2: Foundational (pure logic, tests first)

- [x] T003 [P] Write unit tests for quality presets and fps-cap helper in src/core/quality.test.ts
- [x] T004 Implement pure presets and fps-cap accumulator in src/core/quality.ts
- [x] T005 [P] Write unit test for precache manifest builder in src/offline/manifest.test.ts and implement src/offline/manifest.ts

## Phase 3: US1 Performance budget (P1)

- [x] T006 [US1] Fix menu draw-call overhead (backlog 1) in the module found in T002; add smoke assertion per state in scripts/smoke.mjs
- [x] T007 [US1] Static-once sun shadow with local dynamic refresh (backlog 3) in src/world/lighting.ts, src/core/Renderer.ts; unit/browser evidence (DONE: single sun light, scheduler-based refresh instead of a second frustum, reason in docs/PERFORMANCE.md)
- [x] T008 [US1] LOD/culling review for robots, cranes, ship (ticket step 4) and AI cost review (step 5); fix or document in docs/PERFORMANCE.md (DONE with notes: LOD and culling already present; boss-leg LOD and allocation profiling NOT done, recorded in docs/PERFORMANCE.md sections 4 and 5)
- [x] T009 [US1] Write scripts/bench.mjs and scripts/leakcheck.mjs (JSON output), npm scripts; in-place restart only if needed (DONE: restart is exercised in place through window.__NH__.restart; the player Restart button still reloads)

## Phase 4: US2 Settings applied (P1)

- [x] T010 [US2] Apply quality, fps cap and volume from ctx.settings (backlog 2) in src/core/Game.ts, GameLoop.ts, Renderer.ts, src/audio; persist through Settings; browser check in tests/e2e/T-17-optimization-offline.e2e.mjs

## Phase 5: US3 Offline (P2)

- [x] T011 [US3] Hand-written public/sw.js, public/manifest.webmanifest, procedural icons, vite precache plugin, src/offline/register.ts, call from src/main.ts (backlog 4)
- [x] T012 [US3] scripts/offline.mjs and e2e: load, go offline, reload, reach playing, no failed requests, no cross-origin requests
- [x] T013 [US3] docs/OFFLINE.md and README install/preload section

## Phase 6: US4 Playtest fixes (P2)

- [x] T014 [US4] Rebalance defend waves via tunables (backlog 6a), scripted run with numbers recorded in docs/PLAYTEST.md
- [x] T015 [US4] Warehouse interior lighting, no new shadow casters (6b) in src/world

## Phase 7: US5 Credits and hygiene (P3)

- [x] T016 [US5] Credits entry and screen in src/ui/screens.ts (+ data test) (backlog 5)
- [x] T017 [P] [US5] UI request() must not force playing when flow refuses (6c) in src/ui/screens.ts
- [x] T018 [P] [US5] Boss checkpoint payload copies the player vector (6d) in src/boss/index.ts
- [x] T019 [P] [US5] Remove or mark unused T-05 tunables (6e) in src/enemies/tunables.ts

## Phase 8: US6 Bundle and evidence (P3)

- [x] T020 [US6] Vendor chunking and minify settings in vite.config.ts; report before/after (backlog 7)
- [x] T021 [US6] "After" screenshots, inspect all, describe honestly in docs/PLAYTEST.md (backlog 8)

## Phase 9: Polish

- [x] T022 docs/PERFORMANCE.md with scene x preset numbers, streaming decision, pending real-device note and ?bench instructions
- [x] T023 Final gate: typecheck, test, build, smoke, every e2e file separately; commit (DONE: typecheck, 451 unit tests, build, smoke, 21 e2e files each run separately all green; T-06 e2e updated for T-17 request() change)
