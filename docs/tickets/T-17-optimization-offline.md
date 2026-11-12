# T-17 — Optimisation and offline packaging

| | |
|---|---|
| Wave | 4 |
| Depends on | T-16 (and T-11 for measurements) |
| GDD sections | 13 (all), 14, 15 M6, 16 Performance and Offline; REVIEW #4 |
| Spec dir | `specs/T-17-optimization-offline/` |

## Goal

Reach the M6 exit criteria: hold the performance budgets in the full level, prove there is no obvious resource leak across a run, apply the planned shadow strategy, and make the game installable and playable offline after the first load.

## Files owned (exclusive)

- `public/**` (web manifest, service worker, icons generated procedurally), `src/offline/**` (service-worker registration; called from your own module hook, see steps)
- `scripts/bench.mjs`, `scripts/leakcheck.mjs`, `docs/PERFORMANCE.md`, `docs/OFFLINE.md`
- Cross-cutting edits: this ticket is the one exception to exclusive ownership. It may edit any `src/<feature>/` file to optimise it, after wave 3 is merged and no other ticket is in flight; list every touched file in the plan and keep behaviour and tests intact. Foundation changes (e.g. registering the service worker in `src/main.ts`, `Renderer` shadow settings, `vite.config.ts` chunking) are allowed here and must be listed for Tech Lead review.
- `tests/e2e/T-17-optimization-offline.e2e.mjs` (browser check, optional but recommended)
- `specs/T-17-optimization-offline/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- T-11 monitor and benchmark (`?bench`, `testHooks.debug`), `ctx.renderer.webgl.info`, `ResourceTracker.stats()`
- `PERFORMANCE` budgets and quality presets; `AI_SCHEDULING`
- The Playwright harness in `scripts/lib/harness.mjs`

## Interfaces provided

- `npm run bench` and `npm run leakcheck` scripts with JSON output
- Offline-capable production build (precache of all build files), install instructions
- `docs/PERFORMANCE.md` with before/after numbers and the streaming decision

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-17-optimization-offline
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-17-optimization-offline/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-17-optimization-offline/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Measure first: run the T-11 benchmark in the full level at spawn, in the container yard with robots active, and in the boss fight, on the three quality presets; record fps, frame time, draw calls, triangles, geometries/textures, heap in `docs/PERFORMANCE.md`. Software-GL numbers from headless runs are only relative; ask the user for one run on a real low-end and one mid machine (GDD 13.9) and record them when available.
2. Draw calls: verify instancing/merging for containers, structures, pickups, particles; merge remaining static meshes per material; make sure robots share geometry/material; target ≤ `PERFORMANCE.maxDrawCalls` in the worst view.
3. Shadows (REVIEW #4): static pass rendered once — `renderer.shadowMap.autoUpdate = false`, `needsUpdate = true` after `world:ready` and on quality change; dynamic casters (player view model excluded, robots near, boss) handled by a second small shadow frustum following the player or by simple blob shadows on low/medium. Low preset: shadows off.
4. LOD and culling (GDD 13.3): `THREE.LOD` for cranes (exists), ship, robots (far = single mesh, no legs), boss legs; frustum culling enabled with correct bounding spheres for instanced meshes (split the container `InstancedMesh` per block if one giant bounding sphere defeats culling); view distance per preset.
5. AI cost: confirm think rates per band with the monitor, dormant robots cost ~0; nav paths are not recomputed more than ~2 Hz per robot; no allocations in hot loops (use the allocation profiler; fix offenders).
6. Leak check (`scripts/leakcheck.mjs`): start a run, play a scripted minute (shoot, spawn effects, kill robots, collect pickups), return to menu / restart three times; assert `renderer.info.memory` geometries/textures and tracked resources return to the baseline (±2) and JS heap does not grow monotonically. If restart is still a page reload, implement in-place restart (`Game.dispose()` + re-create) to make this meaningful and fix every module whose `dispose()` leaks.
7. Bundle: split `three` and `rapier` into vendor chunks, verify no runtime request leaves the origin (assert in the smoke harness via request interception), report sizes.
8. Offline (GDD 14): hand-written service worker in `public/sw.js` (no new dependency): precache the build file list (generate the manifest at build time with a small Vite plugin in `vite.config.ts` or by scanning `dist/` in a post-build script), cache-first for same-origin GET, versioned cache name, cleanup of old caches. Web app manifest + procedurally generated icons. Register only in production builds.
9. Offline test (`scripts/` + e2e): load once, then `context.setOffline(true)`, reload → the game boots and reaches `playing` with no failed requests.
10. `docs/OFFLINE.md`: how to install / preload, how updates work, how to clear the cache.
11. Streaming decision (GDD 13.1, 17.5): with the measured memory and load time, record the decision in `docs/PERFORMANCE.md` (expected: no streaming needed).

## Acceptance criteria

- [ ] **AC1** `docs/PERFORMANCE.md` contains benchmark numbers for three scenes × three presets before and after optimisation, and the recorded streaming decision.
- [ ] **AC2** In the worst-case view of the full level on `medium`, draw calls ≤ 350 and triangles ≤ 1.5 M (the `PERFORMANCE` budgets), with all 30 robots alive.
- [ ] **AC3** Static shadows are rendered once (`shadowMap.autoUpdate` false) and refreshed only on world/quality changes; low preset renders no shadows.
- [ ] **AC4** Robots, cranes and the ship use LOD or simplified far representations; distant robots do not animate legs.
- [ ] **AC5** `npm run leakcheck` passes: after three run/restart cycles geometries, textures and tracked resources return to baseline and listeners/timers are released.
- [ ] **AC6** The production build makes no cross-origin request at runtime (asserted automatically).
- [ ] **AC7** After one online load the game starts and is playable with the network disabled (automated offline check), and a web manifest makes it installable.
- [ ] **AC8** `docs/OFFLINE.md` explains install/preload, update and cache reset.
- [ ] **AC9** All existing unit, smoke and e2e checks still pass.

## Notes

Prefer reducing shadows, post-processing, texture size, view distance and draw calls before touching gameplay content (GDD 13.9). Real-device numbers need the user; mark them as pending if unavailable.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e
npm run bench
npm run leakcheck
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
