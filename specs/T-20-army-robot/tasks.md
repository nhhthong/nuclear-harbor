---

description: "Task list for T-20 Vanguard army mech"
---

# Tasks: Vanguard Army Mech (T-20)

**Input**: `/specs/T-20-army-robot/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)
**Tests**: pure logic is test-first (constitution IV); browser checks in `tests/e2e/`.

## Phase 1: Setup

- [x] T001 Add `ARMY_ROBOT` block (replacing `SPHERE_ROBOT`, same GDD base plus new fields) in src/config/tunables.ts and `ARMY_LOCAL` in src/enemies/army/tunables.ts
- [x] T002 Update tests importing `SPHERE_ROBOT` (src/combat/damage.test.ts, src/pickups/placements.test.ts) to `ARMY_ROBOT`

## Phase 2: Foundational (pure logic, tests first)

- [x] T003 [P] Write src/enemies/army/motion.test.ts then src/enemies/army/motion.ts (accel/decel, turn-rate limit, heading-error slowdown)
- [x] T004 [P] Write src/enemies/army/salvo.test.ts then src/enemies/army/salvo.ts (telegraph -> 2-3 shots -> cooldown, glow level)
- [x] T005 [P] Write src/enemies/army/splash.test.ts then src/enemies/army/splash.ts (linear falloff, 0 outside radius)
- [x] T006 [P] Write src/enemies/army/armyBrain.test.ts then src/enemies/army/armyBrain.ts (patrol/advance/engage/retreat/destroyed transitions with hysteresis)
- [x] T007 Add rocket kind to src/enemies/EnemyProjectiles.ts (`fireRocket`, separate pool, splash on contact) with tests in src/enemies/EnemyProjectiles.test.ts

## Phase 3: User Story 1 - Recognisable mech, draw calls (P1)

- [x] T008 [US1] Port the reference to src/enemies/army/model.ts: shared canvas textures, chamfered-box helper, parts merged per material (armor, gunmetal, dark, chrome, decal, glow), near/far LOD builders
- [x] T009 [US1] ArmyRobot.ts visual setup: LOD, shared assets via SharedAssets, hit volumes (body, head critical), shadows, dispose
- [x] T010 [US1] Screenshot near/far in the sandbox and compare with the reference page; record draw calls (done once before the owner stop: near +6, far +1 calls; screenshots looked right; no side-by-side with the reference page: skipped per owner)

## Phase 4: User Story 2 - Patrol and disciplined movement (P1)

- [x] T011 [US2] ArmyRobot.ts think/step: perception -> brain -> goals (band ring, strafe, retreat), integrated smooth speed and yaw, patrol idle scan, footfall dust and bob
- [x] T012 [US2] src/enemies/army/index.ts factory, factories.ts `sphere` entry, delete src/enemies/SphereRobot.ts and sphereBrain*.ts

## Phase 5: User Story 3 - Rocket salvos (P1)

- [x] T013 [US3] ArmyRobot.ts salvo driving (telegraph glow, rockets from the missile cells, `enemy:attacked`), rocket explosion VFX

## Phase 6: User Story 4 - Contracts (P2)

- [x] T014 [US4] Update src/enemies/EnemyManager.test.ts to the army mech (hp, hit volumes, speeds, firing, LOD scheduler, defend order, respawn)
- [x] T015 [US4] Update tests/e2e/T-05-enemy-framework-sphere.e2e.mjs, add tests/e2e/T-20-army-robot.e2e.mjs (detect, band, rocket, cooldown, splash, retreat); T-05, T-13, T-14, T-16-vertical-slice, T-20 passed before the owner stop

## Phase 7: Polish

- [x] T016 Remove only sphere-specific keys no other robot uses from src/enemies/tunables.ts (line-local, `ENEMY_LOCAL`), run typecheck and unit tests (done, green); build, smoke and the remaining e2e files skipped per owner (CPU overload; T-16 full-run and game-flow timed out under load)
- [x] T017 Write analyze.md, commit

## Dependencies

T001-T002 -> T003-T007 (parallel) -> T008-T009 -> T011-T013 -> T014-T015 -> T016-T017. MVP = US1 + US2 + US3.
