# Implementation Plan: spec 34

**Spec**: [spec.md](spec.md) | **Branch**: `ccr-1b1f2332-o3lx35`

## Summary
Pure logic in `src/boss/skills.ts` (`inPhaseTwo`, `clawPoint`, `lungeEnd`, `grabConnects`, `grabCarry`, `QuakeWaves`, `quakeDuration`; spin removed); numbers in `src/boss/tunables.ts` (`CRAB.phase2`, `CRAB.grab`, `CRAB.quake`, cooldowns and weights); glue in `src/boss/index.ts` (grab stages, quake pounds, release on reset); visuals in `src/boss/BossEffects.ts` (ring pool, `launchRing`) and `src/boss/CrabBody.ts` (`BodyAnim.claw`); `src/boss/Drones.ts` (`onShotDown`); pickups (`src/pickups/logic.ts`, `index.ts`, `ECONOMY.droneDrop*`); `src/world/shelters.ts` (quay shelters removed); ids and routes (`core/types.ts`, `audio/eventMap.ts`, `vfx/mapping.ts`); event `boss:droneDestroyed` (`core/events.ts`).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | One instanced ring mesh (6 instances, 1 draw call); no per-frame allocation in the new code paths (scratch vectors, a ring array allocated once). PASS (unverified on GPU) |
| II Typed contracts | One new event `boss:droneDestroyed` and two `BossAttackId` values (`claw-grab`, `claw-quake`), both additive and declared in the shared files (`core/events.ts`, `core/types.ts`), removing `body-spin`; the pickups module reads the event, not the boss. DECLARED |
| III Tunables | All numbers in `CRAB.*` and `ECONOMY.droneDrop*`. The carry teleports the player each step (no tunable needed). PASS |
| IV Tests | Skill selection, claw point, lunge, connect rule, carry profile, quake waves, drop kind and chance, shelters. The boss module glue (lunge, carry, rings) is covered only by the browser check; JUSTIFIED (needs the GLB and the full context). |
| V Blast radius | `src/boss/*`, `src/pickups/*`, `src/world/shelters.ts`, `src/config/tunables.ts` (ECONOMY), `src/core/types.ts` and `events.ts` (shared, additive), `src/audio/eventMap.ts`, `src/vfx/mapping.ts`. DECLARED |
| VI Offline / procedural | No assets; arm rotation and an HDR ring. PASS |
| VII Simplicity | Re-uses the arm nodes (no claw model) and the existing marker pool; the carry is a per-step teleport of a locked player. PASS |

## Design decisions
- The grab lunge target freezes 0.4 s before the lunge and is marked on the ground: the warning is fair and dodgeable by moving or jumping.
- Slam damage 70 (not 100): a full-health player survives, a hurt one does not; the dragonfly drops give the only healing on the quay.
- Quake rings are an expanding band tested by sweeping the ring's front over the player's distance each step, so a fast ring cannot tunnel through a player.
- The carried player is teleported to the claw point every step with controls locked; `releasePlayer` runs from `resetSkill`, so a respawn or the boss's death always frees them.

## Complexity Tracking
None.
