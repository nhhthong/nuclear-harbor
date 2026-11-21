# Tasks: spec 33

- [x] T001 [FR-001] `airJumpSpeed` 11.6; update `ads.test.ts`, `PlayerController.test.ts` (apex range) and add the landing-on-a-container test
- [x] T002 [FR-003] Gate lock/hold/unlock/bumped in `gates.ts`, `lockedUntilTower` in `GATES`, wiring and toast in `gateMeshes.ts`, tests in `gates.test.ts` (4)
- [x] T003 [FR-002] Quay emptied (`ENEMY_DISTRIBUTION`, `population.ts` posts, quay drone post moved), roster rebalanced into the yard and the court, `EnemyManager.sealBossQuay` on `objectives:allActivated`; tests in `level.test.ts`, `population.test.ts`, `EnemyManager.test.ts`
- [x] T004 [FR-004] Four crates, `ammoCratesInZones` 12; budget test 690; positions checked against the generated layout by `placements.test.ts`
- [x] T005 [FR-005] `unstuck.ts` + `unstuck.test.ts` (8), `SCORPION.stuck`, crawl and relocate in `Scorpion.ts`, `unstuckSim.test.ts` (2)
- [x] T006 [SC-001] `npx tsc --noEmit`, `npm test`, `npm run build` (see `docs/DEVIATIONS.md` for the counts)
- [x] T007 [SC-002] Low-preset browser check: gates locked and closed at start; after `objectives.forceActivate(1)` unlocked and opening, `quaySealed` true, 0 console errors
- [x] T008 Docs: `docs/DEVIATIONS.md`, `CLAUDE.md` status, `docs/SPECKIT.md`, `specs/README.md`, 2026-11 analysis decisions
- [ ] T009 skipped: playtest on a real GPU (jump window, a full run with the solo boss, scorpion in the real yard, gates with robots at them, frame rate)
