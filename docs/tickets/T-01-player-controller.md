# T-01 — Player controller (movement, look, camera)

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 4 (controls), 4.2 (player stats), 16 Player |
| Spec dir | `specs/T-01-player-controller/` |

## Goal

Replace the placeholder fly camera with the real first-person controller: a Rapier kinematic capsule that walks, sprints, collides with the world, falls with gravity and honours the hooks other modules use on `PlayerState` (knockback, grapple override, teleport, control lock). No jump (REVIEW #1).

## Files owned (exclusive)

- `src/player/**` (replace `src/player/index.ts`; keep `createPlayerModule` and id `player`)
- `tests/e2e/T-01-player-controller.e2e.mjs` (browser check, optional but recommended)
- `specs/T-01-player-controller/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ctx.player` (`PlayerState`): you are the only writer of `position`, `velocity`, `grounded`, `sprinting`; you consume `externalVelocity`, `pendingImpulse`, `teleportPending`, `controlsLocked`, `invulnerableFor`
- `ctx.physics.createCharacter()` → `CharacterBody.move / getPosition / setPosition / grounded`, `QueryGroups.playerMove`
- `ctx.input`: `getMoveAxis()`, `isDown('sprint')`, `consumeLookDelta()` (in `update`)
- `PLAYER`, `SIM` tunables; `spawnFor(ctx.flags.sandbox)` from `@/config/level`; `ctx.settings.get('mouseSensitivity')`
- Events in: `game:respawn` (nothing to do beyond honouring `teleportPending`)

## Interfaces provided

- Authoritative `ctx.player.position/velocity/grounded/sprinting` every fixed tick; camera pose every frame
- Events out: `player:landed { impactSpeed }`, `player:footstep { sprinting }` (distance based)
- `ctx.testHooks.player = { getState() }` for tests
- Player capsule collider with meta `{ kind: 'player', damageable: ctx.player }` in `Groups.player` so enemy rays can hit it

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-01-player-controller
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-01-player-controller/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-01-player-controller/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure movement maths first (`src/player/movement.ts` + tests): desired horizontal velocity from axis, yaw and walk/sprint speed (diagonals normalised), acceleration/deceleration towards it, air control factor, gravity integration, pitch clamp.
2. `PlayerController` class: create the capsule with `PLAYER.capsuleRadius/capsuleHalfHeight`, autostep, snap-to-ground and max slope from tunables at the spawn point.
3. `fixedUpdate(dt)`: (a) if `teleportPending` → `character.setPosition(player.position)`, clear flag; (b) add `pendingImpulse` to velocity and zero it; (c) if `externalVelocity` is set, move with exactly that velocity (no input, no gravity) but still through `character.move` so the world blocks it; otherwise apply input acceleration + gravity (zero vertical velocity when grounded); (d) `character.move(velocity * dt)`, write back the real displacement into `player.position` and derive `player.velocity` from it so blocked movement reports zero speed; (e) count down `invulnerableFor`.
4. Sprint only when grounded, moving forward and `sprint` is held. `controlsLocked` or a dead player → no input movement and no look.
5. Kill plane: below `PLAYER.killPlaneY` apply lethal damage with source `environment` (falling into the sea).
6. `update(dt, alpha)`: apply mouse look (`PLAYER.lookRadPerPixel * sensitivity`), clamp pitch, then pose the camera at the eye position interpolated between the previous and current fixed positions with `alpha`; rotation order `YXZ`.
7. Emit `player:landed` on air → ground transitions with the vertical impact speed, and `player:footstep` every ~2.2 m walked (1.8 m sprinting) while grounded (put the distances in `src/player/tunables.ts`).
8. Unit-test the controller headless with a real `PhysicsWorld` (see `src/physics/PhysicsWorld.test.ts`): walk speed, sprint speed, wall blocking, step-up on a 0.3 m step, gravity/landing, external velocity, impulse, teleport.
9. e2e: in `?sandbox&autostart` hold `KeyW` via `ctx.input.handleCode` and assert the measured speed and that the wall at z = -34 stops the player.

## Acceptance criteria

- [ ] **AC1** Walking speed is 5 m/s and sprint speed 7.5 m/s (±3%) on flat ground; diagonal movement is not faster.
- [ ] **AC2** The player cannot pass through static colliders (containers, wall) and steps onto the 0.3 m sandbox step without input other than forward.
- [ ] **AC3** With no ground below, the player falls with `SIM.gravity`; landing emits `player:landed`; falling below the kill plane kills the player.
- [ ] **AC4** Mouse look updates yaw/pitch with pitch clamped to ±`PLAYER.maxPitchDeg`; camera matches `PlayerState` each frame and is smooth at render rates above 60 Hz (interpolated).
- [ ] **AC5** Setting `ctx.player.externalVelocity` moves the player at that velocity ignoring input and gravity, still blocked by geometry; clearing it resumes normal control.
- [ ] **AC6** `ctx.player.addImpulse()` produces a knockback that decays through normal deceleration; `ctx.player.teleport()` moves the capsule on the next tick.
- [ ] **AC7** There is no jump; Space does nothing in this module.
- [ ] **AC8** No movement or look while `controlsLocked` is true or the player is dead.

## Notes

The placeholder in `src/player/index.ts` shows the expected spawn and camera sync. Enemy projectiles hit the player through the capsule collider meta, so do not skip the `damageable` meta.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-01
# manual: npm run dev → http://localhost:5173/?sandbox  (click to lock the pointer, WASD + Shift)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
