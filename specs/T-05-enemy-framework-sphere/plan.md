# Implementation Plan: T-05 enemy framework + sphere robot

**Spec**: spec.md | **Stack**: TS strict, three.js, Rapier (existing deps only).

## Constitution check
Pooled projectiles (I); shared geometry/materials, ResourceTracker scope `enemies`, scratch vectors (I);
tunables from config + `src/enemies/tunables.ts` (III); pure logic unit-tested (IV); only owned files edited (V);
no assets or deps (VI); no cross-module imports (II). No exceptions.

## Structure (all under `src/enemies/`)
```
tunables.ts           local numbers (retreat time, bolt size, separation, sandbox patrol)
StateMachine.ts       generic FSM                         (+test)
AIUpdateScheduler.ts  distance -> sim level, think rate    (+test)
nav/NavGrid.ts        grid, A*, smoothing, raycastGrid, bake (+test)
sphereBrain.ts        pure decideSphere(state, perception) (+test)
perception.ts         Perception struct + update helper
BaseEnemy.ts          base class, EnemyDeps, EnemyFactory, EnemySpawn (+test)
EnemyProjectiles.ts   pooled bolts
SphereRobot.ts        sphere robot (shared geo/mat per type)
spider/index.ts, charger/index.ts, factories.ts, population.ts (+test), EnemyManager.ts, index.ts
```

## Design notes
- Body: kinematic rigid body, two sphere colliders (body, small `critical` sensor), meta `{kind:'enemy', damageable, hitZone}`.
- Movement: path over nav grid, steering at type speed, separation repulsion, clamp to land; no KCC.
- Scheduler: per-enemy accumulators; output array is reused; `forceHighRate` uses the near rate. Dormant robots only get a coarse patrol advance.
- Nav bake: per cell, downward ray probes from above (worldOnly); blocked if a hit lies 0.2-2.0 m above the ground, or no ground. Time logged.
- Projectiles: pooled meshes (shared geometry/material); per tick raycast segment vs `enemyShot`; hit with meta kind `player` -> `ctx.player.applyDamage`.
- AC9 notes: module-level scratch vectors in `step`/`think`; geometry/material cached per type at module level.

## AC -> verification
AC1 population.test + e2e; AC2 sphereBrain.test; AC3 NavGrid.test; AC4 AIUpdateScheduler.test + BaseEnemy state test;
AC5 projectile pool cap test + e2e; AC6 BaseEnemy.test (headless Rapier); AC7 EnemyManager test; AC8 factories test; AC9 review notes above.
