# T-13 — Spider robot

| | |
|---|---|
| Wave | 2 |
| Depends on | T-05 |
| GDD sections | 6.2, 6.4, 13.7, 16 Enemies |
| Spec dir | `specs/T-13-spider-robot/` |

## Goal

Replace the spider placeholder with the real spider robot: a six-legged walker with procedural leg animation that patrols, flanks the player, chases, attacks at close range and can hop low obstacles.

## Files owned (exclusive)

- `src/enemies/spider/**` only (replace the stub `src/enemies/spider/index.ts` created by T-05; keep the `createSpiderRobot: EnemyFactory` export)
- `tests/e2e/T-13-spider-robot.e2e.mjs` (browser check, optional but recommended)
- `specs/T-13-spider-robot/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- The enemy framework from T-05 (read `specs/T-05-enemy-framework-sphere/` and `src/enemies/BaseEnemy.ts` first): `BaseEnemy`, `EnemyDeps` (nav grid, projectiles, perception helper, scheduler), `EnemySpawn`, `StateMachine`
- `SPIDER_ROBOT`, `AI_SCHEDULING` tunables; `resolveDamage` zone profile
- `ctx.player` (target), `ctx.physics` (`hasLineOfSight`, short obstacle rays), `ObjectPool` via the framework
- Events (through the base class): `enemy:alerted`, `enemy:attacked`, `enemy:damaged`, `enemy:destroyed`

## Interfaces provided

- `createSpiderRobot` factory returning a `BaseEnemy` subclass with `type: 'spider'`
- States visible in `enemy.state`: `patrol`, `flank`, `chase`, `attack`, `hop`, `destroyed`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-13-spider-robot
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-13-spider-robot/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-13-spider-robot/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure decision logic first with tests (`spiderBrain.ts`): given perception (distance, LOS, time since seen, own HP) and current state, return the next state; and `computeFlankPoint(playerPos, playerForward, selfPos, side, SPIDER_ROBOT)` returning a point `flankDistance` from the player at `flankAngleDeg` off the player's facing, snapped to a walkable nav cell.
2. Behaviour (GDD 6.2): patrol waypoints at reduced speed → on detection (30 m, LOS) emit alert and pick a flank side (alternate per spider so groups split) → `flank`: path to the flank point via the nav grid at 5 m/s → `chase` when the flank point is reached or the player moves far → `attack` when within 12 m with LOS: strafe slowly and fire a burst every `fireInterval` for 12 damage per hit through the shared projectile pool → back to chase/patrol when LOS is lost for `loseTargetTime`.
3. Hop (GDD 6.2 "can jump over low obstacles at supported positions"): when the direct segment to the next waypoint is blocked only by an obstacle lower than `hopMaxObstacleHeight` (ray at 0.3 m hits, ray at `hopMaxObstacleHeight + 0.2` m is clear, landing cell walkable), perform a short parabolic hop over ~0.5 s. Keep it optional per waypoint and never hop off the land.
4. Model: flat central body (box + sensor dome) with `SPIDER_ROBOT.legCount` legs, each two segments. Procedural gait: legs in two alternating tripods; each foot target steps forward when it lags behind its home position by a stride threshold; simple two-bone IK or a cheaper analytic lift/swing is fine. Legs are visual only (no colliders).
5. Animation cost control: full gait only at sim level `active`; `simplified` → legs static/bobbing; `dormant` → hidden work skipped. All spiders share geometries and materials (GDD 13.2: no shared animated skeleton, per-instance transforms).
6. Hit volumes: body `body`, sensor dome `critical`; 150 HP via the base class.
7. e2e: `?sandbox&autostart&enemies=spider`: spawns with type `spider` and 150 HP, reaches `flank` then `attack` when the player is within range with LOS, damages the player, and is destroyed by `applyDamage`.

## Acceptance criteria

- [ ] **AC1** The spider robot has 150 HP, moves at 5 m/s, detects at 30 m with line of sight and attacks within 12 m for 12 damage per hit.
- [ ] **AC2** On detection it moves to a flank position to the side of the player before closing in, observable as the `flank` state, and two spiders choose opposite sides.
- [ ] **AC3** It follows nav paths around containers and hops over obstacles up to 1 m high where a landing cell exists; it never leaves the land.
- [ ] **AC4** It has six procedurally animated legs whose feet step in an alternating gait while moving and rest when idle.
- [ ] **AC5** Leg animation is skipped or simplified at `simplified`/`dormant` sim levels while HP and state are preserved.
- [ ] **AC6** The sensor dome takes critical damage (2x); destruction emits `enemy:destroyed` and frees resources.
- [ ] **AC7** Decision and flank-point logic are pure and unit tested.
- [ ] **AC8** All spiders share geometry and materials; no per-frame allocations in the gait update.

## Notes

Do not edit files outside `src/enemies/spider/`. If the framework lacks something, record it in `foundation-requests.md` (addressed to T-05's owner/Tech Lead) and work around it in your folder.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-13
# manual: npm run dev → http://localhost:5173/?sandbox&enemies=spider,spider
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
