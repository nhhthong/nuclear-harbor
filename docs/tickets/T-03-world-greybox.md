# T-03 — Harbor world greybox (ground, containers, warehouse, dock, ocean, lighting)

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 7.1, 7.2, 7.3, 7.5, 6.3 (level design requirement), 13.3, 13.6, 16 World |
| Spec dir | `specs/T-03-world-greybox/` |

## Goal

Build the static harbor to the level contract in `src/config/level.ts`: ground for the four zones, the container field generated on a grid with `InstancedMesh` and merged box colliders, the warehouse and control-center shells, dock edge, a simple ocean shader, the static cargo ship backdrop, morning sun, sky and fog.

## Files owned (exclusive)

- `src/world/**` (replace `src/world/index.ts`; keep `createWorldModule` and id `world`)
- `tests/e2e/T-03-world-greybox.e2e.mjs` (browser check, optional but recommended)
- `specs/T-03-world-greybox/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox` — return early from `init` when `ctx.flags.sandbox` is true
- `@/config/level`: `LAND`, `ZONES`, `WAREHOUSE_FOOTPRINT`, `CONTROL_CENTER_FOOTPRINT`, `KEEP_CLEAR` / `isKeepClear`, `BOSS_ARENA`, `SHIP_BACKDROP`, `SEA_LEVEL_Y`, `DOCK_EDGE_Z`
- `WORLD`, `PERFORMANCE.quality`, `CHARGER_ROBOT.maxChargeDistance` tunables
- `ctx.physics.addStaticBox({ center, halfExtents, yaw?, meta })` (meta `{ kind: 'static', grappleable: true }` for top-tier containers)
- `ctx.grappleAnchors.add()` for container-top anchors; events in: `settings:changed` (quality → shadow map size)

## Interfaces provided

- Static colliders for all walkable ground, containers, building walls; set `ctx.scene.userData.hasWorldLighting = true`
- Grappleable top-tier containers (collider flag + one `container-top` anchor per stack) per GDD 7.4/7.5
- Sun `DirectionalLight` (the only shadow-casting light), hemisphere fill, sky colour, fog
- `ctx.testHooks.world = { containerCount, colliderCount, lanes: [...] }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-03-world-greybox
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-03-world-greybox/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-03-world-greybox/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure generator first (`src/world/containerLayout.ts` + tests): given zone A bounds, block/row/tier parameters and a seeded RNG, return container instances `{ x, y, z, yaw, colorIndex, tier, isTop }` plus merged collider boxes (one box per contiguous row/stack run). It must skip `isKeepClear` discs and reserve at least three straight Charger lanes ≥ 30 m long and ≥ 6 m wide (GDD 6.3), returned as `lanes` for tests and T-16.
2. Render containers with ONE `InstancedMesh` (box geometry sized `WORLD.container`) and `instanceColor`; a few muted colours. Target 250-400 containers in zone A, plus sparse cover clusters in B and D outside keep-clear discs. Stacks are 1-3 high (`WORLD.maxContainerStack`).
3. Colliders: merged boxes from the generator (far fewer colliders than containers). Top tier boxes carry `grappleable: true` (use a separate collider for the top tier of a stack when lower tiers are not grappleable). Register one `container-top` anchor per stack top (position at the top edge centre).
4. Ground: one large slab collider for the land (top at y = 0) with a concrete material (procedural canvas texture: subtle noise + painted lane lines is enough); a 1 m high kerb/bollard line is NOT added at the dock edge (the Charger must detect the edge itself), but add a thin visual quay edge.
5. Warehouse (zone C): hollow shell from boxes at `WAREHOUSE_FOOTPRINT` with door openings ≥ 5 m wide on the south and north walls, interior shelving rows forming at least one corridor ≥ 30 m long (Charger), a roof, dim interior. Tower 1 position must stay reachable and clear.
6. Control center (zone D): simple two-box building at `CONTROL_CENTER_FOOTPRINT` with collider; not enterable.
7. Ocean: large plane at `SEA_LEVEL_Y` with a small custom `ShaderMaterial` (two scrolling sine waves displacing normals, fresnel-ish colour blend). No reflections (cut list 1). Add a time uniform updated in `update`.
8. Ship backdrop: low-poly hull + stacked box "containers" at `SHIP_BACKDROP`, no collider, no AI, single merged geometry.
9. Lighting: sun at `WORLD.sunElevationDeg/sunAzimuthDeg` (07:00, long shadows), warm colour, hemisphere fill, fog from tunables, sky gradient background (canvas texture or shader dome). Shadow camera covers the land once; shadow map size from the quality preset; react to `settings:changed`.
10. Set `scene.userData.hasWorldLighting = true` in `init` so the foundation fallback light is skipped.
11. Track everything with the `world` ResourceTracker scope; dispose removes meshes, colliders and anchors.
12. e2e: boot `/?autostart`, assert no console errors, `colliderCount` and instance count within the expected ranges, a downward ray at the spawn hits ground at y = 0, and draw calls stay below 60 for this module alone.

## Acceptance criteria

- [ ] **AC1** All four zones have walkable ground matching `ZONES`; nothing solid is placed inside any `KEEP_CLEAR` disc below 9 m.
- [ ] **AC2** Containers are generated from grid parameters by a deterministic, unit-tested function and rendered with a single `InstancedMesh` using `instanceColor`.
- [ ] **AC3** Container collision uses merged box colliders (collider count ≤ 40% of container count); no mesh colliders exist.
- [ ] **AC4** Zone A contains at least three straight lanes ≥ 30 m long and ≥ 6 m wide, verified by a unit test on the generator output; the warehouse has one corridor ≥ 30 m.
- [ ] **AC5** Top-tier containers are grappleable (collider meta) and each stack registers a `container-top` anchor.
- [ ] **AC6** The warehouse can be entered and crossed on foot; the control center and warehouse walls block movement and bullets.
- [ ] **AC7** An animated ocean plane, the static cargo ship, morning sun with shadows, sky and fog are visible; the ship has no collider.
- [ ] **AC8** The module builds nothing in `?sandbox`; in the harbor the whole module costs ≤ 60 draw calls.
- [ ] **AC9** `dispose()` removes all meshes, colliders, anchors and listeners (resource scope count returns to 0).

## Notes

Cranes, lamp posts, perches and the tower-3 platform are T-04: leave their keep-clear discs empty. Robots, towers and pickups are placed by other tickets relative to `level.ts`, so do not move zone bounds; if the contract must change, write a foundation request.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-03
# manual: npm run dev → http://localhost:5173/?autostart  (placeholder camera flies; W/S along the view)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
