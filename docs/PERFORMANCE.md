# Performance (T-17)

Scope statement: all numbers below come from headless Chromium with software WebGL (SwiftShader) in a container.
Draw calls, triangles and resource counts are exact and comparable. FPS and frame times are NOT representative of
real hardware (about 2 to 20 fps here) and are listed only for completeness. **No real low-end or mid-range device
was available; those runs are pending (instructions at the end).**

## Budgets (`PERFORMANCE` in `src/config/tunables.ts`)

`maxDrawCalls` 350, `maxTriangles` 1.5 M, heap warning 512 MB. `scripts/smoke.mjs` now fails when any state exceeds the
draw-call budget or when `shadowMap.autoUpdate` is on.

## 1. Menu draw calls (backlog 1): cause and fix

Measured with `renderer.info` on the same frame, shadows on and off (`medium`):

| State | Total (shadow pass + main pass) | Main pass only |
|---|---|---|
| Menu (camera at spawn looking north into the warehouse) | **384** | 212 |
| Harbor in play (same position, player yaw) | 214 | 118 |
| Sandbox | 43 | 30 |

Cause: not an extra scene or unculled objects. The scene is rendered once; the cost was the **sun shadow pass being
re-rendered every frame** (172 of the 384 calls in the menu), plus the menu camera looking along a direction where more of
the yard is inside the frustum than the play view (main pass 212 vs 118). Fix: shadows are no longer auto-updated (item 3
below). Steady-state frames now cost the main pass only: **menu 212, harbor 118, sandbox 30**; the frames on which the
shadow map refreshes cost what a frame cost before (menu never refreshes, because nothing moves; harbor 214, sandbox 43).
Smoke prints `drawCalls` per state (menu 213, harbor 215 because the smoke render may land on a refresh frame, sandbox 30).

## 2. Static shadows (backlog 3, AC3)

- `renderer.shadowMap.autoUpdate = false`. `Renderer.render()` asks a pure `ShadowScheduler` (`src/core/quality.ts`,
  unit-tested) whether to set `needsUpdate`: once after `world:ready`, once after every quality change, and then at a
  low rate **only while the game is `playing`** (moving robots and the player cast shadows): `dynamicShadowHz` is 0 on
  low (shadows off anyway), 6 on medium, 12 on high.
- Not done: a second small shadow frustum around the player. It would need a second shadow-casting light or a custom
  pass; measured reason to prefer the simple scheme: the whole harbor shadow pass is 96 calls (214 - 118) on medium, so at
  6 Hz it costs about 10 calls per frame on average (about 10 % of the old cost), and the code stays small. The visible
  trade-off is that robot and player shadows update at 6 Hz on medium (they lag a few frames when something moves fast).
  Unverified by a human; raise `dynamicShadowHz` in `PERFORMANCE.quality` if it looks wrong.
- Low preset: `shadowMap.enabled = false`.
- Also fixed: three removed `PCFSoftShadowMap` and printed a console warning on every start; the renderer now sets
  `PCFShadowMap` explicitly.

## 3. Benchmark matrix (AC1, AC2), 3 scenes x 3 presets, 30 robots alive

`npm run bench` (3 s per run). "Before" = commit a3dca0e (shadows every frame), "after" = this branch. Values are the
worst frame of the run (so the after column includes shadow refresh frames) and the final resource counts.

| Scene | Preset | Draw calls before | after | Triangles before | after | Geometries / textures after |
|---|---|---|---|---|---|---|
| spawn | low | 120 | 121 | 31,096 | 31,240 | 62 / 6 |
| spawn | medium | 214 | 218 | 44,040 | 45,364 | 62 / 7 |
| spawn | high | 220 | 218 | 44,040 | 45,364 | 62 / 7 |
| yard + robots (-60, 0) | low | 88 | 81 | 25,466 | 24,806 | 63 / 6 |
| yard + robots | medium | 200 | 199 | 39,578 | 38,998 | 63 / 7 |
| yard + robots | high | 200 | 199 | 39,578 | 38,998 | 63 / 7 |
| boss fight (arena, boss spawned) | low | 40 | 44 | 23,988 | 24,744 | 65 / 6 |
| boss fight | medium | 192 | 197 | 40,152 | 39,732 | 65 / 7 |
| boss fight | high | 197 | 192 | 39,732 | 40,152 | 65 / 7 |

