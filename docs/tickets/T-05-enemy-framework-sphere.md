# T-05 — Enemy framework and sphere robot

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 6 (intro), 6.1, 6.4, 13.2, 13.4, 13.7, 16 Enemies; REVIEW #6 |
| Spec dir | `specs/T-05-enemy-framework-sphere/` |

## Goal

Build the robot framework every enemy type plugs into (manager, base class, distance-based AI scheduler, navigation grid, pooled enemy projectiles, spawn data) and the first robot on top of it: the sphere robot (patrol → detect → chase → attack → optional retreat → destroyed).

## Files owned (exclusive)

- `src/enemies/**` (replace `src/enemies/index.ts`; keep `createEnemiesModule` and id `enemies`)
- You CREATE the two plug-in stubs `src/enemies/spider/index.ts` and `src/enemies/charger/index.ts`; after this ticket they belong to T-13 and T-14. You also create `src/enemies/population.ts`, which T-16 takes over later.
- `tests/e2e/T-05-enemy-framework-sphere.e2e.mjs` (browser check, optional but recommended)
- `specs/T-05-enemy-framework-sphere/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ctx.enemies` (`EnemyRegistry`): you are the only writer
- `ctx.player` (`position`, `getEyePosition`, `alive`, `applyDamage`), `ctx.physics` (`raycast`, `hasLineOfSight`, `addCollider`, `QueryGroups.enemyShot / worldOnly / enemyMove`, `Groups.enemy`)
- `Enemy`, `Damageable`, `DamageInfo`, `SimLevel` types; `resolveDamage` from `@/combat/damage`; `ObjectPool`
- `SPHERE_ROBOT`, `AI_SCHEDULING`, `ENEMY_COUNTS` tunables; `ZONES`, `LAND`, `isOnLand` from `@/config/level`
- Events in: `world:ready` (bake nav grid, spawn), `objectives:defendStarted` (pull robots), `game:respawn` (drop aggro), `boss:spawned` (optional: nothing)

## Interfaces provided

