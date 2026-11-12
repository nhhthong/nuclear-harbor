---

description: "Task list for T-12 Grappling hook"
---

# Tasks: Grappling hook

**Input**: Design documents from `specs/T-12-grappling-hook/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/events.md

**Tests**: Requested by the constitution (principle IV): pure logic is tested first.

## Phase 1: Setup

- [x] T001 Create feature-local tunables (failure cooldown, aim cone angle, lip clearance, cooldown event interval, perch teleport range, max attach delay) in src/grapple/tunables.ts

## Phase 2: Foundational (pure logic, tests first)

- [x] T002 [P] Write failing Vitest tests for every transition and failure/release reason of the state machine in src/grapple/GrappleState.test.ts
- [x] T003 [P] Write failing Vitest tests for the aim-assist cone selection in src/grapple/aim.test.ts
- [x] T004 Implement the pure state machine (ready, pulling, cooldown; reused output; stuck, timeout, arrival, cooldown events at most 10 Hz) in src/grapple/GrappleState.ts
- [x] T005 [P] Implement aim cone math and pull-target helper in src/grapple/aim.ts

## Phase 3: User Story 1 - Pull to a marked surface (P1)

**Independent Test**: sandbox pillar grapple rises above 8 m and auto-releases.

- [x] T006 [US1] Implement hook head, cable and crosshair indicator with ResourceTracker disposal in src/grapple/visuals.ts
- [x] T007 [US1] Implement module wiring: fire latch from update, raycast targeting, externalVelocity drive, events, test hook in src/grapple/index.ts

## Phase 4: User Story 2 - Failure feedback (P1)

- [x] T008 [US2] Verify `no-target`, `not-grappleable` and `cooldown` failures end to end (covered by the e2e file in T012)

## Phase 5: User Story 3 - Release and safety (P2)

- [x] T009 [US3] Handle player:died, game:respawn, game:stateChanged and dispose so externalVelocity is always cleared, in src/grapple/index.ts

## Phase 6: User Story 4 - Perches and roofs (P2)

- [x] T010 [US4] Implement perch landing placement and lip-clearance aim plus release momentum impulse in src/grapple/index.ts

## Phase 7: Polish

- [x] T011 Add aim assist to targeting in src/grapple/index.ts
- [x] T012 Write browser check (pillar, ground failure, cooldown, perch, container roof, manual release) in tests/e2e/T-12-grappling-hook.e2e.mjs
- [x] T013 Run typecheck, tests, build, smoke and e2e with a unique SMOKE_PORT

## Dependencies

T001 -> T002..T005 -> T006/T007 -> T009/T010/T011 -> T012 -> T013. T002 and T003 run before T004 and T005.

## Implementation strategy

MVP is US1 plus US2 (T001-T008); then safety, perches and polish.
