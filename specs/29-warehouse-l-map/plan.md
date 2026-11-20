# Implementation Plan: Warehouse, L-shaped map, flying drones, interior props

**Spec**: [spec.md](spec.md) | **Branches**: contract and plan PR #18 (`d29a530`); streams A, B, C each in a sub-agent worktree, merged into the dev branch `claude/wizardly-cori-697x6r` (PR #19), squashed with spec 30 into `main` as PR #20 (`95bdaf2`)

## Summary
One shared contract (`src/config/warehouse.ts`, written first by the coordinator) and three parallel streams in separate worktrees, merged by the coordinator. Stream notes: `notes-A.md`, `notes-B.md`, `notes-C.md`.
- **A, layout and shell**: `src/config/level.ts` (L, spawn, zones, KEEP_CLEAR, distribution), `src/world/{containerLayout,perimeter,perimeterModel}.ts`, `src/structures/{warehouseLayout,warehouse}.ts` (frame, roof, stair, mezzanine, office, windows, doors, colliders, floor, lamps), `PhysicsWorld.addStaticBox({ rotation })`, `enemies/nav/bakeNav.ts` (cells outside the L blocked), posts, pickups and shelters moved out of the dock.
- **B, drone**: `src/enemies/drone/` (flight steering with sphere-cast avoidance, opening waypoints, anti-camping call-in, tunables), `src/assets/droneAsset.ts` (shared with the boss), roster counts, radar, audio/VFX mapping, extra crate and ammo budget.
- **C, props**: `tools/asset-pipeline/warehouse_props.py` -> `public/assets/props/warehouse.glb`, procedural racks, `src/structures/{warehouseProps,warehousePropMeshes,warehousePropsTunables}.ts`, credits.

## Technical Context
TypeScript strict, Three.js, Rapier (cuboids, sphere casts, character controller in tests), Vitest, Blender 4.0. Tests: `src/world/lMap.test.ts`, `src/structures/{warehouse,warehouseProps,warehousePropMeshes}.test.ts`, `src/enemies/drone/{Drone,steering,openings}.test.ts`, `src/config/level.test.ts`, `src/combat/damage.test.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Instanced props and frame members, merged static geometry, colliders only for large items, drone count capped (4 roster, 6 call-ins per run, live cap 10). Measured: draw calls 56 to 151 (budget 350), 0.41 to 0.65 M triangles; the whole interior in view is about 29 prop draw calls and 227k triangles. Real-GPU frame rate not measured. PASS (unverified on GPU) |
| II Typed contracts | New shared contract file in `src/config`; `EnemyType` gains `'drone'` in `core/types.ts` (additive); no event renamed. PASS |
| III Tunables | Warehouse numbers in `src/config/warehouse.ts` and `WAREHOUSE_LOCAL`/`PERIMETER_LOCAL`/`warehousePropsTunables.ts`; drone numbers in `src/enemies/drone/tunables.ts`; counts in `src/config/tunables.ts`. PASS |
| IV Tests | Forced path (nav flood fill), stair climb, railing, every opening a gap, corridor and stair free, supply spot, closed dock, steering, openings, call-in, props rules, budget are unit-tested. Browser checks done by the coordinator. Not tested: shooting through a window, interior look. Smoke/e2e skipped. PASS |
| V Blast radius | Stream A: `config/level.ts`, `world/*`, `structures/*`, `physics/PhysicsWorld.ts` (optional rotation), `enemies/nav/bakeNav.ts`, `enemies/population.ts`, `pickups/placements.ts`. Stream B: `enemies/drone`, `assets/droneAsset.ts`, `config/tunables.ts` (counts, supplies), `core/types.ts`, radar in `ui/hud.ts`, audio/vfx maps. Stream C: `structures/warehouseProps*`, `tools/asset-pipeline`, `ui/credits.ts`. Overlaps (tunables, credits, DEVIATIONS, `structures/index.ts`) resolved at merge. DECLARED |
| VI Offline | CC0/CC-BY GLB built offline (`warehouse.glb` 1.7 MB), credited, shipped in the build; procedural fallback for props (boxes) and drones (boss fallback). JUSTIFIED (owner approved) |
| VII Simplicity | Drones steer directly with ray avoidance and opening waypoints, no 3D nav mesh; robots on foot do not climb stairs. PASS |

## Design decisions
- Interior floor: a 1.5 cm concrete slab over the reflective asphalt (polygon offset) so the sky reflection stays outside; later CC0 `concrete_floor_worn_001` maps.
- The yard container wall and the perimeter wall have invisible blockers up to 15 m (drones); the warehouse roof is a real collider (two pitched slabs) plus an invisible parapet above the west eave.
- One set of high-bay lamps (props stream); the shell keeps the small lamps under the mezzanine. Lamps are emissive shapes, no real lights.
- Interior props cast no shadows (indoors); only the rack mesh does.

## Complexity Tracking
Three streams overlapped on purpose to finish in one pass; the contract file removed number conflicts. Two contract conflicts stayed open (back door height vs mezzanine deck, `win-n1` vs door x range; see spec).
