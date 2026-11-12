# T-08 — Activation towers and nuclear countdown

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 8, 8.1, 8.2, 3 (core loop), 16 Objectives; REVIEW #6, #7, #8 |
| Spec dir | `specs/T-08-objectives/` |

## Goal

Implement the main objective: four activation towers (hold E for 5 s within 2 m, interrupted by leaving or dying, defend pull of nearby robots) and the 20-minute nuclear countdown that fails the run when it expires and stops when all four towers are active, which triggers the boss event.

## Files owned (exclusive)

- `src/objectives/**` (replace `src/objectives/index.ts`; keep `createObjectivesModule` and id `objectives`)
- `tests/e2e/T-08-objectives.e2e.mjs` (browser check, optional but recommended)
- `specs/T-08-objectives/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `TOWERS` from `@/config/level`; `OBJECTIVES` tunables; `ctx.flags.params` (`?countdown=<seconds>`, `?towers=<n>` already active, for testing)
- `ctx.player` (`position`, `alive`), `ctx.input.isDown('interact')`
- `ctx.physics.addStaticBox` for the tower body collider
- Events in: `world:ready`, `player:died`, `game:respawn`

## Interfaces provided

- Events out: `tower:registered` (once per tower, from the `world:ready` handler), `tower:activationStarted`, `tower:activationProgress`, `tower:activationCancelled`, `tower:activated`, `objectives:defendStarted`, `objectives:allActivated`, `countdown:tick` (1 Hz), `countdown:stopped`, `countdown:expired`, `interact:prompt`, `game:checkpoint { id: 'tower-<n>' }` on each activation (REVIEW #7)
- `ctx.testHooks.objectives = { getState(): { towers: {id, active, progress}[], remaining }, forceActivate(id), setRemaining(seconds) }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-08-objectives
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-08-objectives/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-08-objectives/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure logic first with tests: `NuclearCountdown` (`step(dt)` → tick events once per whole second, `critical` below `countdownCriticalSeconds`, `stop()`, `expired` exactly once, never negative) and `TowerActivation` (`step(dt, { inRange, holding, playerAlive })` → started / progress / cancelled(reason) / activated; progress resets on interruption per `OBJECTIVES.activationResetInstant`; an activated tower ignores input).
2. `TowerManager`: builds four towers from `TOWERS` in the harbor; in `?sandbox` builds ONE tower at (8, 0, 2) (and the total is then 1). Total count comes from the built list, not a literal.
3. Tower model (procedural): hexagonal/cylindrical pillar ~3 m high with a console, an emissive ring and a tall thin light beam so it reads from afar; red/amber when inactive, pulsing while activating, green with a burst (`vfx:spawn`) when active (GDD 8.1). One static collider per tower; no collider on the beam.
4. Interaction: when the player is within `OBJECTIVES.interactRange` of the nearest inactive tower emit `interact:prompt { text: 'Hold E to activate' }` (and `{ text: null }` when leaving); feed `inRange`/`holding` into `TowerActivation` in `fixedUpdate`; emit progress events at most 10 times per second.
5. On the first `activationStarted` of each tower emit `objectives:defendStarted { towerId, position, radius: OBJECTIVES.defendPullRadius }` once (the enemies module pulls existing robots; no spawns, REVIEW #6).
6. On activation: emit `tower:activated` (with `activatedCount`/`total`), `game:checkpoint` (position = a safe spot 2 m in front of the tower, yaw facing away), `ui:toast`. When the last tower activates: stop the countdown, emit `countdown:stopped` then `objectives:allActivated { timeRemaining }`.
7. Countdown: starts at `OBJECTIVES.countdownSeconds` (override with `?countdown=`) when the game first enters `playing`; advances only in `fixedUpdate` (so it pauses with the game); on expiry emit `countdown:expired` once. The flow module (T-16) turns that into Game Over; do not change game state here.
8. Death/respawn: `player:died` cancels an in-progress activation with reason `died`; the countdown is NOT reset on `game:respawn` (REVIEW #7).
9. `?towers=3` pre-activates the first n towers after `world:ready` (emitting the normal events) to make later phases testable.
10. e2e: `?sandbox&autostart&countdown=5`: teleport next to the tower, hold `KeyE` via `ctx.input.handleCode` for 5.2 s → `tower:activated` and `objectives:allActivated`; second run: release at 3 s → cancelled and progress reset; third run: let the countdown expire → `countdown:expired` exactly once.

## Acceptance criteria

- [ ] **AC1** Four towers exist at the `TOWERS` positions in the harbor (one sandbox tower in `?sandbox`), each emitting `tower:registered` after `world:ready`.
- [ ] **AC2** Holding E within 2 m for 5 s activates a tower; leaving the range, releasing E or dying interrupts and resets progress with the correct `reason`.
- [ ] **AC3** An activated tower turns green with an effect, emits `tower:activated` with correct counts and a `game:checkpoint`, and cannot be activated again.
- [ ] **AC4** Starting an activation emits `objectives:defendStarted` once per tower with the tower position and pull radius.
- [ ] **AC5** The countdown starts at 20:00, ticks once per second only while the game is `playing`, flags `critical` under 2:00 and emits `countdown:expired` exactly once at zero.
- [ ] **AC6** Activating the last tower stops the countdown and emits `objectives:allActivated` with the time remaining; the countdown does not expire afterwards.
- [ ] **AC7** The interact prompt appears only near an inactive tower and hides otherwise.
- [ ] **AC8** Countdown and activation logic are pure classes covered by unit tests (including pause, interruption and exact-once semantics).

## Notes

Tower 3 stands at y = 10 on a platform built by T-04; place the tower at the `TOWERS` y coordinate and do not build the platform. The HUD (T-06) and audio (T-07) are driven purely by your events.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-08
# manual: npm run dev → http://localhost:5173/?sandbox&countdown=60
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
