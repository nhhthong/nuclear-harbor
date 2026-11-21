# Implementation Plan: spec 33

**Spec**: [spec.md](spec.md) | **Branch**: `ccr-1b1f2332-o3lx35`

## Summary
Config: `PLAYER.airJumpSpeed`, `ECONOMY.ammoCratesInZones`, `GATES.gates[].lockedUntilTower`, `GATES.lockedToastEvery`, `SCORPION.stuck`. Logic: `src/structures/gates.ts` (lock, hold, `unlockAll`, `bumped`), `src/scorpion/unstuck.ts` (pure). Wiring: `gateMeshes.ts` (listens to `objectives:allActivated`, toast), `src/enemies/index.ts` + `EnemyManager.clearForBoss`, `src/scorpion/index.ts` + `Scorpion.retire/relocate/escape`, `src/pickups/placements.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | One extra boolean per gate, a stuck tracker per scorpion (a distance compare per step); the 16-ray clearance and the relocation ring search run only when stuck. Removing the quay roster lowers load. PASS (unverified on GPU) |
| II Typed contracts | No new event; uses `objectives:allActivated`, `ui:toast`, `world:gateMoved` (existing). `Scorpion.retire()` is public on the module's own class. PASS |
| III Tunables | All numbers in config (`SCORPION.stuck`, `GATES`, `PLAYER`, `ECONOMY`). The 0.6 x body radius crawl probe and the 8-direction free-spot probe are literals in `Scorpion.ts`: JUSTIFIED (probe geometry). |
| IV Tests | Gate lock, unlock and hold; clearForBoss; double jump reach and a landing on a container; supply budget; stuck tracker and escape helpers; headless scorpion pockets. Scorpion retire and the real-yard behaviour: not tested (JUSTIFIED, in "Not verified"). |
| V Blast radius | `src/config/tunables.ts` (PLAYER, ECONOMY), `src/structures/*`, `src/enemies/EnemyManager.ts` + `index.ts`, `src/scorpion/*`, `src/pickups/placements.ts`, samurai tunables comment. DECLARED |
| VI Offline / procedural | No assets. PASS |
| VII Simplicity | Locked state is two booleans on the existing gate; boss-solo is one flag and a `killAll`; the escape is crawl-then-teleport, no new nav. PASS |

## Design decisions
- The boss is solo by destroying robots instead of despawning silently: explosions read as the relay "overloading" the field, and kill events/drops stay consistent.
- Quay gates stay open after unlock (`held`): the player must be able to reach the arena and retreat.
- Stuck time counts only while the scorpion is trying to walk, so a skill rotation between short walks still accumulates.
- Relocation checks for a roof by a downward ray, so a spot on top of a container is never chosen.

## Complexity Tracking
None.
