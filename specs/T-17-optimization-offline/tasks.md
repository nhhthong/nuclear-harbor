# Tasks: Optimisation, Offline Packaging and Backlog (T-17)

**Input**: spec.md, plan.md, research.md, data-model.md, quickstart.md

## Phase 1: Setup and measurement

- [ ] T001 Baseline: build, record bundle sizes, smoke draw calls per state, and "before" screenshots (menu, harbor, warehouse, boss arena) into docs/playtest/ via a scratch Playwright script
- [ ] T002 Investigate menu draw calls (renderer.info per pass / scene objects visible behind menu) and record cause in docs/PERFORMANCE.md

## Phase 2: Foundational (pure logic, tests first)

- [ ] T003 [P] Write unit tests for quality presets and fps-cap helper in src/core/quality.test.ts
- [ ] T004 Implement pure presets and fps-cap accumulator in src/core/quality.ts
- [ ] T005 [P] Write unit test for precache manifest builder in src/offline/manifest.test.ts and implement src/offline/manifest.ts

## Phase 3: US1 Performance budget (P1)

- [ ] T006 [US1] Fix menu draw-call overhead (backlog 1) in the module found in T002; add smoke assertion per state in scripts/smoke.mjs
- [ ] T007 [US1] Static-once sun shadow with local dynamic refresh (backlog 3) in src/world/lighting.ts, src/core/Renderer.ts; unit/browser evidence
- [ ] T008 [US1] LOD/culling review for robots, cranes, ship (ticket step 4) and AI cost review (step 5); fix or document in docs/PERFORMANCE.md
- [ ] T009 [US1] Write scripts/bench.mjs and scripts/leakcheck.mjs (JSON output), npm scripts; in-place restart only if needed

## Phase 4: US2 Settings applied (P1)

- [ ] T010 [US2] Apply quality, fps cap and volume from ctx.settings (backlog 2) in src/core/Game.ts, GameLoop.ts, Renderer.ts, src/audio; persist through Settings; browser check in tests/e2e/T-17-optimization-offline.e2e.mjs

## Phase 5: US3 Offline (P2)

- [ ] T011 [US3] Hand-written public/sw.js, public/manifest.webmanifest, procedural icons, vite precache plugin, src/offline/register.ts, call from src/main.ts (backlog 4)
- [ ] T012 [US3] scripts/offline.mjs and e2e: load, go offline, reload, reach playing, no failed requests, no cross-origin requests
- [ ] T013 [US3] docs/OFFLINE.md and README install/preload section

## Phase 6: US4 Playtest fixes (P2)

- [ ] T014 [US4] Rebalance defend waves via tunables (backlog 6a), scripted run with numbers recorded in docs/PLAYTEST.md
- [ ] T015 [US4] Warehouse interior lighting, no new shadow casters (6b) in src/world

## Phase 7: US5 Credits and hygiene (P3)

- [ ] T016 [US5] Credits entry and screen in src/ui/screens.ts (+ data test) (backlog 5)
- [ ] T017 [P] [US5] UI request() must not force playing when flow refuses (6c) in src/ui/screens.ts
- [ ] T018 [P] [US5] Boss checkpoint payload copies the player vector (6d) in src/boss/index.ts
- [ ] T019 [P] [US5] Remove or mark unused T-05 tunables (6e) in src/enemies/tunables.ts

## Phase 8: US6 Bundle and evidence (P3)

- [ ] T020 [US6] Vendor chunking and minify settings in vite.config.ts; report before/after (backlog 7)
- [ ] T021 [US6] "After" screenshots, inspect all, describe honestly in docs/PLAYTEST.md (backlog 8)

## Phase 9: Polish

- [ ] T022 docs/PERFORMANCE.md with scene x preset numbers, streaming decision, pending real-device note and ?bench instructions
- [ ] T023 Final gate: typecheck, test, build, smoke, every e2e file separately; commit
