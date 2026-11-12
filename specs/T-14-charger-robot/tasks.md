# Tasks: Charger robot (shielded rhino)

**Input**: `specs/T-14-charger-robot/` (plan.md, spec.md, research.md, data-model.md)

Format: `- [ ] ID [P] [Story] description with file path`. Tests first for pure logic.

## Phase 1: Setup

- [x] T001 Create `src/enemies/charger/tunables.ts` with feature-local numbers (turn rates, safety margin, light ramp, strip size, contact radii, probe steps)

## Phase 2: Foundational (pure logic, tests first)

- [x] T002 [P] Write failing tests `src/enemies/charger/chargePlan.test.ts` (planCharge min of range/obstacle/edge-margin, canStartCharge 8-25 m + LOS + cooldown, zoneForHit front/flank/rear/stunned)
- [x] T003 [P] Write failing tests `src/enemies/charger/chargerBrain.test.ts` (patrol->detect->windup->charge->stunned/recover->detect, timers, destroyed)
- [x] T004 Implement `src/enemies/charger/chargePlan.ts` until T002 passes
- [x] T005 Implement `src/enemies/charger/chargerBrain.ts` until T003 passes

## Phase 3: User Story 1 - Dodge a telegraphed charge (P1)

**Independent test**: windup 1 s then locked charge at 10-12 m/s, contact deals 20 once.

- [x] T006 [US1] Implement `src/enemies/charger/Charger.ts`: BaseEnemy subclass, patrol/detect, windup (tracking, lights, `charger:windup`, strip), charge (locked dir, probes), contact damage and knockback, `forceHighRate`, deferred `commandMoveTo`
- [x] T007 [US1] Replace `src/enemies/charger/index.ts` with the `createChargerRobot` factory
- [x] T008 [US1] Headless tests in `src/enemies/charger/Charger.test.ts` (windup duration, direction lock, speed range, contact once, forceHighRate)

## Phase 4: User Story 2 - Wall stun and weak back (P1)

- [x] T009 [US2] In `Charger.ts`: wall hit -> `stunned` 2.5 s + `charger:stunned` + `vfx:spawn`, rear vent brighter, `applyDamage` zone override (armor 0.1 / critical 2)
- [x] T010 [US2] Add wall-stun and damage-zone tests to `Charger.test.ts`

## Phase 5: User Story 3 - Edge safety (P2)

- [x] T011 [US3] In `Charger.ts`: edge probes (downward ray + `isOnLand`), stop before edge into `recover`
- [x] T012 [US3] Add edge-stop test to `Charger.test.ts`

## Phase 6: Polish

- [x] T013 [P] Write `tests/e2e/T-14-charger-robot.e2e.mjs`
- [x] T014 Run `npm run typecheck && npm test && npm run build`, smoke and e2e with unique SMOKE_PORT; commit
