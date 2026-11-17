# Feature Specification: World dressing, fewer supplies, cold overcast mood

**Feature**: `25-world-dressing-and-mood` | **Created**: 2026-11-17 | **Status**: Implemented (not playtested on a real GPU)
**Input**: owner requests, in order: more vehicles and props to make the level livelier (parked and overturned vehicles); fewer ammo and medkit pickups; free realistic props found on the internet (electric cabinets, concrete, water tanks...); a gloomy, cold, Dark-Souls-like mood at moderate brightness. A first try at burning overturned wrecks was removed again ("not pretty").

## User Scenarios & Testing

### User Story 1 - A living terminal (Priority: P1)
The apron, relay court and quay are dressed with vehicles and industrial clutter that block lines of sight and give cover, instead of empty asphalt.

**Acceptance**
1. 11 parked vehicles (truck, semi, van, pickup, SUV, sedan, hatchback, forklift) stand in two car parks, at the gate and on the quay.
2. About 70 clutter items (cabinets, switchgear, barrier walls, barrels, tyre and pallet stacks, generators, work lights, cable drums, dumpsters, portable toilets, a cement mixer, gas cylinders, two water towers) stand on the apron, court and quay.
3. Every item has a collider; none overlaps a container, prop, mast, crane leg, safe container (and its door apron), supply spot, Duck lane or robot post/patrol point (unit-tested).
4. If a GLB fails to load, boxes of the same size stand in (colliders are unchanged).

### User Story 2 - Scarce supplies (Priority: P1)
Ammo and medkits are rare enough to matter.

**Acceptance**: zone crates 10 -> 7, zone medkits 4 -> 2, boss-ring crates 6 -> 4, boss-ring medkits 2 -> 1; enemy ammo drop chance 15% -> 10%, at most one drop per zone (was two). The ammo budget test is re-based on 65% accuracy (was 50%): supply 540 rounds against 345 needed hits.

### User Story 3 - Cold, gloomy mood (Priority: P2)
Heavy overcast, a pale sun smear, grey-blue haze, a desaturated cold grade; moderate brightness; warm lamps stay as the only warm colour.

## Requirements
- **FR-001** Vehicles and clutter live in `src/structures/layout.ts` (pure data: kind, position, yaw, collider) and are drawn by instanced meshes (one draw call per kind): `vehicles.ts` (vertex-colour GLB, per-instance tint, weathering shader) and `dressing.ts` (PBR GLBs).
- **FR-002** Models: `public/assets/props/vehicles.glb` (0.3 MB), `industrial.glb` (1.8 MB) and `terminal.glb` (2.2 MB), built by `tools/asset-pipeline/{props,industrial,terminal}.py`; only CC0 and CC-BY sources; provenance in `docs/ASSETS.md`; CC-BY authors in the in-game Credits.
- **FR-003** Colliders are axis-aligned (yaw in multiples of PI/2); `jitter` only turns the visual.
- **FR-004** Mood numbers live in `WORLD_LOCAL.sky/sun/hemi` and `PERFORMANCE.grade` (incl. `desaturate`); `uCover`, `uCloudLit`, `uCloudShade` drive the sky shader.
- **FR-005** No new runtime dependency; no per-frame allocation; the service worker precaches the new GLBs.

## Success Criteria
- `npx tsc --noEmit`, unit tests and build pass (463 tests).
- Scripted screenshots of every dressed area and of the overcast look show no console errors (check feel and frame rate on a real GPU).

## Assumptions
- Burning wrecks were tried (procedural flame shader, smoke through `vfx:spawn`) and removed at the owner's request; nothing of them remains in the code.
- The container yard (robot routes) is not dressed; a denser, narrower yard is a separate, later change.
- Sketchfab models (crane truck, utility poles) were out of scope: they need an API token.
- Some ASCII/menu texts still say "sunset" or "dusk"; not changed.
