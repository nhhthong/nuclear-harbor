# Feature Specification: Performance monitor and debug overlay (T-11)

Input: `docs/tickets/T-11-perf-debug.md`, GDD 13.8, 13.9, 16, 15 (M3).

## User Scenarios

1. **Developer checks performance (P1)**: presses F3/Backquote (or loads `?debug`) and sees FPS, frame
   time, draw calls, triangles, GPU and tracked resources, colliders, enemies by sim level, heap.
   Over-budget values are highlighted; sustained FPS below 30 for >2 s raises a warning.
2. **Developer inspects physics (P2)**: F4 or `?colliders` toggles a wireframe of all Rapier colliders,
   grappleable ones in a distinct colour.
3. **Tech lead records the M3 benchmark (P1)**: `?bench=<s>` or `testHooks.debug.startBenchmark(s)` records
   N seconds and prints one `BENCH {json}` console line and shows it on the overlay.
4. **Leak hunting (P2)**: F6 resets a baseline; overlay shows deltas of geometries, textures and tracked
   resources since the reset.

## Requirements

- FR-1 (AC1) Overlay under `ctx.uiRoot`, top-left, monospace, toggled by `debugToggle` codes, on with `?debug`; works in menus (own keydown listener and rAF sampler).
- FR-2 (AC2) Budget evaluation vs `PERFORMANCE` (`maxDrawCalls`, `maxTriangles`, `jsHeapWarnMb`, low FPS > 2 s) flags values.
- FR-3 (AC3) Collider wireframe in one reused, growable `LineSegments`; off by default.
- FR-4 (AC4) Benchmark report: fps avg/min/1% low, frame ms avg/max, max draw calls/triangles, geometries/textures/heap at start and end, enemy counts, info deltas.
- FR-5 (AC5) Resource-delta readout, reset with F6.
- FR-6 (AC6) Hidden: no work beyond the key listener and a lightweight sampler; visible: DOM text refreshed at 4 Hz; no per-frame allocation in the sampler.
- FR-7 (AC7) `FrameStats`, `evaluateBudgets`, `summarise` are pure and unit tested.
- FR-8 (AC8) `dispose()` removes DOM, listeners, rAF, meshes.
- FR-9 `ctx.testHooks.debug = { snapshot, startBenchmark, lastReport }`.
- FR-10 `benchmark-howto.md` documents running the M3 benchmark.

## Assumptions (non-interactive defaults)

- Frame time is sampled from our own rAF loop (independent of game state). `renderer.info` is read in the rAF callback, i.e. the previous frame's values.
- The sampler keeps running while hidden (a few arithmetic ops) so benchmarks and snapshots stay valid; DOM/line work is skipped when hidden.
- Heap reading only where `performance.memory` exists. No FPS assertions in tests (software GL).
- Fixed ticks per second are derived from `ctx.clock.fixedTick` deltas.
