# Feature Specification: Enemy framework and sphere robot (T-05)

**Input**: `docs/tickets/T-05-enemy-framework-sphere.md`; GDD 6, 6.1, 6.4, 13.2, 13.4, 13.7, 16 Enemies; REVIEW #6.

## User Scenarios

### US1 - A sphere robot fights the player (P1)
A hovering sphere robot patrols waypoints, detects the player within 25 m with line of sight, chases to
about 14 m, fires 8-damage bolts every 1.2 s within 20 m, retreats below 25% HP, and is destroyed at 0 HP.
Independent test: sandbox `?enemies=sphere`; teleport the player within 20 m; player HP drops.

### US2 - Robots are shot and die (P1)
Hit volumes live in `Groups.enemy`; sensor = `critical` (2x), body = x1. `enemy:damaged` on each hit;
`enemy:destroyed` (with remaining count) at 0 HP; colliders and meshes are released; the registry holds live robots only.

### US3 - Population (P1)
After `world:ready` the manager spawns the population: harbor = 14/10/6 by zone distribution; sandbox = types from
`?enemies=` (default `sphere`, `none` allowed). Spider and charger are placeholders (recoloured sphere with the right type and HP).

### US4 - Scheduled AI and navigation (P2)
Think rate follows distance (near 30 Hz, mid 10 Hz, far 2 Hz, dormant beyond 140 m). Robots path over a baked nav grid (A*),
never cross containers/walls or leave the land; state (patrol progress, HP) is preserved across sim levels.

### US5 - Defend phase (P2)
`objectives:defendStarted` makes alive robots within the radius converge on the tower; `game:respawn` drops aggro.

## Requirements
- FR-001..004: manager, `BaseEnemy`, `EnemyFactory`/`EnemyDeps` contract, factories for sphere/spider/charger.
- FR-005: pure `AIUpdateScheduler`, `StateMachine`, `NavGrid` (A*, 8-neighbour, no corner cutting, LOS smoothing), `decideSphere`.
- FR-006: `EnemyProjectiles` pool (cap 48), ray-segment collision against `QueryGroups.enemyShot`.
- FR-007: events `enemy:spawned/alerted/attacked/damaged/destroyed`; `vfx:spawn` spark/explosion.
- FR-008: `ctx.testHooks.enemies = { list(), spawn(type, position), killAll() }`.
- FR-009: shared geometry/material per type; no steady-state allocation in `step`/`think`.

## Acceptance Criteria
AC1-AC9 exactly as in the ticket (mapping to tests in plan.md).

## Assumptions
- Spider/charger HP come from `SPIDER_ROBOT` / `CHARGER_ROBOT`; their real behaviour is T-13/T-14.
- Harbor placement is seeded random over walkable nav cells, more than 40 m from the player spawn; T-16 refines.
- Sandbox nav slab is 80 x 80 m; sandbox robots spawn around (0, 0, -24).
- Retreat: back away from the player for a fixed few seconds (local tunable), then resume chase.
- No foundation changes needed.
