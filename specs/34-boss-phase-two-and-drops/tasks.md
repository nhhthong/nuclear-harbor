# Tasks: spec 34

- [x] T001 [FR-003] Remove the spin skill: `CRAB.spin`, `spinRate`, `sweepContact`, `SweepTracker`, anim spin/windup, `body-spin` (types, audio, vfx), tests
- [x] T002 [FR-004] Pure logic and tunables for `grab`, `quake`, `inPhaseTwo`; tests in `skills.test.ts` (selection, claw point, lunge, connect, carry, `QuakeWaves`)
- [x] T003 [FR-005] Boss module: grab stages (telegraph, lunge, carry or recover), slam damage, quake pounds, release on reset; `BossEffects` ring pool; `CrabBody` arm animation
- [x] T004 [FR-001] Dragonfly drops: `droneDropKind`, `droneDrops`, `ECONOMY.droneDrop*`, `boss:droneDestroyed`, `Drones.onShotDown`, pickups wiring and pool, tests in `logic.test.ts`
- [x] T005 [FR-002] Remove the two quay shelters; test
- [x] T006 [FR-006] Attack-id routes (audio `bossSlam`, vfx dust and ring) and their route tests
- [x] T007 [SC-001] `npx tsc --noEmit`, `npm test`, `npm run build`
- [x] T008 [SC-002] Browser check (low preset, `?boss&bossphase=low`): grab hit (lifted to 9 m, slam 100 to 30 HP, released), grab miss, quake (4 pounds, rings live then gone); one harness warning "game did not become ready within 30 s" on the slow software-GL boot, the game ran
- [x] T009 Docs: `docs/DEVIATIONS.md`, `README.md` (boss skills), `CLAUDE.md`, `docs/SPECKIT.md`, `specs/README.md`
- [ ] T010 skipped: real-GPU playtest (look of the rings and the lift, dodge windows, balance of 70 and 24 damage, camera while carried, drop collection in a run)
