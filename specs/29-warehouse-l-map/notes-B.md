# Stream B notes: flying drone (T020 to T024)

## Done
- T020 `src/assets/droneAsset.ts`: one cached load of `dragonfly-drone.glb` (`loadDroneAsset`, `loadedDroneAsset`), `droneFrom`, procedural fallback geometry/material. `src/boss/crabAssets.ts` re-exports `droneFrom`/`DroneAssets` and loads the dragonfly through it; `CRAB.droneUrl = DRONE_ASSET_URL`. Boss tests unchanged and passing.
- T021 `src/enemies/drone/`: `Drone.ts` (BaseEnemy subclass, overrides `step`, no nav), `steering.ts` (pure: avoidance with side memory, clampStep, altitude band, stand-off, resolveTarget, keepOutOf, StuckMonitor), `openings.ts` (pure: inside test, usable openings, route), `wrecks.ts` (falling wreck), `tunables.ts` (`DRONE`, `DRONE_NO_FLY`). `EnemyProjectiles.fire(..., 'plasma')` gives the boss bolt look.
- T022 `callIn.ts` + `EnemyManager` (separate block): anti-camping director, spawn points outside windows / roller door, live cap. Roster `DRONE_POSTS`/`droneRoster()` (separate block at the end of `population.ts`), appended in `EnemyManager.start`. Radar icon (`hud.ts`), `ENEMY_VARIANT.drone` (`eventMap.ts`). `areaSpawner` gained an optional `externalLive` count.
- T023 `ECONOMY.ammoCratesInZones` 7 -> 8, crate appended at `WAREHOUSE.supplySpot` (castFromY 3.0); budget tests 356 hits / 570 supply.
- T024 tests: `steering.test.ts`, `openings.test.ts`, `Drone.test.ts`, budget in `damage.test.ts` and `placements.test.ts`.

## For the merge (coordinator)
- `placements.test.ts`: the indoor-supply check is `skipIf` while the old container layout still has stacks inside the warehouse footprint; after stream A it runs (it ignores boxes whose bottom is above the crate's ray start, i.e. the mezzanine).
- `ENEMY_COUNTS.total` stays the ground roster (level/population tests sum five types); drones are `ENEMY_COUNTS.drone`.
- The drone posts are checked against both spawns (old (0, 29) and `SPAWN_L`); if stream A moves zones, roster drones are assigned by `zoneAt(...) ?? 'A'`.
- Drones skip opening routes in the sandbox (no warehouse there).
- Headless tests must not call `physics.syncQueries()` every tick with live kinematic bodies (a zero-dt step breaks the query pipeline); the game steps with a real dt.

## Browser checks
- `ctx.testHooks.enemies.spawn('drone', {x: 0, z: -10})` (hunter: no patrol), `spawn('drone', {x, z}, [{x, z}, ...])` (patroller), `?sandbox&enemies=drone`.
- `ctx.testHooks.enemies.callInDrones(2)` spawns call-ins at once; `callIn()` -> `{camp, called, alive}`; natural trigger: stand on the mezzanine 8 s.
- `ctx.testHooks.enemies.droneModel()` -> GLB loaded.
- Watch: drones entering through the roller door / north windows / back door, never clipping walls or the roof, the drones' crate under the mezzanine, draw calls (one mesh per drone + glow).
