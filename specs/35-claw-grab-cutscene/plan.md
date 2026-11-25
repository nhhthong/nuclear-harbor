# Implementation Plan: spec 35

**Spec**: [spec.md](spec.md) | **Branch**: `ccr-1b1f2332-o3lx35` (PR #26)

## Summary
`src/boss/grabCam.ts` (pure poses and shot), `src/boss/tunables.ts` (`CRAB.armPose`, `CRAB.grabCam`), `src/boss/CrabBody.ts` and `BossBody.ts` (`BodyAnim` gains `strike`, `clamp`), `src/boss/index.ts` (stage poses, camera, overlays, shakes), `src/core/events.ts` (`camera:shake`), `src/vfx/index.ts` (handler).

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Two small DOM layers and per-frame style writes only while the cutscene blends; no allocation (module-level scratch). PASS (unverified on GPU) |
| II Typed contracts | One new additive event `camera:shake` in the shared `core/events.ts`; the boss does not call the vfx module directly. DECLARED |
| III Tunables | All numbers in `CRAB.grabCam` and `CRAB.armPose`. The overlay colours (`#fff`, `#c01810`) and the bar CSS are literals: JUSTIFIED (presentation). |
| IV Tests | Poses, blend, shot placement and scaling are unit-tested; the glue (camera override, overlays) only by screenshots. JUSTIFIED. |
| V Blast radius | `src/boss/*`, `src/core/events.ts` (shared), `src/vfx/index.ts`. DECLARED |
| VI Offline / procedural | No assets. PASS |
| VII Simplicity | Re-uses the landing cinematic's camera approach (override and blend in `update`) and the vfx trauma shake. PASS |

## Design decisions
- The cutscene camera is blended with the player's own view and does not touch the player's yaw or pitch, so control returns exactly as left.
- The shot stands in front of the claws so the frame holds the boss, the claws and the height.

## Complexity Tracking
None.
