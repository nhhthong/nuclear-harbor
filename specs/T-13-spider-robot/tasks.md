# Tasks: Spider Robot

**Input**: `/specs/T-13-spider-robot/` (plan.md, spec.md, research.md, data-model.md, contracts/)
**Tests**: requested (constitution IV): pure logic tests first.

## Phase 1: Setup

- [x] T001 Create `src/enemies/spider/tunables.ts` with `SPIDER_LOCAL` (patrol speed factor, flank timeout, strafe, hop duration/apex, stride threshold, leg lengths, dome size)

## Phase 2: Foundational (pure logic, tests first)

- [x] T002 [P] Write failing tests in `src/enemies/spider/spiderBrain.test.ts` for `decideSpider` (all transitions) and `computeFlankPoint` (side, distance, walkable snap)
- [x] T003 [P] Write failing tests in `src/enemies/spider/hop.test.ts` for `canHop` (ray heights, landing) and `hopPosition` (parabola endpoints/apex)
- [x] T004 [P] Write failing tests in `src/enemies/spider/legs.test.ts` for gait (alternating tripods, rest when idle, no allocation)
- [x] T005 Implement `src/enemies/spider/spiderBrain.ts` until T002 passes
- [x] T006 [P] Implement `src/enemies/spider/hop.ts` until T003 passes
- [x] T007 [P] Implement `src/enemies/spider/legs.ts` until T004 passes

## Phase 3: User Story 1 - Flanking attacker (P1)

- [x] T008 [US1] Implement `src/enemies/spider/SpiderRobot.ts`: states, alert, flank side alternation, chase, attack with strafe and bolt firing, patrol
- [x] T009 [US1] Replace `src/enemies/spider/index.ts` factory to build `SpiderRobot`

## Phase 4: User Story 2 - Terrain-aware movement (P2)

- [x] T010 [US2] Add hop probing and execution (state `hop`, never off-land) in `SpiderRobot.ts`

## Phase 5: User Story 3 - Legs and animation cost (P3)

- [x] T011 [US3] Add shared-geometry body, dome and six two-segment legs; sim-level gating in `animate` in `SpiderRobot.ts`

## Phase 6: User Story 4 - Destructible (P2)

- [x] T012 [US4] Add body (`body`) and dome (`critical`) hit volumes and cleanup in `SpiderRobot.ts`

## Phase 7: Polish

- [x] T013 Write `tests/e2e/T-13-spider-robot.e2e.mjs` (spawn, flank then attack, damage, destroy)
- [x] T014 Run `npm run typecheck && npm test && npm run build`, smoke and e2e with unique port; fix issues

## Dependencies

T001 -> T002..T004 -> T005..T007 -> T008..T012 -> T013 -> T014.
