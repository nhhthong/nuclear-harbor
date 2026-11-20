# Feature Specification: World dressing, fewer supplies, cold overcast mood

**Feature**: `25-world-dressing-and-mood` | **Created**: 2026-11-17 | **Status**: Implemented and merged (PR #11, with spec 24; vehicles reworked in PR #13); not played on a real GPU
**Input**: owner requests, in order: more vehicles and props to make the level livelier (parked and overturned vehicles); fewer ammo and medkit pickups; free realistic props from the internet (electric cabinets, concrete, water tanks...); a gloomy, cold, Dark-Souls-like mood at moderate brightness.
**Process**: coordinator, single agent, on the dev branch `claude/wizardly-cori-697x6r`; spec written with the implementation, not by running the skills in order. Owner feedback loops that changed it: burning overturned wrecks were built and removed ("not pretty", commits `c606048`, `db8b7ca`); the mood was tuned three times (too dark, then moderate); the low-poly vehicles were replaced by Sketchfab CC-BY models in PR #13 (`5c77a38`, `024b646`). Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, scripted screenshots), `[N]` not verified.

## User Scenarios & Testing

### User Story 1 - A living terminal (Priority: P1)
The apron, relay court and quay are dressed with vehicles and industrial clutter that block lines of sight and give cover.

**Acceptance**
1. 12 parked vehicles (`VEHICLES`: sedan, hatchback, SUV, 2 vans, 2 pickups, 2 semis, truck, forklift, mobile crane truck on the quay) in the car parks, at the gate, on the court edge and on the quay (11 at the first version; the crane truck came with PR #13; the east car park and the semi were moved by spec 29). [U `src/structures/vehicles.test.ts`]
2. Clutter (`DRESSING`, 51 items now: cabinets, switchgear, barrier walls, barrels, tyre and pallet stacks, generators, work lights, cable drums, dumpsters, portable toilets, cement mixer, gas cylinders, water towers). It was "about 70" when this spec shipped; spec 29 dropped east items that fell in the closed loading dock; the 70 was not re-derived. [U `dressing.test.ts`]
3. Every item has an axis-aligned collider; none overlaps a container, prop, mast, crane leg, safe container (and its door apron), supply spot, Duck lane, keep-clear disc or robot post/patrol point. [U `vehicles.test.ts`, `dressing.test.ts`]
4. If a GLB fails to load, boxes of the same size stand in; colliders are unchanged. [U `vehicleModels.test.ts`, `dressingModels.test.ts`]
5. Screenshots of every dressed area show vehicles and clutter in place, no console errors. [B, done 2026-11-17/18; frame rate with all instances [N]]

### User Story 2 - Scarce supplies (Priority: P1)
**Acceptance** (numbers as of this spec, then as they stand)
1. At this spec: zone crates 10 -> 7, zone medkits 4 -> 2, boss-ring crates 6 -> 4, boss-ring medkits 2 -> 1; enemy ammo drop 15% -> 10%, at most one drop per zone; ammo budget test re-based on 65% accuracy, supply 540 against 345 hits. [U `src/combat/damage.test.ts`, `src/pickups/placements.test.ts`]
2. Now (`ECONOMY`): 8 zone crates (spec 29 added one at `WAREHOUSE.supplySpot`), 4 boss crates, 2 + 1 medkits, drop 10%, one drop per zone; supply 570, hits needed 356 (roster 116 + 4 roster drones 8 + crab 232): 570 x 0.65 = 370, margin 14. [U `damage.test.ts`]
3. No supply sits on a one-high container top (lowered double jump, 2026-11-19: two supplies moved to the ground). [U `placements.test.ts`]

### User Story 3 - Cold, gloomy mood (Priority: P2)
Heavy overcast, pale sun smear, grey-blue haze, desaturated cold grade, moderate brightness; warm lamps stay the only warm colour.

**Acceptance**: low-preset screenshots read as overcast and cold at moderate brightness. [B, subjective, tuned three times by owner feedback]. No automatic check exists. [N for other presets, for bloom and for a real GPU]

## Requirements
- **FR-001** Vehicles and clutter are pure data in `src/structures/layout.ts` (kind, position, yaw, tint/jitter, collider) drawn by instanced meshes, one draw call per kind and material: `vehicles.ts` (textured PBR GLB, per-instance tint on the car paint only) and `dressing.ts` (PBR GLBs). [U `vehicleModels.test.ts`, `dressingModels.test.ts`; B]
- **FR-002** Models: `public/assets/props/vehicles.glb` (5.5 MB, 6 MB budget in `vehicleModels.test.ts`, built by `tools/asset-pipeline/vehicles_sf.py` from CC-BY Sketchfab models), `industrial.glb` (1.8 MB, Poly Haven CC0, `industrial.py`) and `terminal.glb` (2.2 MB, 3DModelsCC0 CC0, `terminal.py`; 2.5 MB budget per file in `dressingModels.test.ts`). Only CC0 and CC-BY; provenance in `docs/ASSETS.md`, `CREDITS.md`, in-game Credits. [U model sizes vs colliders; credits test `src/ui/credits.test.ts`]
- **FR-003** Colliders are axis-aligned (yaw multiples of PI/2); `jitter` turns only the visual. [U `vehicles.test.ts`, `dressing.test.ts`]
- **FR-004** Mood numbers live in `WORLD_LOCAL.sky/sun/hemi` and `PERFORMANCE.grade` (incl. `desaturate` 0.25); `uCover`, `uCloudLit`, `uCloudShade` drive the sky shader. [B screenshots only; no test]
- **FR-005** No new runtime dependency, no per-frame allocation; the service worker precaches the GLBs (checked in the build output: `sw.js` lists them, 101 entries on 2026-11-20). [N for allocation; build output for precache]
- **FR-006** Supply numbers in `ECONOMY` and `pickups/placements.ts` as in User Story 2. [U]
- **FR-007** Fallback boxes when a GLB fails (User Story 1.4). [U]
- **FR-008** Placement rules (User Story 1.3) hold for every item, enforced by tests. [U]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (463 tests when this shipped; 655 on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** Scripted screenshots of every dressed area and of the overcast look, no console errors. [B, done]

## Assumptions
- Burning wrecks were tried (procedural flame shader, smoke via `vfx:spawn`) and removed; no trace remains in the code.
- The container yard (robot routes) is not dressed here; spec 29 rebuilt the yard (west leg only).
- Sketchfab models are fetched through the Sketchfab download API (licence checked per uid); the first version assumed they were out of scope for lack of a token. They were used from PR #13 on (vehicles) and in specs 26 to 29.
- Some menu texts still say "sunset" or "dusk"; not changed.
- Not verified: frame rate with this many instances on a real GPU, balance with the smaller supply, a full run, medium/high presets for the mood.
