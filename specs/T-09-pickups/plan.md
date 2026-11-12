# Implementation Plan: Pickups

**Spec**: spec.md | **Owner folder**: `src/pickups/**`

## Technical context
TypeScript strict, three.js InstancedMesh, `ObjectPool`, `ctx.physics.raycast` with `QueryGroups.worldOnly`.
Tunables from `ECONOMY`; local numbers in `src/pickups/tunables.ts`.

## Constitution check
Tunables in config (yes), pooling for drops (yes), ResourceTracker scope + event unsubscription (yes),
no cross-module imports (events only), no new deps/assets (procedural geometry), sandbox fixture (yes).

## Structure
- `logic.ts` pure: `collect`, `shouldDrop`, `dropBlinkVisible`, `findRestingSpot`, `supplyBudget`.
- `placements.ts` candidate data (zones A-D + boss ring), `buildBossRing`.
- `visuals.ts` shared geometry/materials + `PickupRenderer` (2 InstancedMesh, compacted every frame).
- `index.ts` module: events, collection loop, drops, test hooks.
- `tunables.ts` local constants (verticalReach 1.5, hover, bob, spin, blink window 5 s, ray start y 40).
- Tests: `logic.test.ts`, `placements.test.ts`; `tests/e2e/T-09-pickups.e2e.mjs`.

## Foundation requests
None.
