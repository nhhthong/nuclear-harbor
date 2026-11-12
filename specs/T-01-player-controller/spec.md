# Feature Specification: Player controller (T-01)

**Input**: `docs/tickets/T-01-player-controller.md`, GDD 4, 4.2, 16 (Player). Non-interactive run.

## User Scenarios

### US1 - Walk and sprint (P1)
As a player I move with WASD at 5 m/s, hold Shift to sprint at 7.5 m/s, and look with the mouse.
- Given flat ground, when W is held, speed is 5 m/s (7.5 sprinting) within 3%; diagonals are not faster.
- Given mouse movement, yaw/pitch update; pitch is clamped to +/-89 deg; camera follows, interpolated between fixed ticks.

### US2 - Collide with the world (P1)
- Given a wall or container, the player is blocked and reports zero speed into it.
- Given a 0.3 m step, forward input alone climbs it.
- Given no ground, the player falls with `SIM.gravity`, emits `player:landed {impactSpeed}` on landing, and below the kill plane takes lethal `environment` damage.

### US3 - Cooperate with other modules (P1)
- `externalVelocity` set: move at exactly that velocity, no input/gravity, still blocked by geometry; cleared: normal control resumes.
- `addImpulse()` becomes knockback decaying through normal deceleration; `teleport()` moves the capsule next tick.
- `controlsLocked` or dead: no input movement, no look.
- Space does nothing (no jump).

## Requirements
- FR-001 Replace placeholder; keep `createPlayerModule` and id `player`.
- FR-002 Sole writer of `player.position/velocity/grounded/sprinting`; capsule collider meta `{kind:'player', damageable: ctx.player}`.
- FR-003 Emit `player:footstep {sprinting}` every 2.2 m (1.8 m sprinting) walked while grounded.
- FR-004 `ctx.testHooks.player = { getState() }`.
- FR-005 Count down `invulnerableFor`; sprint only when grounded, moving forward, key held.
- FR-006 Numbers from `@/config/tunables` or `src/player/tunables.ts`; resources via `ctx.resources.scope('player')`.

## Assumptions
- Air control uses `PLAYER.airControl`; knockback decays at `groundDecel` when grounded (air: scaled by airControl).
- Dead player: horizontal velocity decays, gravity still applies, no input.
- Kill plane applies lethal damage once per life (`alive` guard).
- Ticket ACs map to unit tests (`src/player/*.test.ts`) and `tests/e2e/T-01-player-controller.e2e.mjs`.

## Success criteria
AC1-AC8 of the ticket pass (tests named `AC<n>`); typecheck, tests, build, smoke and e2e green.
