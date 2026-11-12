# Data Model: TITAN-04

## BossModel (pure)

- `phase: BossPhase` (dormant -> awakening -> weakpoint-hunt -> core-exposed -> destroyed)
- `weakPoints: number[4]` HP (max `BOSS.weakPointHp`), `coreHp` (max `BOSS.coreHp`)
- Methods: `spawn()`, `update(dt)` (awakening timer), `hitWeakPoint(i, amount)`, `hitCore(amount)`, `hitArmor()`, `startCoreExposed()` (`?bossphase=core`)
- Each returns `{ dealt, absorbed, events: BossModelEvent[] }`; events: phaseChanged, weakPointDamaged, weakPointDestroyed, coreExposed, coreDamaged, defeated.
- Rules: absorbs all in dormant/awakening/destroyed; armour -> 0; core -> 0 until all weak points dead; dead weak point ignores; defeated emitted once.

## BossAttacks (pure)

- Inputs: phase, destroyed weak-point flags, distance/height of player, dt.
- Output: `AttackStep[]` data: `{ kind: 'telegraph' | 'impact', attack, duration?, params }`.
- State: per-attack cooldown, global interval, active timeline (telegraph timer).
- `abilityParams(destroyed[4], phase)` -> `{ cannonCooldown, missileCount, slamRadius, speedFactor }`.

## Runtime objects

- Pools: cannon shots (cap `BOSS.maxProjectiles`), missiles, ground markers; each reset hides the mesh.
- Colliders: 1 kinematic body; armour ball, 4 weak-point balls, 4 leg boxes x2 boxes, core ball (on demand).
