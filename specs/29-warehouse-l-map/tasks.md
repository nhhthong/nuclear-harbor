# Tasks: spec 29

## Setup
- [x] T001 Shared contract `src/config/warehouse.ts`, spec, plan, checklist (coordinator)

## Stream A: layout and shell
- [ ] T010 L-shaped level: zones, spawn (-15, 29), KEEP_CLEAR, perimeter wall 7 m, closed loading dock
- [ ] T011 Container yard in the west leg only, north container wall without gaps
- [ ] T012 Warehouse shell: frame, walls, roof, skylights, roller door, back door, windows
- [ ] T013 Stair, mezzanine with railings, glazed office; colliders; walkable with the current jump
- [ ] T014 Interior floor material (no sky reflection) and basic lamps
- [ ] T015 Nav bake, spawn posts, distribution, pickups and shelters out of the warehouse block
- [ ] T016 Tests: forced path, stairs reachability, corridor free, nothing in the dock

## Stream B: flying drone
- [ ] T020 Shared drone asset loader (boss and enemy)
- [ ] T021 `src/enemies/drone/`: flight steering, wall avoidance, opening waypoints, attack
- [ ] T022 Anti-camping call-in for the mezzanine; roster tunables; radar; audio and VFX
- [ ] T023 Extra ammo crate at `WAREHOUSE.supplySpot`; ammo budget test updated
- [ ] T024 Tests: steering maths, opening selection, no pass through walls, budget

## Stream C: interior props
- [ ] T030 Download and build `public/assets/props/warehouse.glb` (CC0/CC-BY, 512 px, decimated)
- [ ] T031 Procedural pallet racks with loaded pallets
- [ ] T032 `src/structures/warehouseProps.ts`: instanced placement inside prop zones, colliders
- [ ] T033 Tests: inside zones, off corridor/stairs/openings/supply spot; credits in three places

## Merge and verify (coordinator)
- [ ] T040 Merge streams, resolve conflicts, `npx tsc --noEmit && npm test && npm run build`
- [ ] T041 Browser checks on the low preset: path walk, mezzanine shots, drones, props, draw calls, console
- [ ] T042 Docs: DEVIATIONS, ASSETS, CREDITS, README, CLAUDE.md, specs/README
