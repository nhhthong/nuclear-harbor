# Implementation Plan: ADS, auto reload, gravity

**Spec**: [spec.md](spec.md)

## Summary
The weapon module owns the aim state and writes `ctx.player.aimAmount`; the player controller (speed, sprint, sensitivity), the camera FOV, the view models, the spread/recoil and the HUD crosshair read it. Auto reload is a flag passed into the pure `WeaponState.step`.

## Technical Context
TypeScript strict, Three.js, Vitest. Files: `src/core/{InputManager,Settings,PlayerState}.ts`, `src/config/tunables.ts`, `src/weapon/{index,WeaponState}.ts`, `src/weapon/viewmodel/*`, `src/player/*`, `src/ui/{screens,hud,styles,index}.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | No allocation; FOV update only when changed. PASS |
| II Typed contracts | One additive field on `PlayerState`, one setting, one action. No event renamed. PASS |
| III Tunables | `ADS` in `config/tunables.ts`; gravity in `PLAYER`. PASS |
| IV Tests | Pure logic (auto reload, aim smoothing, migration, jump height) unit-tested; smoke/e2e skipped (owner policy). PASS |
| V Ownership | Touches foundation files (`core`, `config`) at owner request; additive only. JUSTIFIED |
| VI Offline | No assets. PASS |
| VII Simplicity | No scope overlay, no toggle mode. PASS |

## Design decisions
- `aimAmount` is smoothed with `1 - exp(-k dt)` in the weapon `update(dt)` (frame rate) so FOV is smooth at any refresh rate.
- ADS target = RMB held && alive && controls free && not reloading && not sprinting.
- View model: `ViewModelState.aim` shifts the rig towards a per-model ADS offset and damps bob/sway.
- Gravity -22 keeps jump apex: v = sqrt(2 g h): 3.9 m -> 13.1 m/s, air jump 3.3 m -> 12.0 m/s.

## Complexity Tracking
None.
