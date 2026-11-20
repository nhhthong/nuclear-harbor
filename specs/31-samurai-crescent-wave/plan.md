# Implementation Plan: samurai crescent wave, frontal spin

**Spec**: [spec.md](spec.md)

## Summary
All in `src/enemies/samurai/`: `tunables.ts` (`wave`), `logic.ts` (`crescentHit`), `Samurai.ts` (states `waveCharge`, `waveSlash`, `waveRecover`; `crescentShape`, one pooled crescent per samurai in the scene, `releaseWave`, `stepWave`, `endWave`; skinned spin uses Euler order ZYX with the weapon pushed forward).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | One crescent group (3 small meshes) per samurai, created once, hidden when idle; one ray per fixed step while it flies. PASS |
| II Typed contracts | No new events; reuses `enemy:attacked`, `vfx:spawn`, player damage API. PASS |
| III Tunables | `SAMURAI.wave`, `SPIN_FORWARD` constant. PASS |
| IV Tests | `crescentHit`, `crescentShape`, numbers; browser check by the coordinator. PASS |
| V Blast radius | samurai module only. PASS |
| VI Offline / procedural | Procedural geometry. PASS |
| VII Simplicity | Straight flight, single hit, no homing. PASS |
