# Tasks: Authored enemy models, the Biped, the Medium Mech Striker

## Phase 1: assets (FR-002)
- [x] T001 Download the three Sketchfab models (licence checked per uid), inspect skeletons and clips with Blender
- [x] T002 `tools/asset-pipeline/enemies_sf.py`: clean, decimate, 512 px materials, scale, orient, clips (biped authored clips, striker clip pick and pelvis fix, spot leg clips); ship `biped.glb`, `striker.glb`, `spot.glb`; Blender renders of mid-animation frames checked

## Phase 2: shared loader (test-first, FR-003, FR-009)
- [x] T003 `authored.ts` (load, merge, clone, dispose), `clipPlayer.ts`, `glowCue.ts` with `authored.test.ts` (sizes, triangles, clips, feet, orientation, clone) and `clipPlayer.test.ts`
- [x] T008 Wait for all GLBs before the population starts (`enemies/index.ts`, 5 s), procedural fallback on failure

## Phase 3: Biped (US1; FR-001, FR-004, FR-006)
- [x] T004 `biped/{tunables,brain,Biped,index}.ts`, `brain.test.ts` (leap plan, cooldowns, decisions), manager tests for the run, crouch, leap, claw sequence and the dodge
- [x] T005 Register `biped` (types, factories, population and posts, `ENEMY_COUNTS`, `ENEMY_DISTRIBUTION`, audio variant, radar marker, `?enemies=biped`)

## Phase 4: Striker and Spot (US2, US3; FR-007, FR-008)
- [x] T006 `army/attack.ts` (bursts and rocket cycle) + `attack.test.ts`, `STRIKER` tunables, `ARMY_ROBOT` band and rocket numbers, authored branch in `ArmyRobot.ts` (procedural fallback kept), manager tests; `salvo.ts` and its test deleted
- [x] T007 Spot authored branch (walk clip scaled to ground speed, frozen in the crouch and leap, head glow), behaviour untouched

## Phase 5: budget, docs, verification
- [x] T009 [FR-010] Damage test for the roster (116 hits here, 348 with the crab, 356 with the roster drones of spec 29), level and population tests
- [x] T010 Credits, `docs/ASSETS.md`, `docs/DEVIATIONS.md`
- [x] T011 [FR-005, SC-001, SC-002] `npx tsc --noEmit`, `npm test`, `npm run build` pass (re-run 2026-11-20: 655 tests); scripted low-preset screenshots of the three robots (biped crouch, leap, claw; striker pods and rockets); smoke/e2e skipped (owner policy)
- [x] T012 Dodge clearance of the biped lowered 1.8 -> 1.3 m with the natural jump (2026-11-19, commit `2d85cdd`), test updated
- [ ] T013 skipped: playtest of the biped leap against a moving player, striker and biped balance, frame rate with 10 live skinned robots (needs a real GPU and a player; open follow-up in `docs/SPECKIT.md`)
