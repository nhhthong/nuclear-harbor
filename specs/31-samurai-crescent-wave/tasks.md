# Tasks: spec 31

## Phase 1: pure logic, test-first (FR-003, FR-004, FR-008)
- [x] T002 [FR-004, FR-008] `SAMURAI.wave` tunables, `crescentHit` (`logic.ts`)
- [x] T004 [FR-003, FR-004, FR-006] Tests (`logic.test.ts`): hit volume, crescent shape bounds, ribbon, speed below bullet, damage above cut and leap

## Phase 2: behaviour and look
- [x] T001 [FR-001] Frontal spin for the skinned naginata and the blur disc
- [x] T003 [FR-002, FR-003, FR-005, FR-006, FR-007] States, poses (red charge, overhead cut), crescent mesh, flight, hit, wall ray
- [x] T006 [FR-006] Owner feedback rework 1: shader ribbon instead of the flat crescent
- [x] T007 [FR-006, FR-004] Owner feedback rework 2: orientation "(" from the side and "|" to the player; hit half width 1.05 -> 0.55 m
- [x] T008 [FR-009] `enemy:waveReleased` emitted at release (declared in `core/events.ts` by PR #21; sound route in spec 32 T015)

## Phase 3: verification
- [x] T005 [SC-002] Browser check (coordinator, sandbox, low preset, stepped sim): a samurai 20 m away charged red for about 1 s, cut, the crescent flew at 12 m/s and hit the player (100 -> 68 HP, 32 damage); with the spin forced the blur disc and naginata turn in the frontal plane (front and side views); no console errors
- [x] T009 [SC-001] `npx tsc --noEmit`, `npm test` (615 tests then; 655 on 2026-11-20), `npm run build` pass; smoke/e2e skipped (owner policy)
- [ ] T010 skipped: tests for skill selection (6 to 26 m, leap condition, 35 degree clamp), spin orientation and the event; browser check that walls stop the crescent and gates do not; bloom on medium/high; balance; real GPU (open follow-up in `docs/SPECKIT.md`)
- [x] T011 [FR-008] `SPIN_FORWARD` is now `SAMURAI.spin.fanForward` (0.55) and the 35 degree aim limit is `SAMURAI.wave.aimMinCos` (0.82); `tsc` and the samurai tests pass (2026-11-21)
