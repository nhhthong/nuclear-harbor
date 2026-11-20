# Implementation Plan: Authored enemy models, the Biped, the Medium Mech Striker

**Spec**: [spec.md](spec.md) | **Branch**: sub-agent worktree `worktree-agent-acb2493e6c1abc2c3` merged into the dev branch `claude/wizardly-cori-697x6r` (`1949b1d`, `321e73f`); PR #15 to `main`

## Summary
One generic loader/cloner for authored GLBs (`src/enemies/authored.ts`) plus a per-robot `ClipPlayer`; the Biped is a new type with a pure brain (`brain.ts`); the `army` robot swaps its salvo for a pure attack cycle (`attack.ts`); Spot gets an authored branch next to its procedural one. Models are built offline with one Blender script.

## Technical Context
TypeScript strict, Three.js (`GLTFLoader`, `SkeletonUtils`, `AnimationMixer`), Vitest, Blender 4.0. Files: `src/enemies/{authored,clipPlayer,glowCue}.ts`, `src/enemies/biped/*`, `src/enemies/army/{ArmyRobot,attack,tunables}.ts`, `src/enemies/spot/{Spot,tunables}.ts`, `src/enemies/{index,factories,population}.ts`, `src/config/{level,tunables}.ts`, `src/core/types.ts`, `src/audio/eventMap.ts`, `src/ui/{credits,hud}.ts`, `tools/asset-pipeline/enemies_sf.py`, `public/assets/enemies/{biped,striker,spot}.glb`. Tests: `biped/brain.test.ts`, `army/attack.test.ts`, `authored.test.ts`, `clipPlayer.test.ts`, `EnemyManager.test.ts`, `population.test.ts`, `src/combat/damage.test.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | 3 GLBs, 7.6k to 7.9k triangles, shared geometry and materials, `SkeletonUtils.clone` gives each robot its own skeleton (no shared animated skeleton), one mixer per active robot only, pooled projectiles, glow cues reuse one sphere. Frame rate with 10 live skinned robots on a real GPU not measured. PASS (unverified on GPU) |
| II Typed contracts | `EnemyType` and `ENEMY_DISTRIBUTION` type extended (additive); no events added or renamed. PASS |
| III Tunables | `biped/tunables.ts`, `army/tunables.ts` (`STRIKER`), `spot/tunables.ts` (`skin`), `ARMY_ROBOT`, `ENEMY_COUNTS`. PASS |
| IV Tests | Leap plan, cooldowns, decisions, attack cycle, clip player, GLB budgets and poses, roster, ammo budget unit-tested; headless manager tests drive biped and striker. Balance and the leap against a moving player not played. Smoke/e2e skipped (owner policy). PASS |
| V Blast radius | Enemies module plus additive edits to `config/level.ts`, `config/tunables.ts`, `core/types.ts`, `audio/eventMap.ts`, `ui/hud.ts` (radar); boss files untouched (parallel stream, separate worktree). DECLARED |
| VI Offline / procedural | Three CC-BY GLBs built by `enemies_sf.py`, shipped in the build, no network; procedural models stay as fallbacks. JUSTIFIED (owner approved free models) |
| VII Simplicity | One loader, one clip player, one glow helper; no new framework. PASS |

## Design decisions
- Blender 4.0 mis-writes some imported translation tracks, so the script rewrites the striker pelvis track; the dog's four leg clips are merged into one `walk` clip by the loader.
- The Biped's missing clips (run, crouch, leap, claw) are authored by posing the original skeleton with model-space rotations converted with each bone's rest matrix.
- Glow cues sit on bones (head, shoulders, forearms) so they follow the animation; one additive material per robot.
- Clip speed is tied to ground speed (measured stance speed of each clip, in the tunables) so feet do not slide.
- A leap lands 0.9 m short of the locked point; the 2 m claw radius still covers it. Dodge clearance 1.3 m since the natural-jump change.
- Ammo budget history: 116 roster hits here; 348 with the crab (supply 540); 356 vs 570 after spec 29.

## Complexity Tracking
None.
