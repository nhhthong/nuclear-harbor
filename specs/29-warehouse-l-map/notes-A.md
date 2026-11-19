# Stream A notes (layout and warehouse shell, T010 to T016)

## Built
- `src/config/level.ts`: L play area (`PLAY_AREA`, `YARD_RECT`, `isInPlayArea`, `isInWarehouse`, `isInClosedBlock`), `zoneAt`/`isOnLand` return null/false in the closed loading dock, zones A z -24..12 (yard + warehouse), B -40..-24, C 12..34, D unchanged; spawn = `SPAWN_L`; `fromLegacyZ` frozen to the old 122 m frame; KEEP_CLEAR gets a disc in front of the back door; new `ENEMY_DISTRIBUTION` (totals unchanged); ASCII map updated.
- `src/world/containerLayout.ts` + `tunables.ts`: yard = west leg only (lanes x -15 and 2, aisle z -4 to the roller door), north container wall (2 high, continuous collider, blocker to 15 m), court reserve in front of the back door.
- `src/world/perimeter.ts` (pure), `perimeterModel.ts` (3 instanced meshes), wired in `src/world/index.ts`; `barriers.ts` keeps the visible kerb on the quay edge only.
- `src/structures/warehouseLayout.ts` (pure layout + every collider), `warehouse.ts` (meshes), wired in `src/structures/index.ts` (fence removed).
- `src/physics/PhysicsWorld.ts`: `addStaticBox({ rotation })` (quaternion) for the stair ramp and roof planes.
- `src/enemies/nav/bakeNav.ts`: cells outside the L are blocked.
- Positions moved out of the closed block / container wall / warehouse: population posts (`src/enemies/population.ts`, `FALLBACK_LANES`, 1 yard Duck), pickups, 2 shelters, flood-light masts gate-e and yard-e, props, vehicles, dressing.
- Tests: `src/structures/warehouse.test.ts`, `src/world/lMap.test.ts` (Rapier: nav flood fill forced path, KCC stair climb, railing), plus updated level, containerLayout tests.

## Numbers
- No contract number changed. Conflicts kept as they are: the back door (4.5 m) is taller than the clear height under the mezzanine deck (3.4 m), so the deck crosses the doorway top; `win-n1` overlaps the back door's x range (handled by cutting walls per strip). The coordinator may want to lower the back door to about 3.2 m or move `win-n1` east in the contract.
- Local numbers live in `WAREHOUSE_LOCAL` (frame lines, mezzanine columns, railings, office door at z -19 in the office west wall, bollards, lamps) and `PERIMETER_LOCAL`.

## Not done / for the coordinator
- No browser check (per rules). Look at: spawn (-15, 29) view north; the roller door from (2, -4); inside at (14, -6) looking north (corridor, stair at x 9.4..11); stair top (10.2, 3.6, -18); mezzanine windows from (17, 3.6, -22) and office from (28, 3.6, -20); back door from the court (14, -30); perimeter wall corners at (6, 12) and (36, -24); container wall seen from the court.
- Interior darkness relies on the sun shadow of the roof; on presets with shadows off the interior may look as bright as outside.
- Drone stream: the yard container wall and the perimeter wall have invisible blockers up to 15 m; the warehouse roof is a real collider (two pitched slabs) plus an invisible parapet above the west eave (y 9..15).
- Ground lane markings (shader) still follow the old dashed line at z = yard maxZ + 4.5 across the full width (hidden behind the dock wall in the closed part).
- `STRUCTURES.fenceHeight` and `buildFence` are now unused.
