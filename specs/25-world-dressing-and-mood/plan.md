# Implementation Plan: World dressing, supplies, mood

**Spec**: [spec.md](spec.md)

## Summary
Placement is pure data and tests in `structures/layout.ts`; rendering is two small instancing modules fed by three GLBs built offline with Blender scripts; supplies are number changes in `ECONOMY`; the mood is tunables plus a few uniforms in the sky and grade shaders.

## Technical Context
TypeScript strict, Three.js GLTFLoader (already bundled for the G36C), Vitest, Blender 4.0 for the asset scripts. Files: `src/structures/{layout,vehicles,dressing,index,tunables}.ts`, `src/world/{lighting,tunables}.ts`, `src/core/Renderer.ts`, `src/config/tunables.ts`, `src/pickups/placements.ts`, `src/ui/credits.ts`, `tools/asset-pipeline/*.py`, `public/assets/props/*.glb`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Instanced meshes, one draw call per kind (22 extra); textures 512 px JPEG; meshes decimated; no per-frame allocation. PASS |
| II Typed contracts | No new events or shared types; data stays inside `structures`. PASS |
| III Tunables | Layout in `layout.ts`, mood in tunables, supplies in `ECONOMY`. PASS |
| IV Tests | Placement, model sizes vs colliders, wreck maths (removed later), fallback boxes, ammo budget. Smoke/e2e skipped (owner policy). PASS |
| V Ownership | Touches foundation files (`config`, `core/Renderer`) additively, at owner request. JUSTIFIED |
| VI Offline / procedural | Binary art was added with the owner's approval; CC0/CC-BY only, shipped in the build, no runtime network. JUSTIFIED |
| VII Simplicity | No new systems; boxes as fallback. PASS |

## Design decisions
- Colliders are boxes taken from the printed model sizes; `vehicleModels.test.ts` and `dressingModels.test.ts` fail if a GLB drifts from them.
- Vehicles use baked vertex colours + a per-instance tint so one material serves all kinds; PBR clutter keeps the source material.
- Load is async; colliders exist from the first frame, visuals appear when the GLB parses.
- Mood: lower sun intensity and cooler colours, overcast dome driven by `uCover`, fog denser and grey-blue, grade desaturates and cools shadows while sparing saturated warm pixels.

## Complexity Tracking
None.
