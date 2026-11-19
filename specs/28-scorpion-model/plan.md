# Implementation Plan: Authored STINGER-7 model

**Spec**: [spec.md](spec.md)

## Summary
One GLB built offline by a Blender script; a scorpion-local loader (`scorpionAssets.ts`), pure pose maths (`scorpionPose.ts`) and a rig (`ScorpionSkin.ts`) that implements the existing `ScorpionRig` interface. `ScorpionAssets` becomes `{ kind, colliders, makeRig, dispose }` so `Scorpion.ts` no longer knows which look it has; the procedural model is untouched apart from that wrapper.

## Technical Context
TypeScript strict, Three.js GLTFLoader, Rapier cuboids, Vitest, Blender 4.0 (`tools/asset-pipeline/scorpion_sf.py`). Files: `src/scorpion/{scorpionAssets,scorpionPose,ScorpionSkin,ScorpionModel,Scorpion,index}.ts`, `public/assets/enemies/scorpion.glb`, `src/ui/credits.ts`, docs.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | About 15.6k triangles in a handful of meshes (two primitives per part with glow, plus the orb), against about 27 meshes for the procedural model; no per-frame allocation (`solveJoints` fills a preallocated struct); one glow material pulses. PASS |
| II Typed contracts | No event or shared type changes; `ScorpionAssets` is module-internal. PASS |
| III Tunables | Gameplay numbers untouched; animation numbers are named constants in `scorpionPose.ts` (`GAIT`, `TAIL_CURL`, `GLOW`). PASS |
| IV Tests | Loader validation, fallback on failure, shipped GLB (size, triangles, nodes, materials, orientation, size, hit boxes, chain), joint maths, rig apply and dispose. Smoke/e2e skipped (owner policy). PASS |
| V Ownership | Only the scorpion module and docs. PASS |
| VI Offline / procedural | One CC-BY model shipped in the build, no runtime network; procedural fallback. JUSTIFIED (owner approved free models) |
| VII Simplicity | Rigid parts and joint rotations, no skinning or clips; the old model stays as is. PASS |

## Design decisions
- Split by loose islands and centroid (legs: |x| >= 0.3 and front/rear by y; tail: polar angle about the fitted arc centre), decimated per part, tiny islands dropped.
- A second material for the glowing islands plus a small recessed disc in the cannon mouth; armour and glow are two primitives per node.
- Names of mesh data differ from node names (three.js would otherwise rename a node).
- The scorpion waits for the look: the trigger check in `fixedUpdate` is skipped until `assets` exists.

## Complexity Tracking
None.
