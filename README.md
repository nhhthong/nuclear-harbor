<div align="center">

# LAST STAND: NUCLEAR HARBOR

**A single-player browser FPS on a rain-soaked container quay at night, taken over by military robots.**
Fight through the yard, hold the relay tower before the countdown ends, then bring down TITAN-04.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Rapier](https://img.shields.io/badge/Physics-Rapier-F2780C)](https://rapier.rs/)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Web%20(offline%20capable)-blue)](#offline-play)
[![Status](https://img.shields.io/badge/Status-prototype-orange)](#project-status)

<img src="docs/media/night-apron.jpg" alt="Night view of the gate apron: wet asphalt with rain ripples and reflections, weathered containers, a flood light beam and the perimeter fence" width="920">

</div>

---

## Table of contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [Gameplay](#gameplay)
- [Controls](#controls)
- [Getting started](#getting-started)
- [URL parameters](#url-parameters)
- [Architecture](#architecture)
- [Performance](#performance)
- [Offline play](#offline-play)
- [Quality assurance](#quality-assurance)
- [Project status](#project-status)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Credits and licenses](#credits-and-licenses)

## Overview

You are the only survivor of a container quay whose defence robots have been hijacked. It is night, it is
raining, and the nuclear control system is counting down from **08:00**. Push through the container yard, reach
the relay tower in the court behind it and hold **E** to activate it while the robots close in. Then **TITAN-04**,
a four-legged spherical war machine that can only be hurt through its lights, drops onto the quay.

The game runs entirely in the browser on **Three.js + TypeScript**, with **Rapier** physics, a fixed 60 Hz
simulation, procedural audio and procedurally built models. There is no backend and no network access at runtime.

> **Honest scope note.** One small level (72 x 86 m), built to look as good as code-generated content can:
> modelled containers, wet ground with a real planar reflection, flood lights with shadows and light beams,
> rain, bloom, ambient occlusion and a film grade. There are no scanned or sculpted assets, so it does not match a
> AAA production; see [Project status](#project-status).

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/media/night-yard.jpg" alt="Lane through the container yard with an army mech and the gantry crane"><br><sub>Container yard: liveries, corrugated steel, lane paint, reflections</sub></td>
    <td width="50%"><img src="docs/media/night-quay-crane.jpg" alt="Gantry crane on the concrete quay with flood lights and the moored ship"><br><sub>Quay: gantry crane, concrete slabs, the moored ship</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/media/night-relay-court.jpg" alt="Relay tower with an army mech next to it under flood light beams"><br><sub>Relay court: the tower and its guard</sub></td>
    <td width="50%"><img src="docs/media/night-boss-titan-04.jpg" alt="TITAN-04 on the quay in the rain with the boss HUD"><br><sub>TITAN-04 and the boss HUD (four weak points, locked core)</sub></td>
  </tr>
</table>

<sub>Captured from the production build with software rendering (no GPU), quality preset "medium".</sub>

## Features

**Combat**
- Automatic rifle with magazine, reserve ammo, reload, spread and recoil, critical hits (2x), pooled tracers, muzzle flash with a real point light and ejected casings.
- Hit zones on enemies: Duck and Spot noses/heads crit, armour absorbs, the boss only takes damage through its weak points.
- Pickups: ammo crates and medkits placed around towers and lanes, plus a chance of an ammo drop from destroyed robots.

**Movement**
- Rapier kinematic capsule controller: walk, sprint, **jump and double jump**, step-up, coyote time and jump buffering.
- Level boundaries and blast walls that seal off side passages so every run follows one readable route.

**Enemies** (8 regular robots, all procedural models with LOD)
- **Vanguard army mech** (3): slow patrols, then smooth, disciplined advance and rocket salvos.
- **Spot dog** (3): weak and fast, lunges and rams.
- **Bomber Duck** (2): hops toward you, arms a **3-2-1** countdown and blows up for 15 damage.
- **TITAN-04 final boss** (about 9 m tall): falls from the sky after the tower is activated, four knee-light weak points, then an exposed core.

**World and rendering**
- One night quay (72 x 86 m): gate apron, container yard, relay court and the quay with a gantry crane, from a seeded layout.
- **Containers as geometry**, not textured boxes: corrugated walls and roof, frame, doors with locking bars, corner castings, livery decals; one shader adds chipped paint, rust and grime.
- **Wet ground shader**: asphalt and concrete slabs, cracks, worn paint, crane rails, puddles with rain ripples and a half-resolution **planar reflection** of the whole scene.
- **Lighting**: moonlight, seven flood-light masts as real spot lights (four cast shadows) with volumetric beams, lightning, exponential fog, a reflection probe that includes the lamps.
- **Rain** as two GPU-animated draw calls (streaks and splashes).
- **Post-processing**: MSAA HDR target, ambient occlusion (high preset), bloom, ACES tone mapping, then a grade pass with vignette, film grain and slight chromatic aberration.
- Detailed gantry crane, chain-link fence, site office, barriers, drums, pallets, bollards; ocean shader and a moored ship with lit windows.

**Engineering**
- Module registry with explicit init and update order, a typed event bus, a single `tunables` file for gameplay numbers.
- Object pools, resource tracking with `dispose()` on every module, AI update scheduling by distance.
- Quality presets (shadows, resolution cap, view distance, bloom, FPS cap), settings persisted locally.
- Procedural Web Audio (no audio files), service worker for offline play, built-in debug overlay and benchmark mode.

## Gameplay

```
Gate apron -> container yard (8 robots) -> relay court: hold the tower
           -> TITAN-04 drops onto the quay -> destroy 4 weak points -> shoot the exposed core -> victory
```

| Element | Details |
|---|---|
| Countdown | 8 minutes; reaching zero is a failure |
| Tower | 1; stand within range and hold `E` (5 s). Leaving range or dying cancels the progress |
| Death | Respawn at the last checkpoint when one exists (the activated tower, the boss start); the countdown keeps running |
| Regular robots | 8 in total: 3 army mechs, 3 Spot dogs, 2 Bomber Ducks |
| Final boss | TITAN-04: 4 weak points x 500 HP, then core 4000 HP; Heavy Cannon, Ground Slam and Missile Barrage |
| Supplies | 12 ammo crates and 5 medkits; two of them on container tops (double jump) |

Enemy and weapon numbers are starting values and have **not** been balanced by play-testing.

## Controls

| Action | Input |
|---|---|
| Move | `W` `A` `S` `D` |
| Look | Mouse |
| Fire | Left mouse button |
| Reload | Right mouse button or `R` |
| Jump / double jump | `Space` (press again in the air) |
| Sprint | `Shift` |
| Interact / activate tower | Hold `E` |
| Pause | `P` or `Esc` |
| Debug overlay | `F3` or `` ` `` |

Bindings can be changed in the menu. Settings: mouse sensitivity, volume, graphics quality (low, medium, high) and FPS cap.

## Getting started

**Requirements:** Node.js 20 or newer and a WebGL2-capable browser. A GPU is strongly recommended; software rendering works but is slow.

```bash
git clone https://github.com/nhhthong/nuclear-harbor.git
cd nuclear-harbor
npm install
npm run dev          # http://localhost:5173/
```

Production build and local preview:

```bash
npm run build
npm run preview      # http://localhost:4173/
```

The first click on the canvas locks the pointer. Add `?autostart` to skip the menu and `?sandbox` for the small test scene.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-aware production build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest unit tests |
| `npm run smoke` | Playwright: built app boots, renders, no console errors (needs a build) |
| `npm run e2e -- T-XX` | Per-feature browser checks in `tests/e2e/` (see the note in [Quality assurance](#quality-assurance)) |
| `npm run offline` | Proves the built game boots with the network blocked after one load |
| `npm run leakcheck` | Dispose/re-create cycles return GPU and JS resources to baseline |
| `npm run bench` | Benchmark scenes x quality presets (relative numbers on software GL) |
| `npm run check` | typecheck + tests + build + smoke |

## URL parameters

Handy for development and testing; none are required to play.

| Parameter | Effect |
|---|---|
| `?autostart` | Skip the main menu |
| `?sandbox` | Small flat test scene instead of the harbor |
| `?debug` | Debug overlay (FPS, frame time, draw calls, resources) |
| `?colliders` | Draw physics colliders |
| `?enemies=army,spot,duck` or `none` | Robots in the sandbox |
| `?countdown=SECONDS` | Override the nuclear countdown |
| `?towers=N` | Start with N towers already active |
| `?boss` / `?bossphase=core` | Spawn TITAN-04 shortly after start / jump to the core phase |
| `?viewmodel=procedural` | Use the placeholder rifle instead of the G36C model |
| `?bench=SECONDS` | Run the benchmark and print a `BENCH {json}` line |

## Architecture

```
src/
  core/        game loop (fixed 60 Hz + interpolated render), renderer, input, event bus, settings, shared types
  config/      level layout (level.ts) and every gameplay number (tunables.ts)
  physics/     Rapier wrapper: character controller, static boxes, ray and shape queries, collision groups
  world/       wet ground + planar reflection, modelled containers, sky, moon, fog, rain, ocean, ship, kerb
  structures/  gantry crane, flood-light masts (spot lights + beams), fence, props
  player/      first-person controller (walk, sprint, jump, double jump)
  weapon/      rifle logic, recoil, procedural and GLB view models, pooled weapon effects
  combat/      damage and hit resolution
  enemies/     framework, army mech, Spot, Bomber Duck, nav grid, AI scheduler, population
  boss/        TITAN-04: model, attacks, weak points, landing cinematic
  objectives/  towers and nuclear countdown
  pickups/     ammo, medkits and drops
  flow/        death, game over, victory, checkpoints
  vfx/         pooled particle system and effect recipes
  audio/       procedural Web Audio synthesis and the event-to-sound map
  ui/          HUD, menus, settings, credits
  debug/       overlay, collider view, benchmark
  offline/     service worker registration
  modules.ts   module registry: init order = update order
```

Design rules (full text in [`.specify/memory/constitution.md`](.specify/memory/constitution.md) and [`docs/PLAN.md`](docs/PLAN.md)):

- **Modules, not singletons.** Each feature is a `GameModule` registered in `src/modules.ts` and talks to others through typed events and the shared `GameContext`.
- **Fixed-step simulation.** Logic and physics run at 60 Hz; rendering is independent and interpolates the camera.
- **No unbounded allocation.** Frequently created objects come from bounded pools; per-frame code reuses scratch objects.
- **Everything is disposable.** GPU resources are owned by a `ResourceTracker` scope and released in `dispose()`.
- **One source of numbers.** Gameplay values live in `src/config/tunables.ts` or the module's own `tunables.ts`.

## Performance

| Budget | Value |
|---|---|
| Target | 60 FPS desktop, 30 FPS low-end fallback |
| Draw calls | at most 350 per frame; measured 210 to 250 including the reflection pass |
| Triangles | about 1.1 million per frame with shadow and reflection passes (measured) |
| Enemies | 8 regular robots plus the boss |
| Shadows | moon + 4 flood lights, static maps refreshed at 6 Hz (medium) or 12 Hz (high) for moving casters |
| Presets | low: no shadows, reflection or bloom; medium: shadows, reflection, bloom; high: adds ambient occlusion |
| Bundle | about 5.3 MB (Rapier's WASM is about 80% of it), split into three chunks |

The numbers above come from the debug overlay and the smoke test on **software rendering**. No benchmark on real
hardware has been recorded yet: run `?autostart&bench=20` on your machine and see
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for the table to fill in.

## Offline play

The production build registers a hand-written service worker that precaches every built file (including the
weapon model). Open the game once while online and wait a few seconds; afterwards it starts without a network and
the browser can install it as an app. Details, updates and cache reset: [`docs/OFFLINE.md`](docs/OFFLINE.md).
The service worker is not registered by `npm run dev`.

## Quality assurance

- `npm run typecheck`, `npm test` (**397 unit tests in 59 files**) and `npm run build` pass on the current branch.
- `npm run smoke` and `npm run offline` passed on the previous map before the latest rework.
- **The `tests/e2e/` files are out of date.** They still contain old-map coordinates, four towers and steps for the removed grappling hook, so they were not run after the level rework. Update them before relying on them.
- Nobody has play-tested a full run (tower, boss, victory) yet, so difficulty and pacing are unverified.
- The look was checked on still screenshots from software rendering only; frame rate on a real GPU is unmeasured.

## Project status

**Prototype.** The game is complete end to end in design (start, tower, boss, victory and failure paths) but unproven in play.

Known limitations:

- Visuals are procedural; there is no authored art, so realism is limited by design. Robots and the tower are simpler than the environment.
- The heavy shaders (planar reflection, 5 shadow maps, bloom, AO) target a desktop GPU; use the low preset on integrated graphics.
- No rain or thunder audio yet.
- Gameplay balance (damage, enemy density on the compact map, countdown length) is untested.
- The boss attacks were checked by unit tests and short scripted runs only.
- The in-game Restart button reloads the page.
- Optional boss attacks from the GDD (Shockwave, Target Lock, EMP Pulse) are not implemented.
- Real-device performance numbers are missing.

Where the game differs from the original design document is tracked in [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md).

## Documentation

| Document | Contents |
|---|---|
| [`docs/GDD.md`](docs/GDD.md) | Original game design document (Vietnamese) |
| [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md) | What was built differently from the GDD; read it next to the GDD |
| [`docs/PLAN.md`](docs/PLAN.md) | Architecture, module boundaries, events, conventions |
| [`docs/tickets/`](docs/tickets/README.md) | Work tickets and their status |
| [`docs/PLAYTEST.md`](docs/PLAYTEST.md) | Scripted playtest findings (taken on the previous map) |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Budgets, benchmark method and results table |
| [`docs/OFFLINE.md`](docs/OFFLINE.md) | Service worker and install instructions |
| [`docs/ASSETS.md`](docs/ASSETS.md) | Asset provenance and credits |
| [`docs/CLEANUP-LOG.md`](docs/CLEANUP-LOG.md) | What was removed or renamed and why |
| [`CLAUDE.md`](CLAUDE.md) | Orientation and working rules for AI coding sessions |

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `npm run typecheck && npm test && npm run build`.
2. Keep gameplay numbers in the `tunables` files and keep new modules disposable.
3. Do not commit `node_modules`, build output, or third-party archives (see `.gitignore`).
4. Describe what you verified and what you did not.

Development of this project is organised around tickets and the [Spec Kit](https://github.com/github/spec-kit)
workflow described in [`docs/SPECKIT.md`](docs/SPECKIT.md); the repository's `specs/` folder holds the artifacts.

## Credits and licenses

**Project code** is released under the [MIT License](LICENSE).

| Component | License | Notes |
|---|---|---|
| [Three.js](https://threejs.org/) | MIT | Rendering |
| [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) | Apache-2.0 | Physics |
| [Vite](https://vite.dev/), [Vitest](https://vitest.dev/) | MIT | Build and unit tests |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 | Language |
| G36C view model (`assets-src/weapons/g36c/`, `public/assets/weapons/g36c/`) | **Not covered by the MIT license** | Model by **funnky**, used with the author's permission as stated by the project owner. No licence text ships with the file, so confirm the terms before redistributing or selling the game. |

Everything else (models, textures, sounds, UI) is generated procedurally by this repository's code.

**Acknowledgements.** The reference models in [`docs/reference-models/`](docs/reference-models) inspired the robot
designs; they are visual references only. This project was developed with substantial help from AI coding agents
([Claude Code](https://claude.com/claude-code)) under human direction and review.
