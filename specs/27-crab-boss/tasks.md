# Tasks: Gunslinger Crab Mech final boss

## Phase 1: assets (US3)
- [x] T001 [FR-005] `crab-boss.glb` (`boss_sf.py`: split legs, decimate, 1.76 MB, 27k triangles) and `dragonfly-drone.glb` (`drone_sf.py`: armature applied, 0.42 MB, 4.8k triangles); Blender renders checked

## Phase 2: pure rules, test-first (US1, US2)
- [x] T002 [FR-001, FR-002] `BOSS` = one pool of 5800 HP; `BossPhase` dormant/awakening/fight/destroyed; new `BossAttackId`s; `BossModel` single pool + `BossModel.test.ts`
- [x] T003 [FR-003] `skills.ts` + `skills.test.ts`: selection, cooldowns, weights, bomb pattern and falloff, drone cap, beam angles and hit test, ticks, spin contacts
- [x] T004 [FR-003] `CRAB` tunables (`src/boss/tunables.ts`)

## Phase 3: scene (US2, US3)
- [x] T005 [FR-004, FR-005] Primitive colliders (`BossColliders.ts`), crab visual with tripod gait (`CrabBody.ts`), loader with fallbacks (`crabAssets.ts` + `crabAssets.test.ts`)
- [x] T006 [FR-004] Effects: markers, lobbed bombs, bolts, beams (`BossEffects.ts`); pooled drones (`Drones.ts`)
- [x] T007 [FR-001, FR-005] Wire the module: spawn waits for the GLBs, skills, movement band and strafe, collapse, testing hooks (`index.ts`)
- [x] T008 [FR-002] HUD: one HP bar; audio and vfx mapping for the new attack ids; title card; weak point UI removed

## Phase 4: budget, docs, verification
- [x] T009 [FR-006] Ammo budget test (337 on the branch, 348 after the roster rework, 356 vs 570 after spec 29), placements test
- [x] T010 Credits (`credits.ts`, `CREDITS.md`), `docs/ASSETS.md`, `docs/DEVIATIONS.md`
- [x] T011 [SC-001, SC-002] `npx tsc --noEmit`, `npm test`, `npm run build` pass (re-run 2026-11-20: 655 tests); coordinator Playwright screenshots (low preset) of the crab and each skill; smoke/e2e skipped (owner policy)
- [x] T012 [FR-007] Dodge thresholds lowered with the natural jump (spin `safeHeight` 2.4 -> 1.4, laser `top` 1.7 -> 1.3; 2026-11-19, commit `2d85cdd`), tests updated; browser not re-run
- [ ] T013 skipped: full boss fight start to victory, HUD bar and victory flow in a real run, crab among containers, orange wash on the crab while skills telegraph (cause unknown), real-GPU frame rate (needs a player and a GPU; open follow-ups in `docs/SPECKIT.md`)
