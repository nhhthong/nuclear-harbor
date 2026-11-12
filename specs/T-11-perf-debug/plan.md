# Implementation Plan: T-11 perf monitor

**Spec**: [spec.md](spec.md) | **Ticket**: docs/tickets/T-11-perf-debug.md

## Technical Context
TypeScript strict, three.js, Rapier via `ctx.physics`. Owns only `src/debug/**`, its e2e and this folder.

## Constitution Check
- I Performance: sampler allocation-free (Float64Array ring buffer, reused snapshot object); DOM refresh 4 Hz; collider buffer reused.
- II Contracts: only `GameContext`; no cross-feature imports.
- III Tunables: budgets from `PERFORMANCE`; local numbers in `src/debug/tunables.ts`.
- IV Tests: pure logic unit tested; e2e in browser.
- V Ownership: no foundation edits; no requests needed.
- VI Offline: no deps, no assets.

## Structure
```
src/debug/
  tunables.ts     local constants
  FrameStats.ts   ring buffer -> fps/avg/1% low/max
  budgets.ts      evaluateBudgets, LowFpsTracker
  benchmark.ts    summarise(samples) -> BenchmarkReport
  snapshot.ts     PerfSnapshot + collectSnapshot(ctx, out)
  Overlay.ts      DOM view
  ColliderView.ts LineSegments wireframe
  index.ts        createDebugModule
```

## Design notes
- Own rAF sampler: dt between callbacks -> FrameStats; reads `webgl.info` (previous frame values).
- Snapshot built at 4 Hz (and on demand via hook). Benchmark stores per-frame scalars in growable Float64Arrays.
- Collider view refreshes `world.debugRender()` at a low rate into a grown Float32Array; grappleable colliders are coloured by iterating colliders and reading meta.
