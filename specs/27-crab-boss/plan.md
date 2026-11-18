# Implementation Plan: Gunslinger Crab Mech final boss

**Spec**: [spec.md](spec.md)

## Summary
Pure rules in `src/boss/skills.ts` and `BossModel.ts`; `index.ts` glues them to the scene; instanced effects in `BossEffects.ts`, pooled drones in `Drones.ts`; two GLBs built offline by Blender scripts; the old procedural body stays as the fallback look.

## Technical Context
TypeScript strict, Three.js GLTFLoader, Rapier primitives, Vitest, Blender 4.0 (`tools/asset-pipeline/boss_sf.py`, `drone_sf.py`). Files: `src/boss/{index,BossModel,skills,tunables,BossAttacks,BossColliders,BossEffects,Drones,CrabBody,crabAssets,BossBody(fallback),CinematicFx}.ts`, `src/config/tunables.ts` (`BOSS`), `src/core/{types,events}.ts` (phase and attack ids), `src/ui/{hud,styles,credits}.ts`, `src/audio/eventMap.ts`, `src/vfx/mapping.ts`, `public/assets/enemies/{crab-boss,dragonfly-drone}.glb`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Crab 27k triangles in 9 meshes; effects instanced (markers 1, bombs 1, bolts 1, beams 3 draw calls); drones one instanced mesh (4.8k triangles x 6) plus one glow; beams clipped at 30 Hz; drone, bomb and bolt pools are fixed capacity. PASS |
| II Typed contracts | `BossPhase` loses the weak-point phases (only the boss used them), `BossAttackId` gains four ids; weak point events stay declared but are never emitted; HUD, audio and vfx are tolerant. PASS |
| III Tunables | HP in `BOSS`, every skill number in `CRAB` (`src/boss/tunables.ts`). PASS |
| IV Tests | Skill selection, weights by distance and cooldown, bomb pattern and falloff, drone cap and orbit, laser angles, hit test, ticks, spin contacts, model phases and 232 hits, ammo budget. Smoke/e2e skipped (owner policy). PASS |
| V Ownership | Touches the shared contracts additively and the HUD boss block at the owner's request. JUSTIFIED |
| VI Offline / procedural | Two CC-BY models, shipped in the build, no runtime network; procedural fallbacks. JUSTIFIED (owner approved free models) |
| VII Simplicity | The old body code is kept untouched as the fallback; no new systems. PASS |

## Design decisions
- Skills are a small state machine (`telegraph` -> `active` -> idle gap) in `index.ts`; durations come from `CRAB`.
- Beams: a physics raycast per beam at 30 Hz clips them at static geometry; hit test is segment distance plus a vertical band so a jump clears them.
- Spin: arm directions sweep with the body yaw; `SweepTracker` reports only the rising edge of a contact (one hit per sweep).
- Drones: `kind: 'enemy'` damageables in `Groups.enemy` (the weapon needs only `meta.damageable`); not registered with `ctx.enemies`, so they do not count for the roster or the objective.
- The cinematic keeps `scale` 0.5; the crab model is real metres, so sandbox size factor is `scale / 0.5`.

## Complexity Tracking
None.
