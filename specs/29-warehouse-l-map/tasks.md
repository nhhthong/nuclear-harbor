# Tasks: spec 29

## Setup
- [x] T001 Shared contract `src/config/warehouse.ts`, spec, plan, checklist (coordinator)

## Stream A: layout and shell
- [x] T010 L-shaped level: zones, spawn (-15, 29), KEEP_CLEAR, perimeter wall 7 m, closed loading dock
- [x] T011 Container yard in the west leg only, north container wall without gaps
- [x] T012 Warehouse shell: frame, walls, roof, skylights, roller door, back door, windows
- [x] T013 Stair, mezzanine with railings, glazed office; colliders; walkable with the current jump
- [x] T014 Interior floor material (no sky reflection) and basic lamps
- [x] T015 Nav bake, spawn posts, distribution, pickups and shelters out of the warehouse block
- [x] T016 Tests: forced path, stairs reachability, corridor free, nothing in the dock

## Stream B: flying drone
- [x] T020 Shared drone asset loader (boss and enemy)
- [x] T021 `src/enemies/drone/`: flight steering, wall avoidance, opening waypoints, attack
- [x] T022 Anti-camping call-in for the mezzanine; roster tunables; radar; audio and VFX
- [x] T023 Extra ammo crate at `WAREHOUSE.supplySpot`; ammo budget test updated
- [x] T024 Tests: steering maths, opening selection, no pass through walls, budget

## Stream C: interior props
- [x] T030 Download and build `public/assets/props/warehouse.glb` (CC0/CC-BY, 512 px, decimated)
- [x] T031 Procedural pallet racks with loaded pallets
- [x] T032 `src/structures/warehouseProps.ts`: instanced placement inside prop zones, colliders
- [x] T033 Tests: inside zones, off corridor/stairs/openings/supply spot; credits in three places

## Merge and verify (coordinator)
- [x] T040 Merge streams, resolve conflicts, `npx tsc --noEmit && npm test && npm run build`
- [x] T041 Browser checks on the low preset: path walk, mezzanine shots, drones, props, draw calls, console
- [x] T042 Docs: DEVIATIONS, ASSETS, CREDITS, README, CLAUDE.md, specs/README

## Coordinator verification (2026-11-19)
- Merge of streams A, B, C: two conflicts (DEVIATIONS, structures/index.ts); one set of high-bay lamps kept (interior props), the shell keeps the small lamps under the mezzanine.
- `npx tsc --noEmit`, `npm test` (601 passed, 0 skipped), `npm run build`: pass.
- Browser, low preset, software GL, simulation stepped by script: stair climbed to the deck (y 3.62); the railing stops a walk off the deck edge; the container wall stops a walk north at x -10; roller door -> corridor -> back door -> court and back works; two drones spawned outside entered (roller door and north openings) and reached the player on the mezzanine within 6 s, the anti-camping call-in fired after 8 s (2 drones, cap held); no console errors; draw calls 56 to 151 (budget 350), triangles 0.41 to 0.65 M.
- Not verified: frame rate on a real GPU; balance; the large pale glow when a drone charges a shot very close to the camera; smoke/e2e (skipped).
