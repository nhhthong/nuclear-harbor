# Implementation Plan: Harbor world greybox (T-03)

**Spec**: [spec.md](spec.md) | **Constitution**: v1.0.0

## Technical context
TypeScript strict, three.js 0.187, Rapier via `ctx.physics.addStaticBox`. Owned: `src/world/**`, e2e file, this folder.

## Constitution check
- I Performance: one InstancedMesh for containers, merged boxes, merged ship geometry, shared materials, ResourceTracker scope `world`, no per-frame allocation (time uniform only).
- II Contracts: only `GameContext`; no cross-feature imports. III Tunables: local numbers in `src/world/tunables.ts`, shared ones from `@/config`.
- IV Tests: generator and building layout are pure and unit-tested first.

## Structure
```
src/world/
  tunables.ts         feature-local numbers
  rng.ts              mulberry32
  containerLayout.ts  pure generator: instances, boxes, stackTops, lanes
  buildings.ts        pure box lists: warehouse walls/roof/shelves, control center
  *.test.ts
  textures.ts ocean.ts ship.ts lighting.ts
  index.ts            module wiring
```

## Design
- Zone A: grid of blocks. Explicit free lanes (3 N-S lanes 6+ m wide spanning the zone, plus E-W aisles); blocks fill space between lanes in rows of containers (length along X), stacks 1-3 high.
- Collider merging: per row, runs of adjacent equal-height stacks yield one lower box (tiers below top, non-grappleable) and one top box (grappleable). One anchor per stack.
- Keep-clear: stack footprints intersecting `isKeepClear` are dropped.
- B and D: seeded sparse clusters outside keep-clear discs and the dock edge / control center.
- Warehouse: wall boxes with door gaps, roof slab, shelf rows leaving a long corridor; Tower 1 clear.