Reading: the worst-frame numbers barely change (a refresh frame costs what every frame cost before), every case is far
below the budgets (worst 218 calls, 45 k triangles vs 350 / 1.5 M), and the improvement is that 9 of 10 frames at
medium at 60 fps (6 Hz refresh) skip the shadow pass. Frame time: not measurable here; the +1 geometry is
the warehouse light strips (one merged mesh, one draw call). Heap after boot is about 20 to 22 MB. FPS columns of
`bench` are omitted from this table on purpose: software GL ran at 2 to 9 fps in the bench and the same slowdown (about
10 fps in the first seconds, then 2 to 3 fps) also happens on the pre-T-17 build, so it is a property of this container.

Worst view requirement (AC2): `medium`, all 30 robots alive, 218 draw calls and 45 k triangles at spawn: within budget.

## 4. LOD and culling (AC4)

Already in place: cranes use `THREE.LOD` (T-04), containers are one `InstancedMesh` with a computed bounding sphere,
spider robots switch to a simplified far representation that stops animating legs (`SpiderRobot`, `simLevel`), the ship is
a single mesh without shadows, view distance and fog follow the preset (`low` 300 m, `medium` 450 m, `high` 600 m; fog range
18 % to 95 % of it, applied on quality change). Not done: LOD for the boss legs (one instance, cost is small) and splitting
the container `InstancedMesh` per block (the whole level fits in 118 to 218 calls, so a culling gain is not measurable here).

## 5. AI cost and allocation (ticket step 5)

Not re-profiled in this ticket beyond the bench: think-rate bands exist (`AIUpdateScheduler`, dormant robots coarse).
No allocation profiler run was possible without a real browser session; no hot-loop allocation was added by T-17 (the
new per-frame code, `ShadowScheduler.frame`, allocates nothing). Marked unverified.

## 6. Leak check (AC5)

`npm run leakcheck`: boots the harbor, then 3 cycles of {fire, teleport among robots, kill robots, dispose the whole
game, build a new one in the same page (`window.__NH__.restart()`)}. After the warm-up restart: geometries 62, textures
7, tracked resources 123, net listeners on window/document/canvas 19, live intervals 0, **identical after all 3 cycles**,
JS heap flat at 22 MB, pass. The player-facing "Restart" button still reloads the page (flow module, T-16 e2e expects
it); the in-place path is used by the check only. No module needed a dispose fix.

## 7. Bundle (backlog 7)

| | Before (a3dca0e) | After |
|---|---|---|
| JS files | `index` 5,270 kB | `index` 267 kB, `vendor-three` 672 kB, `vendor-rapier` 4,333 kB |
| JS total | 5,270 kB | 5,272 kB |
| JS gzip total | 1,928 kB | 89 + 169 + 1,669 = 1,928 kB |
| Other files | GLB 2,314 kB | + manifest, 2 icons (9.6 kB), `sw.js` (3 kB) |

Honest result: the total did not shrink. 4.3 MB of the 5.3 MB is Rapier, which `@dimforge/rapier3d-compat` ships with
its WASM embedded as base64 (1.7 MB gzipped); three tree-shakes to 672 kB and the game code is 267 kB. Minification was
already on (oxc); it is now set explicitly. Gain from splitting: game code changes re-download 89 kB gzip instead of
1.9 MB, the three and Rapier chunks are cached separately, and the offline service worker reuses content-hashed chunks it
already holds when updating. Next step (not done, needs a new dependency and Tech Lead approval): the non-compat
`@dimforge/rapier3d` with a separate `.wasm` file would save about a third of the Rapier size (no base64) and allow
streaming compilation.

## 8. Streaming decision (GDD 13.1, 17.5)

No streaming. The level is one harbor, all content is procedural except one 2.3 MB GLB; first load is about
7.6 MB raw (about 4.2 MB gzip, the GLB hardly compresses), heap after boot about 22 MB, GPU resources 62 geometries / 7
textures. Everything fits in memory many times over; there is nothing to stream. Boot in the container (software GL,
including the physics WASM init) is a few seconds.

## 9. Real-device benchmark (pending, owner action)

Open the built game (`npm run build && npm run preview`, or any static host) with
`?autostart&bench=20`, keep the tab focused and untouched for 20 s, and copy the console line `BENCH {json}` (fps avg / min /
1 % low, frame ms, max draw calls, triangles, resource deltas, heap). Repeat for `&sandbox` if wanted and per quality
(Settings, Graphics quality, then reload with the same query). Needed: one low-end and one mid-range machine (GDD 13.9).
`npm run bench` can also be run on a machine with a GPU (it drives headless Chromium; pass `SMOKE_HEADED=1` for a window).
Results to be pasted below when available:

| Machine | Preset | fps avg | 1 % low | max draw calls | notes |
|---|---|---|---|---|---|
| pending | | | | | |
