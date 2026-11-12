# Feature Specification: Activation towers and nuclear countdown (T-08)

**Input**: docs/tickets/T-08-objectives.md; GDD 8, 8.1, 8.2, 3, 16; REVIEW #6, #7, #8.

## User Scenarios
1. **Activate a tower (P1)**: near an inactive tower the player sees "Hold E to activate"; holding E within 2 m for 5 s turns it green, stores a checkpoint, toasts progress.
2. **Interrupt (P1)**: leaving range, releasing E or dying cancels and resets progress (reason `left-range` / `released` / `died`).
3. **Countdown (P1)**: 20:00 starts when the game first enters `playing`, ticks 1 Hz while playing, critical under 2:00, emits `countdown:expired` exactly once at 0; stops when the 4th tower activates (`objectives:allActivated` with time remaining).
4. **Defend (P2)**: first activation start per tower emits `objectives:defendStarted` (pull of existing robots; no spawns, REVIEW #6).
5. **Test hooks (P3)**: `?countdown=<s>`, `?towers=<n>`, `ctx.testHooks.objectives`.

## Requirements
- FR-1 Build one tower per `TOWERS` entry (harbor) or ONE tower at (8,0,2) in `?sandbox`; total derives from the list. Emit `tower:registered` from the `world:ready` handler.
- FR-2 `TowerActivation` pure state machine (started / progress / cancelled(reason) / activated); activated tower ignores input; reset instant per `OBJECTIVES.activationResetInstant`.
- FR-3 `NuclearCountdown` pure class: whole-second ticks, `critical`, `stop()`, `expired` once, never negative.
- FR-4 Procedural tower model (pillar, console, emissive ring, beam; red/amber -> pulse -> green + `vfx:spawn` burst); one static collider per tower, none on beam.
- FR-5 `interact:prompt` only near nearest inactive tower; progress events <= 10 Hz.
- FR-6 On activation: `tower:activated`, `game:checkpoint` (`tower-<n>`, 2 m in front, yaw facing away), `ui:toast`. Last: `countdown:stopped` then `objectives:allActivated`.
- FR-7 Countdown only advances in `fixedUpdate`; not reset on `game:respawn`; game state is never changed here.

## Assumptions
- Countdown starts on the first `fixedUpdate` call (which only runs in `playing`).
- "In front of the tower" = toward the player's side (direction tower to player at activation); yaw faces away from the tower.
- `?towers=n` pre-activation happens on `world:ready` using the normal activation path and events.
- In range = horizontal distance <= `interactRange` and |dy| < 2.5.

## Success Criteria
AC1-AC8 of the ticket; unit tests for both pure classes; sandbox e2e.
