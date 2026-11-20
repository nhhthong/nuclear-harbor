# Implementation Plan: fences and gates

**Spec**: [spec.md](spec.md) | **Branch**: dev branch `claude/wizardly-cori-697x6r`, squashed with spec 29 into `main` as PR #20 (`95bdaf2`)

## Summary
`src/structures/gates.ts` (pure: layout, `GateState`/`GateSystem`, collider boxes, leaf geometry), `src/structures/gateMeshes.ts` (meshes, colliders, per-step driver that emits `world:gateMoved`), registration in `src/structures/index.ts` (`fixedUpdate`), a `GATE` layer in `src/physics/groups.ts`, `world:gateMoved` in `src/core/events.ts`, an audio route in `src/audio/eventMap.ts`.

## Technical Context
TypeScript strict, Three.js (procedural geometry, canvas chain-link texture), Rapier cuboids, Vitest. Files above plus `src/structures/tunables.ts` (`GATES`), the container livery list in the world module. Tests: `src/structures/gates.test.ts` (6), `src/audio/samples.test.ts` (route).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Fence frame and panel merged (2 draws); 9 leaf pivots with 3 small meshes each; one walker list per step. Frame rate not measured. PASS (unverified on GPU) |
| II Typed contracts | One new event `world:gateMoved` and one new collision layer, both additive; enemies are read through `ctx.enemies` only. PASS |
| III Tunables | `GATES` in `src/structures/tunables.ts`. PASS |
| IV Tests | Layout, clearances and state machine unit-tested; browser walk by the coordinator. The `GATE` layer filters (bullets and nav pass, drones over) have no test: JUSTIFIED, checked only by design. Smoke/e2e skipped. |
| V Blast radius | `src/structures`, `src/physics/groups.ts`, `src/core/events.ts` (shared, additive; the event is declared in the shared file rather than by declaration merging), `src/audio/eventMap.ts`, container livery list. DECLARED |
| VI Offline / procedural | Procedural geometry and canvas texture, no assets. PASS |
| VII Simplicity | Leaves disable their collider while moving or open; no physics-driven doors. PASS |

## Design decisions
- Leaves swing away from the opener (side chosen at the moment it starts opening).
- Fence runs are static world colliders; leaves use the `GATE` layer so the nav bake and bullets ignore them, which lets robots plan through gates and open them on arrival.
- `clearRadius` 2.2 m around the gate centre keeps a gate open while anyone stands in it.

## Complexity Tracking
None.
