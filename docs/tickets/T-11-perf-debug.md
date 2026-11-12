# T-11 — Performance monitor and debug overlay

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 13.8, 13.9, 16 Performance and Offline ("monitor FPS, frame time, draw calls and resource counts"), 15 M3 benchmark |
| Spec dir | `specs/T-11-perf-debug/` |

## Goal

Build the diagnostics needed to hold the performance targets: an on-screen overlay (FPS, frame time, fixed ticks, draw calls, triangles, GPU resource counts, JS heap, physics/enemy/pool counts) with budget warnings, a physics collider debug view, and a benchmark recorder that produces the numbers for the M3 streaming decision.

## Files owned (exclusive)

- `src/debug/**` (replace `src/debug/index.ts`; keep `createDebugModule` and id `debug`)
- `tests/e2e/T-11-perf-debug.e2e.mjs` (browser check, optional but recommended)
- `specs/T-11-perf-debug/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`; `ctx.uiRoot`
- `ctx.renderer.webgl.info` (`render.calls`, `render.triangles`, `memory.geometries/textures`, `programs`), `ctx.renderer.qualityPreset`
- `ctx.resources.stats()` / `totalLiveResources`, `ctx.physics.colliderCount` and `ctx.physics.world.debugRender()`, `ctx.enemies.all()` (`simLevel`), `ctx.grappleAnchors.size`, `ctx.clock`, `ctx.testHooks` (read-only display of numeric hooks such as `vfx.liveParticles`)
- `PERFORMANCE` tunables (budgets); `ctx.flags.debug` (`?debug`), `ctx.flags.params` (`?bench=<seconds>`)
- Your own `keydown` listener for the `debugToggle` codes (F3 / Backquote) so the overlay also works in menus

## Interfaces provided

- Overlay + warnings; collider wireframe view; benchmark report
- `ctx.testHooks.debug = { snapshot(): PerfSnapshot, startBenchmark(seconds): Promise<BenchmarkReport>, lastReport }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-11-perf-debug
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-11-perf-debug/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-11-perf-debug/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure parts with tests: `FrameStats` (ring buffer of frame times → fps, average, 1% low, max; no allocation per sample), `evaluateBudgets(snapshot, PERFORMANCE)` → list of warnings, `summarise(samples)` → `BenchmarkReport`.
2. Sampling: the module is last in the registry, so its `update()` runs after everything else. Note that `update` only runs in `playing`; use your own `requestAnimationFrame` sampler for frame time so the overlay is correct in menus too. Read `renderer.info` after render (it is reset per frame by three.js: read the previous frame's values).
3. Overlay (DOM under `ctx.uiRoot`, monospace, top-left, toggled by F3/Backquote, on by default with `?debug`): fps / avg ms / 1% low / max ms, fixed ticks per second, draw calls, triangles, geometries, textures, shader programs, tracked resources per scope, colliders, enemies by sim level, anchors, JS heap (when `performance.memory` exists), quality preset, canvas resolution, game state, player position/zone. Refresh text 4 times per second, never every frame.
4. Budget warnings: highlight values exceeding `PERFORMANCE.maxDrawCalls`, `maxTriangles`, `jsHeapWarnMb`, and fps below `lowEndFps` for more than 2 s (GDD 13.9 "memory has a budget and warnings").
5. Collider debug view (key `F4` or `?colliders`): render `physics.world.debugRender()` vertices/colours into one `LineSegments` with a reused, growable buffer; off by default; shows grappleable colliders in a distinct colour if feasible (iterate colliders and read `ctx.physics.getMeta`).
6. Benchmark recorder: `?bench=20` (or `startBenchmark`) records for N seconds and outputs a JSON report (avg/min/1%-low fps, avg/max frame ms, max draw calls/triangles, geometries/textures at start and end, heap at start and end, enemy counts) to the console as one line prefixed `BENCH ` and onto the overlay; also `renderer.info` deltas to spot leaks (end − start should be ~0 in a steady scene).
7. Leak helper: a "resource delta" readout since the last reset (button or key `F6`) for geometries/textures/tracked resources, used by T-17.
8. Cost: the overlay itself must cost < 0.3 ms per frame when visible and ~0 when hidden; no per-frame allocations in the sampler.
9. Write `specs/T-11-perf-debug/benchmark-howto.md`: how to run the M3 benchmark on a low and a mid machine and what to record (GDD 13.9, 17.5).
10. e2e: boot `?sandbox&autostart&debug`, assert the overlay is visible with numeric fps and draw calls, `snapshot()` fields are finite, `startBenchmark(2)` resolves with a report, toggling hides it, no console errors.

## Acceptance criteria

- [ ] **AC1** An overlay toggled with F3/Backquote (default on with `?debug`) shows FPS, frame time, draw calls, triangles and GPU resource counts (geometries, textures), plus colliders, enemies by sim level, tracked resources and JS heap when available.
- [ ] **AC2** Values exceeding the budgets in `PERFORMANCE` are visibly flagged; sustained FPS below 30 raises a warning.
- [ ] **AC3** A collider wireframe view can be toggled and shows all static and dynamic Rapier colliders.
- [ ] **AC4** `?bench=<seconds>` (and the test hook) produces a JSON benchmark report with fps statistics, peak draw calls/triangles and start/end resource counts.
- [ ] **AC5** A resource-delta readout shows growth of geometries/textures/tracked resources since the last reset.
- [ ] **AC6** With the overlay hidden the module adds no measurable per-frame cost and performs no per-frame allocations; visible, its DOM is updated at most 4 times per second.
- [ ] **AC7** Frame statistics and budget evaluation are pure and unit tested.
- [ ] **AC8** `dispose()` removes DOM, listeners, the rAF sampler and debug meshes.

## Notes

Quality presets are already applied to the renderer by the foundation (`Renderer.applyQuality`); you only display them. Headless Chromium uses software GL, so do not assert FPS thresholds in tests.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-11
# manual: npm run dev → http://localhost:5173/?sandbox&debug   (F3 overlay, F4 colliders)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
