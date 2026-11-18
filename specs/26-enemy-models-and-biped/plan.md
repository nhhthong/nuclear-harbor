# Implementation Plan: Authored enemy models, the Biped, the Medium Mech Striker

**Spec**: [spec.md](spec.md)

## Summary
One generic loader/cloner for authored GLBs (`src/enemies/authored.ts`) plus a per-robot `ClipPlayer`; the Biped is a new type with a pure brain (`brain.ts`); the `army` robot swaps its salvo for a pure attack cycle (`attack.ts`); Spot gets an authored branch next to its procedural one. Models are built offline with a Blender script.

## Technical Context
TypeScript strict, Three.js (`GLTFLoader`, `SkeletonUtils`, `AnimationMixer`), Vitest, Blender 4.0. Files: `src/enemies/{authored,clipPlayer,glowCue}.ts`, `src/enemies/biped/*`, `src/enemies/army/{ArmyRobot,attack,tunables}.ts`, `src/enemies/spot/{Spot,tunables}.ts`, `src/enemies/{index,factories,population}.ts`, `src/config/{level,tunables}.ts`, `src/core/types.ts`, `src/audio/eventMap.ts`, `src/ui/{credits,hud}.ts`, `tools/asset-pipeline/enemies_sf.py`, `public/assets/enemies/*.glb`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | 3 GLBs, 7.6k to 7.9k triangles each, shared geometry and materials, one mixer per active robot (inactive ones are not animated), pooled projectiles, glow cues reuse one sphere; no per-frame allocation. Frame rate on a real GPU not measured. PASS (unverified on GPU) |
| II Typed contracts | `EnemyType` extended; no new events; `ENEMY_DISTRIBUTION` type extended. PASS |
| III Tunables | Numbers in `biped/tunables.ts`, `army/tunables.ts` (`STRIKER`), `spot/tunables.ts` (`skin`), `ARMY_ROBOT`, `ENEMY_COUNTS`. PASS |
| IV Tests | Pure logic (leap plan, cooldowns, decisions, attack cycle, clip player, GLB budgets, roster) unit-tested; headless manager tests drive the biped and the striker. Smoke/e2e skipped (owner policy). PASS |
| V Ownership | Edits the enemies module and foundation lists (`config`, `core/types`) additively; boss files untouched. PASS |
| VI Offline / procedural | Binary art is shipped in the build (no network); CC-BY credits added; procedural models stay as fallbacks. JUSTIFIED (owner request) |
| VII Simplicity | No new framework: one loader, one clip player, one glow helper. PASS |

## Design decisions
- The Blender 4.0 glTF exporter mis-writes some imported translation tracks, so the script rewrites the striker pelvis track; the dog keeps four leg clips that the loader merges into one `walk` clip.
- The Biped's missing clips (run, crouch, leap, claw) are authored by posing the original skeleton through model-space rotations converted with each bone's rest matrix.
- Glow cues sit on bones (head, shoulders, forearms) so they follow the animation; one additive material per robot, never per frame.
- Clip speed is tied to ground speed (measured stance speed of each clip, in the tunables), so feet do not slide.
- A leap lands 0.9 m short of the locked point; the claw radius (2 m) still covers it.

## Complexity Tracking
None.
