# Implementation Plan: Gunslinger Crab Mech final boss

**Spec**: [spec.md](spec.md) | **Branch**: sub-agent worktree merged into the dev branch `claude/wizardly-cori-697x6r` (`321e73f`); PR #15 to `main`

## Summary
Pure rules in `src/boss/skills.ts` and `BossModel.ts`; `index.ts` glues them to the scene; instanced effects in `BossEffects.ts`, pooled drones in `Drones.ts`; two GLBs built offline by Blender scripts; the old procedural body stays as the fallback look.

## Technical Context
TypeScript strict, Three.js GLTFLoader, Rapier primitives, Vitest, Blender 4.0 (`tools/asset-pipeline/boss_sf.py`, `drone_sf.py`). Files: `src/boss/{index,BossModel,skills,tunables,BossAttacks,BossColliders,BossEffects,Drones,CrabBody,crabAssets,BossBody,CinematicFx}.ts`, `src/config/tunables.ts` (`BOSS`), `src/core/{types,events}.ts` (phase and attack ids), `src/ui/{hud,styles,credits}.ts`, `src/audio/eventMap.ts`, `src/vfx/mapping.ts`, `public/assets/enemies/{crab-boss,dragonfly-drone}.glb`. Tests: `skills.test.ts` (24), `BossModel.test.ts` (11), `crabAssets.test.ts` (5), `BossAttacks.test.ts`, `src/combat/damage.test.ts`. The drone loader moved to `src/assets/droneAsset.ts` in spec 29 (shared with the roster drone).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Crab 27k triangles in 9 meshes; effects instanced (markers 1, bombs 1, bolts 1, beams 3 draw calls); drones one instanced mesh (4.8k triangles x 6) plus one glow; beams clipped at 30 Hz; drone, bomb and bolt pools are fixed capacity. Frame rate on a real GPU not measured. PASS (unverified on GPU) |
| II Typed contracts | JUSTIFIED: `BossPhase` loses the weak-point phases (only the boss used them) and `BossAttackId` gains four ids (the constitution cites this change as the example exception). `boss:weakPoint*` and `boss:coreExposed` stay declared but are never emitted; HUD, audio and vfx are tolerant. |
| III Tunables | HP in `BOSS`, every skill number in `CRAB` (`src/boss/tunables.ts`). PASS |
| IV Tests | Skill selection, weights, cooldowns, bomb pattern and falloff, drone cap and orbit, laser angles and hit test, ticks, spin contacts, model phases and 232 hits, ammo budget. Drone physics meta, HUD bar, disposal, movement band: no test. Smoke/e2e skipped (owner policy). |
| V Blast radius | Boss module plus additive/shared edits to `core/types.ts`, `core/events.ts`, `config/tunables.ts`, HUD boss block, audio and vfx maps, at the owner's request; spec 26 stream ran in a separate worktree. DECLARED |
| VI Offline / procedural | Two CC-BY models shipped in the build, no runtime network; procedural fallbacks (`BossBody.ts`, procedural flyer). JUSTIFIED (owner approved free models) |
| VII Simplicity | The old body code is kept untouched as the fallback; no new systems. PASS |

## Design decisions
- Skills are a small state machine (`telegraph` -> `active` -> idle gap) in `index.ts`; durations come from `CRAB`.
- Beams: a physics raycast per beam at 30 Hz clips them at static geometry; hit test is segment distance plus a vertical band (0.4 to 1.3 m) so a double jump clears them.
- Spin: arm directions sweep with the body yaw; `SweepTracker` reports only the rising edge of a contact (one hit per sweep); safe height 1.4 m.
- Drones: `kind: 'enemy'` damageables in `Groups.enemy` (the weapon needs only `meta.damageable`); not registered with `ctx.enemies`, so not in the roster or the objective.
- The cinematic keeps `scale` 0.5; the crab model is real metres, so the sandbox size factor is `scale / 0.5`.
- Testing hooks `ctx.testHooks.boss`: `getState`, `skipCinematic`, `damage`, `setHp`, `pauseAi`, `force('bombs'|'drones'|'spin'|'laser')`, `teleportBoss`, `killDrones`.

## Complexity Tracking
| Item | Why | Simpler option rejected |
|---|---|---|
| Phase enum change (Principle II) | The weak-point design is gone by owner decision | Keeping dead phases would leave unreachable states in HUD and audio |
