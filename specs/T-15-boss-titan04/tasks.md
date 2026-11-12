---

description: "Task list for TITAN-04 boss fight"
---

# Tasks: TITAN-04 Boss Fight

**Input**: `specs/T-15-boss-titan04/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)

**Tests**: Unit tests first for pure logic (constitution IV); e2e last.

## Phase 1: Setup

- [x] T001 Create boss-local numbers (ability scaling, leg gait, collapse time, sandbox scale, marker sizes, slam safe height) in src/boss/tunables.ts

## Phase 2: Foundational (pure logic, test-first)

- [x] T002 [P] Write failing tests for the combat model (absorb rules, phases, single defeat, 2,000 + 4,000 HP budget) in src/boss/BossModel.test.ts
- [x] T003 [P] Write failing tests for the attack scheduler (cooldowns, interval, range selection, telegraph to impact timeline, ability scaling per destroyed weak point, core-exposed speed-up, arena clamp helper) in src/boss/BossAttacks.test.ts
- [x] T004 Implement BossModel (hitWeakPoint, hitCore, hitArmor, phases, events as data) in src/boss/BossModel.ts
- [x] T005 Implement BossAttacks (scheduler, ability params, danger-area tests, arena clamp) in src/boss/BossAttacks.ts

## Phase 3: User Story 1 - Boss arrives and is dismantled (P1)

**Independent test**: `?sandbox&autostart&boss` phase sequence and defeat via hooks.

- [x] T006 [US1] Build greybox model (sphere, legs, plates, weak-point lights, hatch + core, <= 25 draw calls) in src/boss/BossBody.ts
- [x] T007 [US1] Kinematic body, colliders and per-zone Damageable adapters in src/boss/BossColliders.ts
- [x] T008 [US1] Module glue in src/boss/index.ts: spawn on objectives:allActivated or ?boss / ?bossphase=core, awakening, checkpoint, event emission from model events, weak-point feedback, hatch, collapse + big-explosion, respawn handling, testHooks.boss, dispose

## Phase 4: User Story 2 - Readable, avoidable attacks (P1)

- [x] T009 [US2] Pooled cannon shots, missiles and danger markers in src/boss/BossProjectiles.ts
- [x] T010 [US2] Wire Heavy Cannon, Ground Slam, Missile Barrage (telegraph, impact, damage inside danger area only) into src/boss/index.ts

## Phase 5: User Story 3 - Weak points weaken abilities (P2)

- [x] T011 [US3] Apply ability scaling and core-exposed speed-up, walking/turning/leg stepping and arena clamp in src/boss/index.ts

## Phase 6: Polish

- [x] T012 Write browser check in tests/e2e/T-15-boss-titan04.e2e.mjs
- [x] T013 Run typecheck, unit tests, build, smoke and e2e with a unique port; fix issues
