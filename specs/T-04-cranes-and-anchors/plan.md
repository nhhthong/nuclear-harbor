# Implementation Plan: T-04 Cranes, perches, lamp posts, anchors

**Spec**: `spec.md` | **Owns**: `src/structures/**`, `tests/e2e/T-04-*.e2e.mjs`, this folder.

## Summary
Pure layout builders (no three.js scene) produce world-space boxes + anchors; a thin module builds
meshes (InstancedMesh, shared BoxGeometry/materials), colliders and anchors from them.

## Technical context
TypeScript strict, three 0.187, Rapier via `ctx.physics.addStaticBox`, Vitest (node).

## Constitution check
- I Performance: instanced boxes, 2-3 shared materials, LOD, <= 40 draw calls, no per-frame work.
- II Contracts: only `GameContext`, `@/config/*`, `@/core/types`; no foundation edits.
- III Tunables: local numbers in `src/structures/tunables.ts`; level data from `@/config/level`.
- IV Tests: pure layout/coverage unit tests first; e2e in browser.
- V Ownership: only owned paths touched. VI: dispose removes meshes, colliders, anchors, DOM.

## Structure
```text
src/structures/
  tunables.ts      local dimensions
  boxes.ts         StructureBox / AnchorSpec types, yaw transform
  craneLayout.ts   craneLocalParts(), placeCrane(site) -> boxes + anchors
  perchLayout.ts   perch tower, boss-arena perches, tower-3 platform
  lampLayout.ts    lamp grid + greedy fill
  coverage.ts      sampleWalkable(), checkCoverage()
  *.test.ts        unit tests
  debugView.ts     ?anchors overlay
  index.ts         createStructuresModule
tests/e2e/T-04-cranes-and-anchors.e2e.mjs
```

## Decisions
- Crane local frame: portal 16 x 10 m footprint, legs 24 m, boom along local +Z at y 26.
  Footprint corner distance * scale < 14 m (unit-tested).
- Instances are positioned in crane-local space; the `LOD` object carries site position/yaw/scale.
- Perch anchor copies the sandbox pattern: mast at inner edge, anchor 2.2 m above slab, landing at slab centre.
- Perch towers sit on a circle of radius 34 m around the arena, at angles that stay on land;
  heights cycle 8/14/20.
