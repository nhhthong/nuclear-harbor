# T-16 — Game flow, level population and vertical slice

| | |
|---|---|
| Wave | 3 |
| Depends on | T-01 … T-15 merged |
| GDD sections | 3 (core loop), 4.2 (death), 8.2 (failure), 9.3 (victory), 6 (30 robots), 6.3 (placement), 5.4 (pickup placement), 15.1 (vertical slice), 16 (all), 17.8; REVIEW #6, #7 |
| Spec dir | `specs/T-16-game-flow-integration/` |

## Goal

Tie the modules into a complete, replayable game: death → checkpoint respawn or Game Over, countdown expiry → Nuclear Failure, boss defeat → Victory, restart; final placement of the 30 robots and the pickups in the built harbor; and the scripted vertical-slice and full-run checks that gate further content work.

## Files owned (exclusive)

- `src/flow/**` (replace `src/flow/index.ts`; keep `createFlowModule` and id `flow`)
- `src/enemies/population.ts` (ownership transferred from T-05)
- `src/pickups/placements.ts` (ownership transferred from T-09)
- `tests/e2e/T-16-vertical-slice.e2e.mjs`, `tests/e2e/T-16-full-run.e2e.mjs`
- `docs/PLAYTEST.md` (new: findings and tuning notes)
- `tests/e2e/T-16-game-flow-integration.e2e.mjs` (browser check, optional but recommended)
- `specs/T-16-game-flow-integration/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- Everything on `GameContext`; all `testHooks` (tests only)
- Events in: `player:died`, `countdown:expired`, `boss:defeated`, `game:checkpoint`, `game:requestRespawn`, `game:requestRestart`, `objectives:allActivated`, `game:stateChanged`
- `ctx.player.revive(position, yaw)`, `ctx.state.set(...)`, `spawnFor`, `ENEMY_DISTRIBUTION`, `ZONES`, `TOWERS`, `KEEP_CLEAR`, T-03 lanes (`testHooks.world.lanes`) as data for charger placement
- LocalStorage for best result (GDD 14)

## Interfaces provided

- Events out: `game:over { reason }`, `game:victory { timeRemaining }`, `game:respawn { checkpointId, position }`; state transitions to `gameOver` / `victory` / `playing`
- Final `getPopulation(ctx)` (14 sphere / 10 spider / 6 charger with patrol routes) and final pickup placements
- `ctx.testHooks.flow = { getCheckpoint(), respawn(), stats() }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-16-game-flow-integration
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-16-game-flow-integration/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-16-game-flow-integration/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure flow logic with tests (`FlowState.ts`): stores the latest checkpoint (default = level spawn), decides outcomes: `player:died` → `gameOver` with reason `player-died` (respawn allowed); `countdown:expired` → `gameOver` with reason `countdown-expired` (restart only); `boss:defeated` → `victory`; ignores events once the run has ended; tracks run stats (time, kills, shots/hits for accuracy).
2. Respawn (REVIEW #7): on `game:requestRespawn` (only after `player-died`): `ctx.player.revive(checkpoint.position, checkpoint.yaw)`, emit `game:respawn`, set state `playing`. The countdown is not reset; destroyed robots, activated towers and boss damage persist; other modules react to `game:respawn` themselves (weapon ammo floor, enemies drop aggro, grapple reset).
3. Restart: `game:requestRestart` → `window.location.reload()` (simple and leak-free for v1; keep the query string). Record the choice in the plan; T-17 may replace it with an in-place restart.
4. Victory: on `boss:defeated` wait ~3 s for the collapse, then emit `game:victory` and set state `victory`. Store best time remaining and a "completed" flag in LocalStorage (`nuclear-harbor.best.v1`); show it through `ui:toast` at the menu or expose via test hook.
5. Population (`src/enemies/population.ts`): replace the random harbor placement with authored data honouring `ENEMY_DISTRIBUTION`: Chargers at the ends of the straight lanes reported by the world module and in the long warehouse corridor / open dock ground (GDD 6.3); spheres patrolling loops around towers and intersections; spiders near cover with flank room. Nothing within 40 m of the player spawn; tower 1 (Easy) lightly guarded, tower 4 (Very Hard) heaviest. Validate at runtime that every spawn and patrol point is on a walkable nav cell (warn and nudge otherwise). Keep the sandbox behaviour unchanged.
6. Pickups (`src/pickups/placements.ts`): final positions for 14 crates / 10 medkits in zones and 8 / 3 at the arena: near Charger areas and towers, several on container tops and perches reachable by grapple (GDD 5.4). Keep the counts test green.
7. Vertical slice (GDD 15.1) in the sandbox: `/?sandbox&autostart&enemies=sphere,charger&countdown=600` — move, shoot, grapple, one sphere, one Charger, one tower, ammo crate, greybox boss (the single sandbox tower already emits `objectives:allActivated`, which spawns the scaled boss). Any glue needed goes in your own module only.
8. `tests/e2e/T-16-vertical-slice.e2e.mjs`: scripted run in the sandbox using synthetic input and test hooks: walk, shoot a dummy, grapple the pillar, kill the sphere, survive/stun the Charger, collect the crate, activate the tower, boss spawns, destroy weak points and core → state `victory`; assert zero console errors.
9. `tests/e2e/T-16-full-run.e2e.mjs`: in the harbor with hooks (`forceActivate`, `damageCore`) assert the full state path menu → playing → all four towers → boss → victory, plus the two failure paths (death → gameOver → respawn at last tower checkpoint with countdown unchanged; `countdown=3` → gameOver without respawn option).
10. Play the slice and the full level manually; write `docs/PLAYTEST.md`: time to finish, ammo used vs budget, deaths, navigation problems, feel issues, and concrete tunable changes proposed (do not edit `tunables.ts`: list requests in `foundation-requests.md`).

## Acceptance criteria

- [ ] **AC1** Player death sets `gameOver` with reason `player-died`; choosing respawn revives the player at the most recent checkpoint (last activated tower or boss start, otherwise the level spawn) with full HP, and the countdown value is unchanged.
- [ ] **AC2** Countdown expiry sets `gameOver` with reason `countdown-expired` and offers no respawn.
- [ ] **AC3** Defeating the boss leads to the `victory` state and stores the best result in LocalStorage; restart begins a fresh run.
- [ ] **AC4** The harbor run contains exactly 14 sphere, 10 spider and 6 Charger robots at authored positions on walkable cells, with most Chargers on the yard lanes, none within 40 m of the spawn.
- [ ] **AC5** Pickup placement totals match the economy (14 + 8 crates, 10 + 3 medkits) with several requiring the grapple.
- [ ] **AC6** The scripted vertical-slice check passes end to end in the sandbox with no console errors.
- [ ] **AC7** The scripted full-run check passes for the success path and both failure paths.
- [ ] **AC8** `docs/PLAYTEST.md` records a manual playthrough of the slice and the full level with proposed tuning changes.
- [ ] **AC9** Flow decisions are pure and unit tested, including "ignore events after the run ended".

## Notes

This ticket is the vertical-slice gate (GDD 15.1): if the loop is not fun, report it in `docs/PLAYTEST.md` before more content is built. Fix integration bugs in other modules only through their owners (list them in the hand-over) unless the Tech Lead assigns the fix to you.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e
# manual: npm run dev → http://localhost:5173/   (full game)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
