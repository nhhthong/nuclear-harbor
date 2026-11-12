# Tasks: Game flow, level population and vertical slice

**Input**: specs/T-16-game-flow-integration (spec, plan, research, data-model). Tests first for pure logic.

## Phase 1: Setup

- [X] T001 Link `node_modules` from the main checkout (untracked) and delete scratch files; add `src/flow/tunables.ts` (victory delay 3 s, storage key `nuclear-harbor.best.v1`)

## Phase 2: Foundational (pure flow logic, tests first)

- [X] T002 Write failing unit tests in `src/flow/FlowState.test.ts`: death -> died/player-died; expiry -> expired; boss defeat -> won; events ignored after the run ended (expired, won); respawn only after death; checkpoint default = spawn and latest wins; stats; best-result merge
- [X] T003 Implement `src/flow/FlowState.ts` (pure) until T002 is green

## Phase 3: User Story 1 - complete run (P1)

- [X] T004 [US1] Implement `createFlowModule` in `src/flow/index.ts`: event wiring, 3 s victory delay on fixed-step time, `game:victory`, LocalStorage best result (try/catch), restart via reload keeping the query string
- [X] T005 [US1] Expose `ctx.testHooks.flow = { getCheckpoint, respawn, stats, getStatus, getBest }` and clean up on `dispose()`

## Phase 4: User Story 2 - death and respawn (P1)

- [X] T006 [US2] Implement death -> `gameOver` and `game:requestRespawn` -> `player.revive(checkpoint)`, `game:respawn`, state `playing`; store cloned checkpoint payloads

## Phase 5: User Story 3 - countdown failure (P1)

- [X] T007 [US3] Implement `countdown:expired` -> `game:over {countdown-expired}`; refuse respawn requests

## Phase 6: User Story 4 - population and pickups (P2)

- [X] T008 [US4] Extend `src/enemies/population.test.ts` first: 14/10/6, per-zone distribution, >40 m from spawn, chargers mostly on yard lanes, tower guard ordering, spawn/patrol points walkable against a nav grid rasterised from the world layout, fallback lanes equal generator output
- [X] T009 [US4] Rewrite `src/enemies/population.ts`: authored data, lane-aware chargers, runtime walkable validation with nudge and warning; sandbox behaviour unchanged
- [X] T010 [P] [US4] Extend `src/pickups/placements.test.ts` first: counts, elevated candidates rest on container tops/gantry, ground candidates not inside containers
- [X] T011 [US4] Update `src/pickups/placements.ts` with final positions (14/8 crates, 10/3 medkits, at least 3 elevated)

## Phase 7: User Story 5 - sandbox slice (P2)

- [X] T012 [US5] Write `tests/e2e/T-16-vertical-slice.e2e.mjs`: walk, shoot, grapple, kill sphere, charger stun, crate, tower, boss spawn, weak points + core -> victory, zero console errors

## Phase 8: Full-run checks (P1)

- [X] T013 Write `tests/e2e/T-16-full-run.e2e.mjs`: harbor success path through four towers and boss; death -> respawn at tower checkpoint with countdown unchanged; `countdown=3` -> failure without respawn
- [X] T014 [P] Write `tests/e2e/T-16-game-flow-integration.e2e.mjs`: harbor counts 14/10/6, pickups 22/13 plus boss supplies, no console errors, restart reload

## Phase 9: Polish and documentation (P3)

- [X] T015 Play the slice and harbor via Playwright, capture screenshots (harbor in play, boss arena), view them, and write `docs/PLAYTEST.md` (ammo budget, time, counts, issues, tuning proposals)
- [X] T016 Write `specs/T-16-game-flow-integration/foundation-requests.md` for integration issues and tuning requests
- [X] T017 Run typecheck, unit tests, build, smoke, and e2e for T-01..T-16; commit
