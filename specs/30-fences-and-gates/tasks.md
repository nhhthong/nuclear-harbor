# Tasks: spec 30

## Phase 1: pure logic and config, test-first (FR-001, FR-002, FR-006, FR-008)
- [x] T002 [FR-001, FR-006] `GATES` tunables, fence lines and gates
- [x] T003 [FR-001, FR-002, FR-008] Pure layout, state machine, collider boxes, leaf geometry (`gates.ts`)
- [x] T005 [FR-001, FR-002, FR-008] Tests (`gates.test.ts`, 6): gaps, clearances, lane gates, motion, robots, swing side

## Phase 2: scene and wiring (FR-003, FR-004, FR-005)
- [x] T001 [FR-003, FR-005] `GATE` collision layer (walkers only)
- [x] T004 [FR-003, FR-004] Meshes, colliders, driver (`gateMeshes.ts`), structures registration, `world:gateMoved`, audio route (the recorded clank came with spec 32)

## Phase 3: owner tuning and verification
- [x] T006 [FR-007] Container livery `nhhthong@`
- [x] T007 [SC-002] Coordinator browser check (low preset, stepped sim): walking north into the closed west lane gate opened it (swung north, away from the player), the player passed from z 17 to z -3; 9 s after leaving it was closed again; court/quay gates render closed; containers show `nhhthong@` (14 decals); no console errors
- [x] T008 [SC-001] `npx tsc --noEmit`, `npm test` (612 tests then; 655 on 2026-11-20), `npm run build` pass; smoke/e2e skipped (owner policy)
- [ ] T009 skipped: tests for the `GATE` layer filters (bullets, sight lines and nav bake pass, drones over), robots opening gates in a real fight, the audible clank, medium/high presets, real GPU (open follow-up in `docs/SPECKIT.md`)
