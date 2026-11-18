# Tasks: Gunslinger Crab Mech final boss

- [x] T001 Build `crab-boss.glb` (`boss_sf.py`: split legs, decimate, 1.8 MB, 27k triangles) and `dragonfly-drone.glb` (`drone_sf.py`: armature applied, 0.4 MB, 4.8k triangles); check Blender renders
- [x] T002 `BOSS` = one pool of 5800 HP; `BossPhase` dormant/awakening/fight/destroyed; new `BossAttackId`s; `BossModel` single pool (+ tests)
- [x] T003 Pure skill logic in `skills.ts` with tests: selection, cooldowns, weights, bomb pattern and falloff, drone cap, beam angles and hit test, ticks, spin contacts
- [x] T004 `CRAB` tunables (`src/boss/tunables.ts`)
- [x] T005 Primitive colliders (`BossColliders.ts`), crab visual with tripod gait (`CrabBody.ts`), loader with fallbacks (`crabAssets.ts`)
- [x] T006 Effects: markers, lobbed bombs, bolts, beams (`BossEffects.ts`); drones (`Drones.ts`)
- [x] T007 Wire the module: spawn waits for the GLBs, skills, movement band and strafe, collapse, testing hooks (`index.ts`)
- [x] T008 HUD: one HP bar; audio and vfx mapping for the new attack ids; title card; weak point UI removed
- [x] T009 Ammo budget test (337 here, 348 after the roster rework), placements test
- [x] T010 Credits (`credits.ts`), `docs/ASSETS.md`, `docs/DEVIATIONS.md`
- [x] T011 `npx tsc --noEmit`, `npm test`, `npm run build`; Playwright screenshots (low preset) of the crab and each skill; smoke/e2e skipped per owner policy
