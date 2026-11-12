# T-14 — Charger robot (shielded rhino)

| | |
|---|---|
| Wave | 2 |
| Depends on | T-05 (hard). Soft: T-01 for feeling the knockback (the `PlayerState.addImpulse` contract already exists) |
| GDD sections | 6.3, 5.4 (front armour note), 13.7 (always high-rate while winding up/charging), 16 Enemies, 15.2 (must not be cut) |
| Spec dir | `specs/T-14-charger-robot/` |

## Goal

Replace the charger placeholder with the Charger: a heavy shielded robot that telegraphs for 1 s, then charges in a locked straight line at 10-12 m/s, knocks the player back on contact, is stunned for 2.5 s when it hits a wall or container, never runs off the dock edge, takes 90% less damage from the front and crits from behind.

## Files owned (exclusive)

- `src/enemies/charger/**` only (replace the stub `src/enemies/charger/index.ts` created by T-05; keep the `createChargerRobot: EnemyFactory` export)
- `tests/e2e/T-14-charger-robot.e2e.mjs` (browser check, optional but recommended)
- `specs/T-14-charger-robot/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- The enemy framework from T-05 (read `specs/T-05-enemy-framework-sphere/` and `src/enemies/BaseEnemy.ts` first): `BaseEnemy`, `EnemyDeps`, `StateMachine`, scheduler `forceHighRate`
- `CHARGER_ROBOT` tunables; `isFrontalHit`, `resolveDamage` from `@/combat/damage`
- `ctx.physics.raycast` (`QueryGroups.worldOnly`) for obstacle and edge probes; `isOnLand`, `DOCK_EDGE_Z`, `LAND` from `@/config/level`
- `ctx.player`: `position`, `applyDamage`, `addImpulse`, `alive`

## Interfaces provided

- `createChargerRobot` factory (`type: 'charger'`, 200 HP)
- Events out: `charger:windup`, `charger:chargeStarted`, `charger:stunned`, `charger:hitPlayer` (+ base class enemy events)
- States in `enemy.state`: `patrol`, `detect`, `windup`, `charge`, `stunned`, `recover`, `destroyed`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-14-charger-robot
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-14-charger-robot/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-14-charger-robot/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure charge planner first with tests (`chargePlan.ts`): `planCharge(origin, direction, probes)` → `{ maxDistance, endsAt: 'wall' | 'edge' | 'range' }` where probes report obstacle distance and the first point without ground along the line; `maxDistance` = min(`maxChargeDistance`, obstacle distance, edge distance − safety margin). Also `canStartCharge(distance, hasLos, cooldownLeft)` (8-25 m window) and the damage-zone function `zoneForHit(facing, attackDir, stunned)`.
2. State machine (GDD 6.3): `patrol` (3 m/s on waypoints) → `detect` (25 m, LOS; turn to face, approach until in the 8-25 m window) → `windup` for `telegraphDuration` (the robot keeps turning towards the player during the wind-up; the direction is locked at the moment the charge begins and is never steered afterwards, so the player dodges as the charge starts) → `charge` at a speed in [`chargeSpeedMin`, `chargeSpeedMax`] → end by wall hit (`stunned` 2.5 s, rear exposed), by reaching `maxDistance`/edge (`recover` for `recoverDuration`), or by hitting the player (continue to the planned end) → `cooldown` ~6 s folded into `recover`/`detect` before the next charge.
3. Telegraph (all three required by GDD 6.3): red emissive lights ramping up on the robot, `charger:windup` event (audio hooks into it), and a red line/strip on the ground along the planned charge path with its length = planned `maxDistance`. Draw the strip yourself (a flat quad, pooled, one per charger).
4. Charging: move kinematically along the locked direction; each fixed tick probe ahead (`edgeProbeDistance`) with a forward ray for obstacles and a downward ray for missing ground. Obstacle contact → stop, `charger:stunned`, `vfx:spawn`. Missing ground / leaving land → stop before the edge (never fall into the sea).
5. Player contact during a charge: capsule-vs-box distance test (cheap, no physics events): `ctx.player.applyDamage({ amount: 20, source: 'enemy', ... })` once per charge, `ctx.player.addImpulse(direction * knockbackSpeed + up * knockbackUp)`, emit `charger:hitPlayer`.
6. Damage model: override `applyDamage` so the zone is decided from the hit direction: frontal arc (`frontArcHalfAngleDeg`) → `armor` with multiplier `frontDamageMultiplier` (0.1); otherwise → `critical` (x2, GDD "back and flanks"). While `stunned` the same rule applies but the robot does not turn, so the rear is exposed. Return the final zone in `DamageResult` so the HUD/VFX show deflection vs crit.
7. Scheduling: set `forceHighRate` while in `windup`/`charge` so the scheduler never drops below the near rate (GDD 13.7).
8. Model: low wide body (box), a large angled front shield plate, glowing rear vent (the weak spot), two side lights. Rear vent visibly brighter while stunned. Shared geometry/materials. Colliders: one body box in `Groups.enemy` (zone decided in code).
9. `commandMoveTo` (tower defence pull) is deferred while in `windup`/`charge`/`stunned`.
10. e2e: `?sandbox&autostart&enemies=charger`: place the player 15 m in front → `charger:windup` then `charger:chargeStarted` ~1 s later; step aside so it hits the sandbox wall → `charger:stunned` and state `stunned` for ~2.5 s; `applyDamage` with a frontal direction deals 2.5, from behind 50; a charge towards the slab edge stops before the edge (robot stays on the slab).

## Acceptance criteria

- [ ] **AC1** The Charger has 200 HP, walks at 3 m/s and starts a charge only when the player is 8-25 m away with line of sight and the ~6 s cooldown has elapsed.
- [ ] **AC2** Before every charge there is a 1.0 s telegraph with red lights, a `charger:windup` event and a red ground strip along the charge path.
- [ ] **AC3** The charge direction is locked when the charge starts and is not steered; speed is 10-12 m/s; the charge ends after at most 30 m.
- [ ] **AC4** Hitting a wall or container stuns the Charger for 2.5 s (state `stunned`, `charger:stunned` emitted) with its rear exposed; missing ends in a recover phase.
- [ ] **AC5** Contact with the player during a charge deals 20 damage once and knocks the player back (`addImpulse`).
- [ ] **AC6** The Charger never leaves the land or drops off the dock/slab edge while charging (unit test on the planner + e2e).
- [ ] **AC7** Shots from the front arc deal 10% damage (zone `armor`); shots from the flanks/rear deal 2x (zone `critical`), verified by unit tests with directions.
- [ ] **AC8** While winding up or charging the AI is updated at the high rate regardless of distance.
- [ ] **AC9** Planner, start conditions and hit-zone logic are pure and unit tested.

## Notes

Resolve the wind-up/lock wording as: track during wind-up, lock at charge start (GDD: "Hướng lao: khóa tại lúc bắt đầu"). Do not edit files outside `src/enemies/charger/`.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-14
# manual: npm run dev → http://localhost:5173/?sandbox&enemies=charger   (dodge sideways, lure it into the wall)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
