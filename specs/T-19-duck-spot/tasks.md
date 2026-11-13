---
description: "Task list for T-19 Bomber Duck + Spot dog"
---

# Tasks: Bomber Duck + Spot dog (T-19)

**Input**: `specs/T-19-duck-spot/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)
**Tests**: required (constitution IV): pure logic unit tests written with the code; e2e per robot.

## Phase 1: Setup

- [x] T001 Delete `src/enemies/charger/` and `src/enemies/spider/` (code, tunables, tests) and point the `charger` and `spider` lines of `src/enemies/factories.ts` at the new factories
- [x] T002 [P] Create `src/enemies/duck/modelKit.ts` (paint, merge helpers: non-indexed, no uv, vertex colours, `mergeGeometries`)

## Phase 2: Foundational (pure logic, test first)

- [x] T003 [P] `src/enemies/duck/tunables.ts` and `src/enemies/spot/tunables.ts` (all new numbers)
- [x] T004 [P] `src/enemies/duck/hop.ts` + `hop.test.ts` (parabola, grounded fraction, speed factor; average speed between walk 5 and sprint 7.5)
- [x] T005 [P] `src/enemies/duck/blast.ts` + `blast.test.ts` (fixed 15 inside radius, 0 outside, boundary inclusive; countdown count from elapsed time)
- [x] T006 [P] `src/enemies/duck/duckBrain.ts` + `duckBrain.test.ts` (patrol/hop/arming transitions)
- [x] T007 [P] `src/enemies/spot/spotBrain.ts` + `spotBrain.test.ts` (patrol/chase/telegraph/lunge/retreat, cooldown 2.5 s, lunge contact test)
- [x] T008 `src/enemies/duck/events.ts` (declaration merging: `duck:beep`, `duck:explode`)

## Phase 3: User Story 1 - Bomber Duck (P1)

**Independent test**: duck in sandbox hops, arms at about 2.5 m, counts 3-2-1, 15 HP in radius.

- [x] T009 [US1] `src/enemies/duck/model.ts` (purple shell, yellow beak/soles, grey faceplate, cyan eye ring, black servos; body, beak, beacon, feet; LOD far mesh)
- [x] T010 [US1] `src/enemies/duck/Duck.ts` (BaseEnemy subclass: patrol, hop, arming with beacon/ring/beeps, blast, harmless pop, commands, sim levels, animate) and `index.ts`
- [x] T011 [US1] `src/enemies/duck/Duck.test.ts` (headless: fuse 3 s, 15 damage inside, none outside, killed early no damage, events emitted once)

## Phase 4: User Story 2 - Spot dog (P1)

**Independent test**: Spot in sandbox chases, telegraphs, lunges for 10 HP with knockback, cooldown >= 2.5 s.

- [x] T012 [US2] `src/enemies/spot/model.ts` (yellow chassis, nose visor, rifle prop, wheel-foot legs as two diagonal pairs, emissive optics; LOD far mesh)
- [x] T013 [US2] `src/enemies/spot/Spot.ts` (BaseEnemy subclass: patrol, chase, telegraph, lunge, retreat/circle, crit nose, commands, sim levels, trot animation) and `index.ts`
- [x] T014 [US2] `src/enemies/spot/Spot.test.ts` (headless: damage 10 and impulse once per lunge, cooldown, crit x2, HP)

## Phase 5: User Story 3 - Models and budget (P2)

- [x] T015 [US3] Measure draw calls near/far for both robots and take screenshots. Done once before the owner stop: near 4 (duck, +1 ring while armed), 4 (Spot), far 1 each; screenshots viewed; side-by-side comparison with the reference pages skipped per owner

## Phase 6: Integration, tests, docs

- [x] T016 Update `src/enemies/EnemyManager.test.ts` expectations (module HP) and rewrite `tests/e2e/T-13-spider-robot.e2e.mjs` (Spot) and `tests/e2e/T-14-charger-robot.e2e.mjs` (Duck); fix `tests/e2e/T-16-vertical-slice.e2e.mjs` charger step
- [x] T017 Write `specs/T-19-duck-spot/foundation-requests.md` (audio beep route, stale `CHARGER_ROBOT`/`SPIDER_ROBOT` blocks and ammo budget, vfx scale for charger destroy)

## Phase 7: Verify

- [x] T018 typecheck, unit tests and build passed; smoke passed once; later smoke/e2e reruns skipped per owner
- [x] T019 e2e: T-05, T-13, T-14 passed; T-16 files failed once under CPU overload (restart navigation timeout) and were not rerun, other e2e files not run: skipped per owner
- [x] T020 Commit (with attribution trailers), `ls specs/T-19-duck-spot` check

## Dependencies

T001 -> T009..T014 (factories point at new classes). T003-T008 before T009-T014. T009-T011 and T012-T014 are independent of each other. T015 after both models. T016-T017 after T010 and T013. Verify last.
