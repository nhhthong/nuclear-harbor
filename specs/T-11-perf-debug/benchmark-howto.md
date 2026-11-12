# M3 benchmark how-to (GDD 13.9, 17.5)

Goal: record real numbers on at least one low-end and one mid-range machine to decide on zone
streaming (default decision: none).

## Run

1. `npm run build && npm run preview` (or `npm run dev`), open in a desktop browser, GPU acceleration on, other tabs closed.
2. Load a scene with the target load (30 robots, boss when available), e.g. the full level `http://localhost:4173/?autostart&debug` once T-16 lands, or `?sandbox&autostart&enemies=sphere,spider,charger` before.
3. Choose the quality preset in settings (run low, medium, high).
4. Record: `...&bench=30` records 30 s at load and logs one line `BENCH {json}` in the console and on the overlay.
   Or from the console: `await __NH__.game.ctx.testHooks.debug.startBenchmark(30)`.
   Move around and fight during the recording for a representative result.
5. Copy the `BENCH` line. Keys: `F3`/`` ` `` overlay, `F4` collider wireframes, `F6` reset resource delta.

## What to record per machine

- CPU, GPU, RAM, browser + version, resolution, quality preset.
- `fps.avg`, `fps.onePercentLow`, `fps.min`, `frameMs.avg/max` (targets: 60 desktop, 30 low-end).
- `maxDrawCalls` (budget 350) and `maxTriangles` (budget 1.5 M).
- `start`/`end`/`delta` for geometries, textures, tracked resources, `heapMb` (steady scene: delta about 0; heap budget 512 MB).
- `enemies` counts by sim level.
- If a target is missed: reduce shadows, post-processing, texture size, view distance, draw calls before cutting gameplay; re-run.

## Leak check

Press `F6`, play or restart a run, read `delta since F6` on the overlay: geometries, textures and tracked resources should return to 0.
