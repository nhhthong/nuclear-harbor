# Tasks: spec 29

## Setup
- [x] T001 [FR-011] Shared contract `src/config/warehouse.ts`, spec, plan, checklist (coordinator, before any code)

## Stream A: layout and shell (sub-agent worktree)
- [x] T010 [FR-001] L-shaped level: zones, spawn (-15, 29), KEEP_CLEAR, perimeter wall 7 m, closed loading dock
- [x] T011 [FR-003] Container yard in the west leg only, north container wall without gaps
- [x] T012 [FR-002, FR-005] Warehouse shell: frame, walls, roof, skylights, roller door, back door, windows
- [x] T013 [FR-004] Stair, mezzanine with railings, glazed office; colliders; walkable with the current jump
- [x] T014 [FR-002] Interior floor material (no sky reflection) and basic lamps
- [x] T015 [FR-012] Nav bake, spawn posts, distribution, pickups and shelters out of the warehouse block
- [x] T016 [FR-001, FR-003, FR-004, FR-012] Tests: forced path, stairs reachability, corridor free, nothing in the dock (`lMap.test.ts`, `warehouse.test.ts`, `level.test.ts`)

## Stream B: flying drone (sub-agent worktree)
- [x] T020 [FR-006] Shared drone asset loader (boss and enemy)
- [x] T021 [FR-006] `src/enemies/drone/`: flight steering, wall avoidance, opening waypoints, attack
- [x] T022 [FR-006, FR-007] Anti-camping call-in for the mezzanine; roster tunables; radar; audio and VFX
- [x] T023 [FR-009] Extra ammo crate at `WAREHOUSE.supplySpot`; ammo budget test updated (356 vs 570)
- [x] T024 [FR-006, FR-007] Tests: steering maths, opening selection, no pass through walls, call-in, budget

## Stream C: interior props (sub-agent worktree)
- [x] T030 [FR-008] Download and build `public/assets/props/warehouse.glb` (CC0/CC-BY, 512 px, decimated, 1.7 MB)
- [x] T031 [FR-008] Procedural pallet racks with loaded pallets
- [x] T032 [FR-008] `src/structures/warehouseProps.ts`: instanced placement inside prop zones, colliders
- [x] T033 [FR-008] Tests: inside zones, off corridor/stairs/openings/supply spot; credits in `credits.ts`, `CREDITS.md`, `docs/ASSETS.md`

## Merge and verify (coordinator)
- [x] T040 Merge streams (conflicts: DEVIATIONS, `structures/index.ts`; one set of high-bay lamps kept), `npx tsc --noEmit && npm test && npm run build` (601 tests then; 655 and pass on 2026-11-20)
- [x] T041 [FR-010, SC-002] Browser, low preset, software GL, stepped simulation (2026-11-19), the parts that were done:
  - [x] stair climbed to the deck (y 3.62); the railing stops a walk off the deck edge
  - [x] the container wall stops a walk north at x -10; roller door -> corridor -> back door -> court and back works
  - [x] two drones spawned outside entered (roller door and north openings) and reached the player on the mezzanine within 6 s; the call-in fired after 8 s (2 drones, cap held)
  - [x] draw calls 56 to 151 (budget 350), triangles 0.41 to 0.65 M; no console errors
- [ ] T043 skipped (the earlier note listed "mezzanine shots" and "props" as checked, but nothing in the record shows them): a shot fired through a mezzanine window into the court; the look of the props and lamps; robots walking the aisles
- [x] T042 Docs: DEVIATIONS, ASSETS, CREDITS, README, CLAUDE.md, specs/README
- [x] T044 Owner feedback: warehouse floor re-textured with CC0 `concrete_floor_worn_001` (`ed0fdf2`), 1k maps precached, flat colour as fallback
- [ ] T045 skipped: back door height vs mezzanine deck and `win-n1` vs door x range (contract conflicts, need an owner or contract decision); drone glow close to the camera; real-GPU frame rate; medium/high presets (open follow-ups in `docs/SPECKIT.md`)
