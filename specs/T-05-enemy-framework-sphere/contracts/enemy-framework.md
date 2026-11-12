# Contract: EnemyFactory / EnemyDeps (for T-13, T-14)

```ts
type EnemyFactory = (deps: EnemyDeps, spawn: EnemySpawn) => BaseEnemy;
interface EnemySpawn { type: EnemyType; position: Vector3; patrol: Vector3[]; id?: string }
interface EnemyDeps { ctx: GameContext; nav: NavGrid; projectiles: EnemyProjectiles; scheduler: AIUpdateScheduler }
```

Replace only your folder's `index.ts` (`createSpiderRobot` / `createChargerRobot`).

`BaseEnemy` (abstract class, constructed with `deps`, `spawn`, a `BaseEnemyConfig`): subclasses implement
`think(dt, perception)` (scheduled rate; `perception` is a reused object) and optionally `step(dt)` (every fixed tick).
Helpers: `commandMoveTo`, `moveAlongPath(dt, speed)`, `requestPath`, `setState`, `forceHighRate`
(true in uninterruptible states), `addHitVolume`, `onDestroyed()` hook. Disposal, registry removal and events
(`enemy:damaged`, `enemy:destroyed`) are handled by the base class; the manager emits `enemy:spawned`.
Shared geometry/material: cache per type at module level, never per instance.
