<div align="center">

# LAST STAND: NUCLEAR HARBOR

**A single-player browser FPS on a cold, overcast container quay, wet underfoot and taken over by military robots.**
Fight through the yard, bring down STINGER-7, the mecha scorpion that guards the relay tower, then the Gunslinger Crab Mech, before the countdown ends.

### [▶ Play the live demo](https://nhhthong.github.io/nuclear-harbor/)

[![Live demo](https://img.shields.io/badge/Live%20demo-GitHub%20Pages-2ea44f?logo=github&logoColor=white)](https://nhhthong.github.io/nuclear-harbor/)
[![CI](https://github.com/nhhthong/nuclear-harbor/actions/workflows/pages.yml/badge.svg)](https://github.com/nhhthong/nuclear-harbor/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Rapier](https://img.shields.io/badge/Physics-Rapier-F2780C)](https://rapier.rs/)
[![Platform](https://img.shields.io/badge/Platform-Web%20(offline%20capable)-blue)](#offline-play)
[![Status](https://img.shields.io/badge/Status-prototype-orange)](#project-status)

<a href="https://nhhthong.github.io/nuclear-harbor/"><img src="docs/media/hero.jpg" alt="Gate apron under the overcast sky: wet asphalt reflecting the clouds, container stacks, barrier walls and the in-game HUD with radar" width="920"></a>

<sub>No install, no account, no network after the first load. Desktop browser with WebGL2 and a GPU recommended; pick the Low preset on integrated graphics.</sub>

</div>

---

## Overview

You are the only survivor of a container quay whose defence robots have been hijacked. The nuclear control system counts down from **08:00**. Fight through the container yard to the relay tower, where the mecha scorpion **STINGER-7** rises, hold **E** to activate the tower, then bring down the **Gunslinger Crab Mech**, a 10 m armoured boss with one huge health bar and four skills.

**Three.js + TypeScript + Vite + Rapier**: fixed 60 Hz simulation, procedural audio, no backend, no network at runtime. One small level (72 x 122 m) with modelled containers, wet ground with a planar reflection, a pale sun with one shadow map, an overcast sky, bloom and a cold film grade. Robots, vehicles and clutter are free CC0 or CC-BY models ([credits](CREDITS.md)). It is a **prototype**: nobody has play-tested a full run yet, so balance and real-GPU frame rate are unverified.

## Screenshots

<div align="center">
  <img src="docs/media/map-overhead.jpg" alt="Overhead view of the whole quay: gate apron at the bottom, container yard, relay court, and the quay with the gantry crane at the top" width="460">
</div>

<sub>Overhead, north at the top: gate apron (spawn, no robots), container yard, relay court around the tower, quay with the crane and boss arena. White boxes are the safe containers.</sub>

<table>
  <tr>
    <td width="50%"><img src="docs/media/yard.jpg" alt="A lane through the container yard with a robot at the far end"><br><sub>Container yard lane</sub></td>
    <td width="50%"><img src="docs/media/court.jpg" alt="Relay court with a small construction site"><br><sub>Relay court</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/media/biped.jpg" alt="Biped robot raising its claws"><br><sub><b>Biped robot</b>: crouches, leaps at where you stood, claws on landing</sub></td>
    <td width="50%"><img src="docs/media/striker.jpg" alt="Medium Mech Striker advancing between container stacks"><br><sub><b>Medium Mech Striker</b>: bursts and AOE rockets</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/media/samurai.jpg" alt="Cyber samurai with a naginata"><br><sub><b>Cyber samurai</b> elite</sub></td>
    <td width="50%"><img src="docs/media/scorpion.jpg" alt="STINGER-7 mecha scorpion in gunmetal with green glowing sensors"><br><sub><b>STINGER-7</b> semi-boss: gunmetal armour, green glow</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/media/crab.jpg" alt="Gunslinger Crab Mech final boss on the quay"><br><sub><b>Gunslinger Crab Mech</b>: 5800 HP, no weak points</sub></td>
    <td width="50%"><img src="docs/media/crab-drones.jpg" alt="The crab releasing dragonfly drones"><br><sub>Skill: dragonfly drones</sub></td>
  </tr>
</table>

<sub>Captured from the production build with software rendering (no GPU). Robot and crab shots: quality "low"; the others: "medium".</sub>

## Gameplay

```
Gate apron (empty) -> container yard -> relay court: STINGER-7, hold the tower
           -> the Gunslinger Crab Mech drops onto the quay -> wear down its single HP pool -> victory
```

- **Countdown** 8 minutes; zero is a failure. **Tower**: hold `E` for 5 s within range. Death respawns at the last checkpoint; the countdown keeps running.
- **Robots** (roster of 22, streamed in as you walk, 10 alive at most): 5 Medium Mech Strikers (3-round bursts, an AOE rocket every 6 to 9 s), 4 Biped robots (leap and claw; double jump dodges the leap), 6 Spot dogs, 4 Bomber Ducks (3-2-1 explosion), 3 cyber samurai (300 HP elites: cleave, spinning naginata, lightning dashes).
- **STINGER-7** (1300 HP): charge, venom shot, tail slam; raises a hexagon shield under sustained fire.
- **Gunslinger Crab Mech** (5800 HP): carpet bombs (AOE), dragonfly drones, a 360 degree spin up close, a slow four-way laser that rotates 180 degrees.
- **Supplies**: 11 ammo crates, 3 medkits; five safe containers heal 12 HP/s and robots cannot enter.
- Numbers are starting values and **not** balanced by play-testing.

| Action | Input |
|---|---|
| Move / look / fire | `W` `A` `S` `D` / mouse / left button |
| Aim down sights / reload | right button (hold) / `R` |
| Jump (double jump) / sprint | `Space` / `Shift` |
| Activate tower | hold `E` |
| Pause / debug overlay | `P` or `Esc` / `F3` |

Bindings, sensitivity, volume, quality (low, medium, high) and FPS cap are in the menu.

## Getting started

Node.js 20+ and a WebGL2 browser (a GPU is strongly recommended).

```bash
git clone https://github.com/nhhthong/nuclear-harbor.git
cd nuclear-harbor
npm install
npm run dev          # http://localhost:5173/
```

Verify with `npm run typecheck && npm test && npm run build` (also run by CI). Other scripts: `npm run preview`, `smoke`, `offline`, `leakcheck`, `bench` (see `package.json`).

**URL parameters** (dev and testing only): `?autostart` skips the menu, `?sandbox` small test scene (`&enemies=army,spot,duck,biped` or `none`), `?debug` overlay, `?colliders`, `?countdown=SECONDS`, `?boss` / `?bossphase=core`, `?viewmodel=procedural`, `?bench=SECONDS`.

**GitHub Pages**: `.github/workflows/pages.yml` runs typecheck, unit tests and build on every push and PR and deploys `main` to the [live demo](https://nhhthong.github.io/nuclear-harbor/) (Settings, Pages, Source: GitHub Actions). **Offline**: a service worker precaches the build; open once online, then it works offline ([`docs/OFFLINE.md`](docs/OFFLINE.md)).

## Architecture

`src/` modules are registered in `src/modules.ts` (init order = update order) and talk through a typed event bus; every gameplay number lives in `src/config/tunables.ts` or a module `tunables.ts`.

`core` (loop, renderer, input, events) · `config` · `physics` (Rapier) · `world` · `structures` (crane, props, vehicles) · `shelters` · `player` · `weapon` · `combat` · `scorpion` · `enemies` (Striker, Biped, Spot, Duck, samurai, streaming) · `boss` (crab, drones) · `objectives` · `pickups` · `flow` · `vfx` · `audio` · `ui` · `debug` · `offline`

Budgets: 60 FPS desktop target, at most 350 draw calls (about 100 to 180 measured on software GL), about 5.3 MB of code plus about 14 MB of models. Details: [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).

## Status and limitations

- Verified: `tsc`, **513 unit tests**, build, CI. Not verified: a full run, balance, frame rate on a real GPU. `tests/e2e/` scripts are stale and `smoke` was not re-run after the reworks.
- The Bomber Duck is primitive-built and reads as low-poly (the scorpion is an authored model with a procedural fallback; its legs swing rigidly about the hips, so feet slide a little); the crab can show a pale orange wash while a skill telegraphs; the in-game Restart reloads the page.
- Differences from the original design: [`docs/DEVIATIONS.md`](docs/DEVIATIONS.md). Architecture and conventions: [`docs/PLAN.md`](docs/PLAN.md). Assets: [`docs/ASSETS.md`](docs/ASSETS.md). AI session rules: [`CLAUDE.md`](CLAUDE.md).

## Contributing

Run `npm run typecheck && npm test && npm run build`, keep gameplay numbers in the `tunables` files, do not commit `node_modules` or third-party archives, and say what you verified and what you did not. New features follow [Spec Kit](https://github.com/github/spec-kit) ([`docs/SPECKIT.md`](docs/SPECKIT.md); artifacts in `specs/`).

## Credits and licenses

Project code: [MIT License](LICENSE). Third-party models are CC0 or CC-BY 4.0 (Sketchfab, Poly Haven, 3DModelsCC0, OpenGameArt); the G36C view model is **not** covered by the MIT license. Full tables, authors, changes and build scripts: **[CREDITS.md](CREDITS.md)** (also in the in-game Credits screen and [`docs/ASSETS.md`](docs/ASSETS.md)).
