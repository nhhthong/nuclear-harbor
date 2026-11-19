# Implementation Plan: Warehouse, L-shaped map, flying drones, interior props

**Spec**: [spec.md](spec.md)

## Summary
One shared contract (`src/config/warehouse.ts`) and three parallel work streams, each in its own worktree, merged by the coordinator:
- **A, layout and shell**: `src/config/level.ts` (L, spawn, zones, KEEP_CLEAR, distribution), `src/world/containerLayout.ts` (west leg only, north container wall), `src/structures/warehouse*.ts` (shell, frame, roof, stairs, mezzanine, office, windows, doors, colliders, interior floor material and lamps), perimeter wall, nav bake, spawn posts, pickups and shelters moved out of the warehouse block, tests.
- **B, flying drone**: `src/enemies/drone/` (reuses the boss drone GLB and bolt look through a shared loader), flight steering with ray avoidance, opening waypoints from the contract, anti-camping call-in, roster tunables, radar, audio/VFX mapping, ammo budget (one extra crate at `WAREHOUSE.supplySpot`).
- **C, interior props**: `tools/asset-pipeline/warehouse_props.py` -> `public/assets/props/warehouse.glb`, procedural pallet racks, `src/structures/warehouseProps.ts` placement inside `WAREHOUSE.propZones`, colliders, credits.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Instanced props and frame members, merged static geometry, colliders only for large items, drone count capped; draw calls must stay under 350. PASS (to be measured by the coordinator) |
| II Typed contracts | New shared contract file in `src/config`; new `EnemyType` 'drone' added to `core/types.ts` and events only by stream B. PASS |
| III Tunables | Warehouse numbers in `src/config/warehouse.ts`; drone numbers in `src/enemies/drone/tunables.ts`; counts in `src/config/tunables.ts`. PASS |
| IV Tests | Path and placement tests (corridor, stairs, openings, supply spot), drone steering maths, budget. Browser checks by the coordinator; smoke/e2e skipped. PASS |
| V Blast radius | A: config/level, world, structures (shell), pickups/shelters positions. B: enemies/drone, enemy counts, radar, audio/vfx maps. C: structures/warehouseProps, asset pipeline, credits. Overlaps (tunables, credits, DEVIATIONS) resolved at merge. DECLARED |
| VI Offline | CC0/CC-BY GLBs built offline, credited; procedural fallback for props (boxes) and drones (boss fallback). JUSTIFIED (owner approved) |
| VII Simplicity | Drones steer directly with ray avoidance and opening waypoints, no 3D nav mesh; robots on foot do not climb stairs. PASS |

## Complexity Tracking
Stream overlap is intentional to finish in one pass; the contract file removes number conflicts.
