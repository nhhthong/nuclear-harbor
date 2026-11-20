# Implementation Plan: fences and gates

**Spec**: [spec.md](spec.md)

## Summary
`src/structures/gates.ts` (pure: layout, `GateState`/`GateSystem`, collider boxes, leaf geometry), `src/structures/gateMeshes.ts` (meshes, colliders, per-step driver), registration in `src/structures/index.ts` (`fixedUpdate`), a GATE layer in `src/physics/groups.ts`, `world:gateMoved` in `src/core/events.ts`, an audio route.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Fence frame and panel merged (2 draws); 9 leaf pivots with 3 small meshes each; no per-step allocation beyond a walker list. PASS |
| II Typed contracts | One new event `world:gateMoved`; one new collision layer; enemies read through `ctx.enemies` only. PASS |
| III Tunables | `GATES` in `src/structures/tunables.ts`. PASS |
| IV Tests | Layout and state machine unit tests; browser walk by the coordinator. PASS |
| V Blast radius | structures, physics groups, events, audio map. DECLARED |
| VI Offline / procedural | Procedural geometry, canvas chain-link texture. PASS |
| VII Simplicity | Leaves disable their collider while moving or open; no physics-driven doors. PASS |
