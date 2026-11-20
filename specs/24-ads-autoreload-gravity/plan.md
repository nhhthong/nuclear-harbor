# Implementation Plan: ADS, auto reload, gravity

**Spec**: [spec.md](spec.md) | **Branch**: dev branch `claude/wizardly-cori-697x6r`, merged to `main` as PR #11 (with spec 25)

## Summary
The weapon module owns the aim state: each frame it computes `wantAim` and smooths `ctx.player.aimAmount` with the pure helpers in `src/core/ads.ts`. The player controller (speed, sprint, sensitivity), the camera FOV, the view models, spread/recoil and the HUD crosshair read it. Auto reload is a flag passed into the pure `WeaponState.step`.

## Technical Context
TypeScript strict, Three.js, Vitest. Files: `src/core/{InputManager,Settings,PlayerState,ads}.ts` (+ `ads.test.ts`, `Settings.test.ts`), `src/config/tunables.ts` (`ADS`, `PLAYER`), `src/weapon/{index,WeaponState}.ts` (+ `WeaponState.test.ts`), `src/weapon/viewmodel/*`, `src/player/PlayerController.ts`, `src/ui/{screens,hud,styles,index}.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | No allocation; FOV written every frame from a scalar (no objects). PASS |
| II Typed contracts | One additive field on `PlayerState`, one setting, one action. No event renamed or added. PASS |
| III Tunables | `ADS` and `PLAYER` in `config/tunables.ts`; rifle ADS poses in `WEAPON_LOCAL`/`GLB_VIEW` (config). PASS |
| IV Tests | Pure logic unit-tested (aim smoothing, FOV/sensitivity blend, auto reload, binding migration, jump heights). Weapon-module wiring (cancel rules, speed, sprint) has no test: JUSTIFIED, scene-bound, checked by screenshot only. Smoke/e2e skipped (owner policy). |
| V Blast radius | Edits shared `src/core/**` and `src/config/**` at owner request, additive only. JUSTIFIED |
| VI Offline | No assets. PASS |
| VII Simplicity | No scope overlay, no toggle mode. PASS |

## Design decisions
- `aimAmount` is smoothed with `1 - exp(-response dt)` in the weapon `update(dt)` (frame rate), so FOV is smooth at any refresh rate; snaps to the target within 0.002.
- Target = button held && alive && controls free && not reloading; the player controller blocks sprint while the button is held.
- View model: `ViewModelState.aim` shifts the rig towards a per-model ADS offset and damps bob/sway.
- Gravity: jump apex = v^2 / (2 g). At -22 and -30 the speeds were re-derived to keep 3.9 m / +3.3 m; the owner later asked for a natural jump (7.55 / 7.15 m/s, 0.95 m / +0.85 m) and the dodge thresholds of other specs were lowered with it (specs 26, 27).

## Complexity Tracking
None.
