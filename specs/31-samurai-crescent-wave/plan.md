# Implementation Plan: samurai crescent wave, frontal spin

**Spec**: [spec.md](spec.md) | **Branch**: dev branch `claude/wizardly-cori-697x6r`; squashed into `main` as PR #21 (`93f873e`) with spec 32

## Summary
Mostly in `src/enemies/samurai/`: `tunables.ts` (`SAMURAI.wave`), `logic.ts` (pure `crescentHit`), `Samurai.ts` (states `waveCharge`, `waveSlash`, `waveRecover`; `crescentShape`, `crescentRibbon`, one pooled crescent per samurai, `releaseWave`, `stepWave`, `endWave`; the skinned spin uses Euler order ZYX with the weapon pushed forward by `SPIN_FORWARD`). One shared edit: `enemy:waveReleased` in `src/core/events.ts`, emitted at release, routed in `src/audio/eventMap.ts` (spec 32).

## Technical Context
TypeScript strict, Three.js (shader ribbon, additive layers), Vitest. Tests: `src/enemies/samurai/logic.test.ts` (hit volume, speed vs bullet, damage vs cut and leap, `crescentShape`, `crescentRibbon`).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | One crescent group (3 small meshes) per samurai, created once, hidden when idle; one ray per fixed step while it flies; embers use the pooled `vfx:spawn`. PASS |
| II Typed contracts | One new event `enemy:waveReleased`, additive, in the shared `core/events.ts`; otherwise reuses `enemy:attacked`, `vfx:spawn` and the player damage API. PASS |
| III Tunables | `SAMURAI.wave` holds the skill numbers. `SAMURAI.spin.fanForward` (0.55) and `SAMURAI.wave.aimMinCos` (0.82, about 35 degrees) were moved into tunables on 2026-11-21. PASS. |
| IV Tests | `crescentHit`, `crescentShape`, `crescentRibbon`, numbers unit-tested. Spin orientation, skill selection, wall/gate rules and the event have no test. Browser check by the coordinator. Smoke/e2e skipped. |
| V Blast radius | Samurai module, plus the additive event in `core/events.ts` and its route in `audio/eventMap.ts` (the earlier plan said "samurai module only", which was wrong). DECLARED |
| VI Offline / procedural | Procedural geometry and shader, no assets. PASS |
| VII Simplicity | Straight flight, single hit, no homing. PASS |

## Design decisions
- The crescent stands in the vertical plane of its flight and bulges forward, with a slim strip facing the flight that carries the glow.
- Aim at the player's position at release, clamped to about 35 degrees off the facing (it is a forward cut).
- The skinned spin: stand the weapon up (pitch +90), roll about the facing axis, hold 0.55 m in front of the grip; the blur disc shares the plane.
- Static world ray each step: walls stop it; chain-link (gate layer) does not block the ray.

## Complexity Tracking
None.