- Events out: `enemy:spawned`, `enemy:alerted`, `enemy:attacked`, `enemy:damaged`, `enemy:destroyed`
- `src/enemies/BaseEnemy.ts`, `EnemyFactory` type and `EnemyDeps` (ctx, nav, projectiles, scheduler) — the contract T-13 and T-14 implement
- `src/enemies/nav/NavGrid.ts` (walkability + A* path + `isWalkable`, `raycastGrid`) baked from static colliders
- `src/enemies/population.ts`: `getPopulation(ctx): EnemySpawn[]`
- `ctx.testHooks.enemies = { list(), spawn(type, position), killAll() }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-05-enemy-framework-sphere
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-05-enemy-framework-sphere/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-05-enemy-framework-sphere/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure pieces first, each with tests: `AIUpdateScheduler` (distance → sim level `active/simplified/dormant` and think interval from `AI_SCHEDULING`; returns which enemies think this tick; a `forceHighRate` flag for uninterruptible states), a tiny generic `StateMachine`, `NavGrid` (boolean grid over `LAND` at `AI_SCHEDULING.navCellSize`, A* with 8-neighbour moves and no corner cutting, path smoothing by grid line-of-sight), and the sphere robot's decision function (state + perception → next state).
2. `NavGrid.bake(ctx)` on `world:ready`: mark a cell blocked when a short downward/overlap query finds a static collider between 0.2 m and 2.0 m above ground, or when there is no ground (sea). In sandbox, bake the 80 x 80 m slab. Baking must finish in < 200 ms (measure and log).
3. `BaseEnemy implements Enemy`: id, type, position, hp/maxHp, `state`, `simLevel`, `applyDamage` via `resolveDamage` with a per-type zone profile (emit `enemy:damaged` / `enemy:destroyed`, remove colliders, unregister), `commandMoveTo`, hooks `think(dt, perception)` (scheduled rate) and `step(dt)` (every fixed tick: movement integration, cheap), `setSimLevel`, `dispose`. Hit volumes are colliders in `Groups.enemy` on a kinematic body with meta `{ kind: 'enemy', damageable: this, hitZone }`.
4. Movement: follow the nav path with simple steering at the type's speed; kinematic translation (no KCC needed on flat ground); separation from other enemies by a small repulsion. Dormant enemies skip `step` except for a coarse patrol advance so state stays valid (GDD 6.4).
5. Perception shared helper: distance to player, line of sight (`hasLineOfSight` eye-to-eye, world only), last seen position and time.
6. Pooled projectiles (`EnemyProjectiles`, cap ~48): simple glowing bolts advanced per fixed tick by a ray segment against `QueryGroups.enemyShot`; on hitting the player collider call `ctx.player.applyDamage`; on world hit emit `vfx:spawn { kind: 'spark' }`. When the pool is empty the shot is skipped.
7. Sphere robot (GDD 6.1): metallic sphere with red sensor (primitive mesh, shared geometry/material across instances), hovers at `hoverHeight`, rolls/bobs procedurally. States: patrol (loop waypoints) → detect within 25 m with LOS (emit `enemy:alerted`) → chase to `preferredRangeFactor * attackRange` → attack (fire every `fireInterval` while within 20 m with LOS, damage 8, emit `enemy:attacked`) → retreat when HP < 25% (back off to cover for a few seconds) → destroyed. Loses the target after `loseTargetTime` without LOS and returns to patrol. Sensor is a small `critical` collider; body is `body`.
8. Plug-in contract: `export type EnemyFactory = (deps: EnemyDeps, spawn: EnemySpawn) => BaseEnemy`. Create `src/enemies/spider/index.ts` and `src/enemies/charger/index.ts`, each exporting `createSpiderRobot` / `createChargerRobot: EnemyFactory` that for now return a recoloured sphere robot with the right `type` and HP, and register all three in `src/enemies/factories.ts`. T-13/T-14 replace only their folder.
9. `population.ts`: sandbox → types from `ctx.flags.params.get('enemies')` (comma list, default `sphere`, `none` allowed) spawned around (0, 0, -24) with a small patrol loop; harbor → generate `ENEMY_DISTRIBUTION` counts per zone on random walkable nav cells (seeded) with a 3-4 point patrol loop each, away from the player spawn (> 40 m). T-16 refines placement later.
10. `objectives:defendStarted` → `commandMoveTo(position)` for alive enemies within the event radius (REVIEW #6: no extra spawns). `game:respawn` → all enemies drop their target.
11. Emit `vfx:spawn { kind: 'explosion' }` on destruction; hide and release meshes; the registry keeps only live enemies.
12. e2e: `?sandbox&autostart&enemies=sphere`: robot spawns, detects the player when teleported within 20 m with LOS, fires and reduces player HP; killing it through `applyDamage` emits `enemy:destroyed` and empties the registry.

## Acceptance criteria

- [ ] **AC1** `EnemyManager` spawns the population after `world:ready`, registers each robot in `ctx.enemies` and removes it on destruction; in the harbor it creates exactly 14 / 10 / 6 robots of the three types (spider and charger may still be placeholders).
- [ ] **AC2** The sphere robot has 100 HP, moves at 3.5 m/s, detects at 25 m with line of sight, attacks within 20 m for 8 damage per hit, and goes through patrol, chase, attack, (retreat), destroyed as observable `state` values.
- [ ] **AC3** Robots do not walk through containers or walls and never leave the land; A* paths avoid blocked cells (unit test).
- [ ] **AC4** AI think rate depends on distance: 20-30 Hz near, 5-10 Hz mid, 1-2 Hz far, dormant beyond `dormantDistance`; an enemy keeps valid state (patrol progress, HP) across level changes (unit test on the scheduler + a state-preservation test).
- [ ] **AC5** Enemy projectiles are pooled with a hard cap, are blocked by world geometry and damage the player on hit.
- [ ] **AC6** Shooting a robot applies zone multipliers (sensor = critical 2x) and emits `enemy:damaged`; at 0 HP it emits `enemy:destroyed` with the remaining count and frees its colliders and meshes.
- [ ] **AC7** `objectives:defendStarted` makes alive robots within the radius converge on the tower position.
- [ ] **AC8** `createSpiderRobot` and `createChargerRobot` stubs exist at the agreed paths with the `EnemyFactory` signature, and `?enemies=spider,charger` spawns them in the sandbox.
- [ ] **AC9** All robot meshes of one type share geometry and materials; no per-frame allocations in `step`/`think` (verified by code review notes in the plan).

## Notes

Robots are primitives (GDD 6.4). Keep `BaseEnemy` small: T-13 and T-14 depend on it, and the boss (T-15) does NOT use it. Document the `EnemyFactory` / `EnemyDeps` contract in `specs/T-05-enemy-framework-sphere/contracts/` so wave 2 can read it.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-05
# manual: npm run dev → http://localhost:5173/?sandbox&enemies=sphere  (with T-02 merged you can shoot it)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
