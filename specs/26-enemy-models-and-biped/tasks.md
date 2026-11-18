# Tasks: Authored enemy models, the Biped, the Medium Mech Striker

- [x] T001 Download the three Sketchfab models (licence checked per uid), inspect skeletons and clips with Blender
- [x] T002 `tools/asset-pipeline/enemies_sf.py`: clean, decimate, 512 px materials, scale, orient, clips (biped authored clips, striker clip pick and pelvis fix, spot leg clips); ship `biped.glb`, `striker.glb`, `spot.glb`
- [x] T003 `authored.ts` (load, merge, clone, dispose), `clipPlayer.ts`, `glowCue.ts` with tests (`authored.test.ts`, `clipPlayer.test.ts`)
- [x] T004 Biped: `biped/{tunables,brain,Biped,index}.ts` and `brain.test.ts` (leap plan, cooldowns, decisions); manager tests for the run, crouch, leap, claw sequence and the dodge
- [x] T005 Register `biped` (types, factories, population and posts, `ENEMY_COUNTS`, `ENEMY_DISTRIBUTION`, audio variant, radar marker, `?enemies=biped`)
- [x] T006 Striker: `army/attack.ts` (bursts and rocket cycle) with tests, `STRIKER` tunables, `ARMY_ROBOT` band and rocket numbers, authored branch in `ArmyRobot.ts` (procedural fallback kept), manager tests
- [x] T007 Spot authored branch (walk clip scaled to ground speed, frozen in the crouch and leap, head glow), behaviour untouched
- [x] T008 Wait for all GLBs before the population starts (`enemies/index.ts`), procedural fallback on failure
- [x] T009 Damage test for the roster (116 hits here, 356 with the boss), level and population tests
- [x] T010 Credits, `docs/ASSETS.md`, `docs/DEVIATIONS.md`
- [x] T011 `npx tsc --noEmit`, `npm test`, `npm run build`; scripted screenshots of the three robots (smoke/e2e skipped per owner policy)
