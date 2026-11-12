# Implementation Plan: Player controller (T-01)

**Spec**: ./spec.md | **Stack**: TypeScript strict, three.js, Rapier via `ctx.physics`.

## Constitution check
Tunables from config (+ `src/player/tunables.ts` for footstep distances); no cross-module imports;
ResourceTracker scope; no per-frame allocation (scratch vectors); no new dependency/assets. PASS.

## Structure (only `src/player/**`)
- `movement.ts` - pure maths: `desiredVelocity`, `approachHorizontal`, `clampPitch`, `canSprint`.
- `tunables.ts` - footstep distances (2.2 / 1.8 m).
- `PlayerController.ts` - class: capsule, `fixedUpdate(dt)`, `update(dt, alpha)`, events, kill plane.
- `index.ts` - `createPlayerModule()` wires the controller, hooks, disposal.
- Tests: `movement.test.ts`, `PlayerController.test.ts` (real PhysicsWorld, real InputManager/PlayerState).
- `tests/e2e/T-01-player-controller.e2e.mjs`.

## Fixed tick order
teleport -> impulse -> (external velocity | input accel + gravity) -> `character.move` -> write back real
displacement -> velocity = displacement/dt -> landed/footstep/killplane -> invulnerability countdown.
Camera: prev/current feet position interpolated with `alpha` at eye height.

## Decisions
Grounded vertical velocity is zeroed; snap-to-ground handles slopes/steps. Impact speed = pre-landing
vertical speed. No foundation changes required.
