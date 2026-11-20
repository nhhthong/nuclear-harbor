# Implementation Plan: World dressing, supplies, mood

**Spec**: [spec.md](spec.md) | **Branch**: dev branch `claude/wizardly-cori-697x6r`; PR #11 (with spec 24), vehicle rework PR #13

## Summary
Placement is pure data with tests in `structures/layout.ts`; rendering is two small instancing modules fed by three GLBs built offline by scripts; supplies are number changes in `ECONOMY`; the mood is tunables plus a few uniforms in the sky and grade shaders.

## Technical Context
TypeScript strict, Three.js GLTFLoader (bundled for the G36C), Vitest, Blender 4.0 for the asset scripts. Files: `src/structures/{layout,vehicles,dressing,models,index,tunables}.ts` (+ `vehicles.test.ts`, `vehicleModels.test.ts`, `dressing.test.ts`, `dressingModels.test.ts`), `src/world/{lighting,tunables}.ts`, `src/core/Renderer.ts`, `src/config/tunables.ts`, `src/pickups/placements.ts`, `src/ui/credits.ts`, `tools/asset-pipeline/{vehicles_sf,industrial,terminal}.py` (`props.py` built the first low-poly vehicle pack, replaced), `public/assets/props/{vehicles,industrial,terminal}.glb`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Instanced meshes, one draw call per kind and material; textures 512 px JPEG; meshes decimated; no per-frame allocation (not measured). Frame rate on a real GPU not measured. PASS (unverified on GPU) |
| II Typed contracts | No new events or shared types; data stays inside `structures`. PASS |
| III Tunables | Layout in `layout.ts`, mood in tunables, supplies in `ECONOMY`. PASS |
| IV Tests | Placement, model sizes vs colliders, fallback boxes, ammo budget, no elevated supplies are unit-tested. Mood (FR-004) has no test, only screenshots: JUSTIFIED (subjective). Smoke/e2e skipped (owner policy). |
| V Blast radius | Edits foundation files (`config/tunables.ts`, `core/Renderer.ts`, `pickups/placements.ts`) additively at owner request. JUSTIFIED |
| VI Offline / procedural | Binary GLBs added with the owner's approval (constitution 2.0.0); CC0/CC-BY only, shipped in the build, no runtime network; box fallback. JUSTIFIED |
| VII Simplicity | No new systems; boxes as fallback. PASS |

## Design decisions
- Colliders are boxes from the printed model sizes (`VEHICLE_SIZE`, `DRESSING_SIZE`); the `*Models.test.ts` files fail if a GLB drifts from them.
- Vehicles: textured PBR materials, body mesh `<kind>_paint` takes the per-instance tint; clutter keeps the source material.
- Load is async; colliders exist from the first frame, visuals appear when the GLB parses.
- Mood: lower, paler sun, cooler colours, overcast dome driven by `uCover`, denser grey-blue fog (density 0.0085), grade desaturates and cools shadows while sparing saturated warm pixels (lamps).
- Process history: overturned burning wrecks were built (flame shader, smoke) and removed at the owner's request; vehicles were rebuilt from Sketchfab CC-BY models (PR #13) after the first low-poly pack.

## Complexity Tracking
None.
