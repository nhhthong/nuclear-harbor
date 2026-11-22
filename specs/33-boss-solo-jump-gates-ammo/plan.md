# Implementation Plan: spec 33

**Spec**: [spec.md](spec.md) | **Branch**: `ccr-1b1f2332-o3lx35`

## Summary
Config: `PLAYER.airJumpSpeed`, `ECONOMY.ammoCratesInZones`, `GATES.gates[].lockedUntilTower`, `GATES.lockedToastEvery`, `SCORPION.stuck`. Logic: `src/structures/gates.ts` (lock, hold, `unlockAll`, `bumped`), `src/scorpion/unstuck.ts` (pure). Wiring: `gateMeshes.ts` (listens to `objectives:allActivated`, toast), `src/enemies/index.ts` + `EnemyManager.sealBossQuay`, `src/config/level.ts` (`ENEMY_DISTRIBUTION`), `src/enemies/population.ts`, `Scorpion.relocate/escape`, `src/pickups/placements.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | One extra boolean per gate, a stuck tracker per scorpion (a distance compare per step); the 16-ray clearance and the relocation ring search run only when stuck. Same roster size; the nav grid gets one `blockRect` call. PASS (unverified on GPU) |
| II Typed contracts | No new event; uses `objectives:allActivated`, `ui:toast`, `world:gateMoved` (existing). PASS |
| III Tunables | All numbers in config (`SCORPION.stuck`, `GATES`, `PLAYER`, `ECONOMY`). The 0.6 x body radius crawl probe and the 8-direction free-spot probe are literals in `Scorpion.ts`: JUSTIFIED (probe geometry). |
| IV Tests | Gate lock, unlock and hold; quay seal and roster distribution; double jump reach and a landing on a container; supply budget; stuck tracker and escape helpers; headless scorpion pockets. The real-yard scorpion behaviour: not tested (JUSTIFIED, in "Not verified"). |
| V Blast radius | `src/config/tunables.ts` (PLAYER, ECONOMY), `src/structures/*`, `src/enemies/EnemyManager.ts` + `index.ts` + `population.ts`, `src/config/level.ts` (shared), `src/scorpion/*`, `src/pickups/placements.ts`, samurai tunables comment. DECLARED |
| VI Offline / procedural | No assets. PASS |
| VII Simplicity | Locked state is two booleans on the existing gate; the quay seal is one flag and one `blockRect`; the escape is crawl-then-teleport, no new nav. PASS |

## Design decisions
- The boss is solo because the quay is empty and then sealed on the nav grid, not because robots are destroyed (owner: the roster stays around the map).
- Quay gates stay open after unlock (`held`): the player must be able to reach the arena and retreat.
- Stuck time counts only while the scorpion is trying to walk, so a skill rotation between short walks still accumulates.
- Relocation checks for a roof by a downward ray, so a spot on top of a container is never chosen.

## Complexity Tracking
None.
