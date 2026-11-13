# Implementation Plan: Vanguard Army Mech (T-20)

**Branch**: `T-20-army-robot` (worktree branch) | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/T-20-army-robot/spec.md`

## Summary

Replace the `sphere` placeholder with a procedural orange biped mech ported from `docs/reference-models/robot_army.html`.
Pure, unit-tested logic (brain state decision, smooth motion integrator, salvo scheduler, rocket splash falloff) drives a `BaseEnemy` subclass
`ArmyRobot`. Geometry of every part is built once per material into merged `BufferGeometry` (static body), with only the animated parts
(two turbine rotors, gatling barrels, head, missile-cell glow mesh) separate. A `THREE.LOD` swaps to a 1-2 draw-call silhouette far away.
Rockets are a second pooled projectile kind inside `EnemyProjectiles` (visible, slow, explode with splash on contact).

## Technical Context

**Language/Version**: TypeScript 6 strict, Node 20+

**Primary Dependencies**: three 0.187 (incl. `BufferGeometryUtils`), `@dimforge/rapier3d-compat` (existing)

**Storage**: N/A

**Testing**: Vitest (pure logic + EnemyManager integration), Playwright e2e files in `tests/e2e/`

**Target Platform**: desktop browser, offline

**Project Type**: single web project (game)

**Performance Goals**: 60 fps; near mech <= 6 draw calls, far <= 2; global `maxDrawCalls` 350 with 30 robots

**Constraints**: no per-frame allocation in AI/animation, textures generated once and shared, no CDN, disposed via the enemies resource scope

**Scale/Scope**: 14 mechs in the harbor, rocket pool cap (new, tunable)

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I Performance by Design | PASS | Rockets from a bounded `ObjectPool`; static mech parts merged per material, shared geometry/materials via `SharedAssets`; LOD far model; scratch vectors in AI; textures built once; everything in the enemies resource scope. |
| II Typed contracts | PASS | Only `GameContext` events (`enemy:alerted/attacked/damaged/destroyed`, `vfx:spawn`); no import from other feature folders; no new events needed. |
| III Tunables in config | PASS | Numbers in `ARMY_ROBOT` (`src/config/tunables.ts`, replaces `SPHERE_ROBOT`) and `src/enemies/army/tunables.ts`. |
| IV Test pure logic | PASS | `armyBrain`, `motion`, `salvo`, `splash` are pure with Vitest tests written with the code; e2e `T-05` updated, new `T-20` e2e. |
| V Exclusive ownership | PASS with notes | Edits only `src/enemies/army/**`, `EnemyProjectiles.ts` (rocket kind, owned by this ticket per brief), the `sphere` line in `factories.ts`, the `SPHERE_ROBOT` block in `tunables.ts` plus the three tests that import it (`damage.test.ts`, `placements.test.ts`, `EnemyManager.test.ts`), `ENEMY_LOCAL` sphere-only keys. No foundation-requests needed. |
| VI Offline/procedural | PASS | Canvas textures and primitive geometry only. |
| VII Simplicity | PASS | One subclass, four small pure modules; no animation framework. |

No violations; Complexity Tracking not needed. The block rename `SPHERE_ROBOT` -> `ARMY_ROBOT` touches the shared tunables file but only that block (permitted by the brief).

## Project Structure

### Documentation (this feature)

```text
specs/T-20-army-robot/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── analyze.md
└── tasks.md
```

### Source Code (repository root)

```text
src/enemies/army/
├── index.ts            # createArmyRobot factory
├── ArmyRobot.ts        # BaseEnemy subclass: perception -> brain -> motion -> salvo, animation, LOD
├── armyBrain.ts        # pure: patrol | advance | engage | retreat | destroyed decision + goal helpers
├── motion.ts           # pure: speed/yaw integrator (accel, decel, turn-rate limit)
├── salvo.ts            # pure: telegraph -> N rockets -> cooldown scheduler
├── splash.ts           # pure: splash damage falloff
├── model.ts            # mech geometry builders (merged per material) + shared canvas textures
├── tunables.ts         # ARMY_LOCAL feature numbers
└── *.test.ts
src/enemies/EnemyProjectiles.ts   # + rocket kind (pool, splash, trail-free visible body)
src/enemies/factories.ts          # sphere entry -> army factory
src/config/tunables.ts            # SPHERE_ROBOT -> ARMY_ROBOT block
tests/e2e/T-05-*.e2e.mjs, T-20-army-robot.e2e.mjs
```

**Structure Decision**: new folder `src/enemies/army/` mirroring the spider/charger layout; `SphereRobot.ts`, `sphereBrain*.ts` deleted; spider/charger still use none of them (they have their own bodies).

## Phase 0/1 artifacts

See [research.md](research.md) (decisions), [data-model.md](data-model.md) (state, salvo, rocket), [quickstart.md](quickstart.md) (validation).
No `contracts/` directory: no new external interface (no new events; the enemy/projectile API is internal).
