# Feature Specification: Harbor world greybox (T-03)

**Input**: `docs/tickets/T-03-world-greybox.md`, GDD 7.1-7.3, 7.5, 6.3, 13.3, 13.6.

## User scenarios
- **P1 Explore the harbor**: the player spawns at (0,0,96), walks across concrete ground in all four zones,
  through a warehouse, between container rows, and sees sea, ship, sun, sky, fog.
- **P1 Cover and lanes**: containers block movement and bullets; zone A has long straight lanes for Chargers (GDD 6.3).
- **P2 Grapple targets**: each container stack top is grappleable and has a `container-top` anchor (GDD 7.4/7.5).

## Requirements
- FR-1 Ground slab collider (top y=0) over `LAND`; concrete procedural texture; thin visual quay edge, no kerb collider.
- FR-2 Pure deterministic `generateContainerLayout` (seeded RNG): grid blocks in zone A (250-400 containers), sparse clusters in B and D;
  skips `isKeepClear` discs; returns instances `{x,y,z,yaw,colorIndex,tier,isTop}`, merged collider boxes, stack tops, `lanes`.
- FR-3 One `InstancedMesh` with `instanceColor` for all containers; colliders merged (<= 40% of container count); no mesh colliders.
- FR-4 >= 3 straight lanes in zone A, each >= 30 m long and >= 6 m wide, free of containers (unit-tested).
- FR-5 Top-tier collider `grappleable: true`; one `container-top` anchor per stack.
- FR-6 Warehouse shell at `WAREHOUSE_FOOTPRINT`: doors >= 5 m wide on south and north walls, roof, shelving with a corridor >= 30 m, tower-1 area clear; control center two-box building with collider.
- FR-7 Ocean plane (ShaderMaterial, time uniform), static ship backdrop (single merged geometry, no collider).
- FR-8 Sun DirectionalLight (only shadow caster, size from quality, reacts to `settings:changed`), hemisphere light, sky gradient, fog; `scene.userData.hasWorldLighting = true`.
- FR-9 `ctx.testHooks.world = { containerCount, colliderCount, lanes }`. Nothing built under `?sandbox`.
- FR-10 `dispose()` removes meshes, colliders, anchors, listeners; module <= 60 draw calls.

## Assumptions
- Lane minimum length is the ticket's 30 m (feature-local tunable; `WORLD.chargerLaneWidth` = 6 reused).
- Static shadows: shadow map refreshed on build and on quality change.
- Cranes, lamps, perches, tower-3 platform are T-04 (keep-clear discs left empty).

## Success criteria
AC1-AC9 of the ticket; verified by `src/world/*.test.ts` (generator, building layout) and `tests/e2e/T-03-world-greybox.e2e.mjs`.
