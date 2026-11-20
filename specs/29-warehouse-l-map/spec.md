# Feature Specification: Warehouse, L-shaped map, flying drones, interior props

**Feature**: `29-warehouse-l-map` | **Created**: 2026-11-19 | **Status**: Implemented and merged (PR #18 contract and plan, PR #19 streams into the dev branch, PR #20 to `main`); not played on a real GPU
**Input**: owner request 2026-11-19: a playable warehouse with stairs, an upstairs office, windows and a real steel structure where the player can stand and shoot from above; the map becomes an L with the warehouse filling the rest; flying robots (reuse the dragonfly drone) so robots reach the upper floor; free models scattered inside the warehouse.
**Process (the only spec written before the code)**: the coordinator wrote the contract `src/config/warehouse.ts`, this spec, the plan and the checklist first (`d29a530`, PR #18); three sub-agents then worked in separate worktrees on streams A (layout and shell), B (drone), C (props), each leaving `notes-A/B/C.md` (kept here as records); the coordinator merged them (`12dbc8d`, `1313058`, `910f684`; two conflicts, DEVIATIONS and `structures/index.ts`), ran the checks and the browser verification, and handled owner feedback (warehouse floor looked like not-concrete: `ed0fdf2`). Sub-agents wrote only code and assets (no dev server, no screenshots) by rule. Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (coordinator, 2026-11-19, low preset, software GL, stepped simulation), `[N]` not verified.

## User Scenarios & Testing

### User Story 1 - Forced path through a warehouse (Priority: P1)
The outdoor play area is an L: the west leg (gate apron + container yard, x -36..6) and the north leg (relay court + quay, full width), closed by a 7 m perimeter wall on the land sides. The south-east block is a closed loading dock. A two-high container wall along z = -24 closes the yard to the north, so the only way to the court is through the warehouse: roller door (8, -4) in, back door (14, -24) out. Spawn is (-15, 29).
1. Gate -> yard -> roller door -> corridor -> back door -> court and back is walkable; the container wall stops a walk north at x -10. [U `src/world/lMap.test.ts` (nav flood fill with the roller door closed and open); B]
2. Nothing is placed in the closed dock; `zoneAt` is null there. [U `src/config/level.test.ts`, `lMap.test.ts`]
3. Spawn safe radius holds. [U `level.test.ts`]

### User Story 2 - Height: stair, mezzanine, office (Priority: P1)
Open steel stair (20 risers of 0.18 m) up to a mezzanine deck at 3.6 m along the north wall with railings and a glazed office; open window frames over the relay court.
1. Walkable with the current jump (0.95 m single, 1.8 m double; the jump was lowered on 2026-11-19, before this work was implemented). [U `lMap.test.ts` character controller climbs the stair; B climbed to the deck, y 3.62]
2. The railing stops a walk off the deck edge. [U `lMap.test.ts`; B]
3. From the mezzanine windows the player sees and shoots into the relay court. [N: every opening is a real gap (U `src/structures/warehouse.test.ts`), but no shot through a window was fired in the browser]

### User Story 3 - Flying drones (Priority: P1)
The boss's dragonfly drone becomes a regular enemy (`drone`, 40 HP, 4-damage bolt at 24 m/s after a 0.55 s glow, every 1.8 to 2.8 s with line of sight). It flies without the nav grid, avoids walls, takes flyable openings to reach a player inside or on the mezzanine, never enters walls or the roof. 4 in the roster (2 over the west leg and warehouse line, 2 over court and quay) streamed with the ground roster; an anti-camping call-in sends 2 hunter drones after 8 s on the mezzanine (fewer than 2 call-ins alive, 6 per run at most, never above the live cap 10).
1. Steering, openings, caps, wall not crossed, stand-off band, bolts, death. [U `src/enemies/drone/{steering,openings}.test.ts`, `Drone.test.ts`, call-in timer tests]
2. Two drones spawned outside entered by the roller door and the north openings and reached the player on the mezzanine within 6 s; the call-in fired after 8 s with 2 drones and the cap held. [B]
3. Large pale glow when a drone charges a shot very close to the camera. [N: seen, not fixed]

### User Story 4 - Interior props (Priority: P2)
Procedural pallet racks (two back-to-back double rows and a single row, aisles 3.3 m) plus 25 GLB prop kinds (Poly Haven CC0 and four Sketchfab CC-BY models) in zones: racks, workshop, floor stacks, under the mezzanine, mezzanine office; 13 hanging lamps. Instanced, colliders on large items only.
1. Every prop inside its zone; none on the corridor, stairs, within 1.5 m of an opening or 1.2 m of `supplySpot`; floors items do not overlap; rack aisles at least 3 m; deterministic; the GLB node list equals the placement table. [U `src/structures/warehouseProps.test.ts`, `warehousePropMeshes.test.ts`]
2. How the interior looks (lamp glow, wrap translucency, lighting inside on presets without shadows). [N]

## Requirements
- **FR-001** L-shaped play area, 7 m perimeter wall (colliders plus invisible blocker to 15 m), closed dock, spawn (-15, 29), zones A (z -24..12 yard + warehouse), B (-40..-24 court), C (12..34 apron), D quay. [U `level.test.ts`, `lMap.test.ts`]
- **FR-002** Warehouse shell per the contract `src/config/warehouse.ts`: portal frame, corrugated walls on a 1 m plinth, pitched roof (eave 9 m, ridge 11 m) with skylights, roller door, back door, windows, interior concrete floor. Meshes `structures/warehouse.ts`, pure layout and colliders `warehouseLayout.ts`. [U `warehouse.test.ts`; B doors walked]
- **FR-003** Forced path (User Story 1.1), yard Ducks 1. [U, B]
- **FR-004** Stair, mezzanine, office (User Story 2). [U, B]
- **FR-005** Window frames are open gaps (no glass, no collider). [U gaps; shooting [N]]
- **FR-006** Drone enemy (User Story 3), `DRONE` in `src/enemies/drone/tunables.ts`; shared loader `src/assets/droneAsset.ts`. [U, B]
- **FR-007** Anti-camping call-in. [U timer and caps; B fired]
- **FR-008** Interior props rules (User Story 4); `warehouse.glb` 1.7 MB, 19.2k triangles, built by `tools/asset-pipeline/warehouse_props.py`; procedural box fallback. [U; looks [N]]
- **FR-009** Ammo budget: one extra crate at `WAREHOUSE.supplySpot` (17.5, -20); hits 348 -> 356 (roster 116 + drones 8 + crab 232), supply 540 -> 570, 570 x 0.65 = 370. [U `src/combat/damage.test.ts`]
- **FR-010** Performance: draw calls at most 350, new GLBs about 2 MB in total. [B measured 56 to 151 calls and 0.41 to 0.65 M triangles, `warehouse.glb` 1.7 MB; frame rate [N]]
- **FR-011** All shared warehouse numbers in one contract file `src/config/warehouse.ts` (local numbers in `WAREHOUSE_LOCAL`, `PERIMETER_LOCAL`, `warehousePropsTunables.ts`). [review]
- **FR-012** Ground robots never path into walls or the dock; they enter by the doors, walk under the mezzanine and do not climb the stair. [U nav bake blocks cells outside the L; flood fill]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass: 601 tests at merge, 655 on 2026-11-20. [run 2026-11-20: pass]
- **SC-002** Browser checks by the coordinator after the merge (listed in `tasks.md`, "Coordinator verification"). [B, done]

## Assumptions and open conflicts
- Defaults confirmed by the owner: the warehouse is on the forced path; the L's missing corner is the south-east.
- Owner feedback loops: the jump was lowered to 0.95 m before this work (stair risers 0.18 m rely on it), which removed two container-top supplies (moved to the ground; the yard medkit went to the mezzanine deck); the interior floor was re-textured with CC0 `concrete_floor_worn_001` (`ed0fdf2`); outdoor ground maps and road markings followed (DEVIATIONS, not part of this spec).
- **Contract conflicts, kept as in the contract and never resolved**: the back door (4.5 m) is taller than the clear height under the mezzanine deck (3.4 m), so the deck crosses the doorway top (clear height about 3.3 m); window `win-n1` overlaps the back door's x range (handled by cutting walls per strip). The coordinator may lower the door to about 3.2 m or move `win-n1` east.
- Wave 2 stays out of scope: interior lighting polish, scripted events (alarm, falling containers), grenades. Ambient warehouse creaks came with spec 32.
- Not verified: frame rate on a real GPU, balance, interior look and darkness on presets without shadows, robots navigating the aisles and fighting at the gates, shooting through windows, drone glow near the camera, medium/high presets, smoke/e2e (skipped).
