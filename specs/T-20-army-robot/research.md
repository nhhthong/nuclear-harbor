# Research: Vanguard Army Mech

## Decision 1: Merged geometry, six materials, whole-body animation
- **Decision**: build every reference part as a geometry with its local transform baked in and merge by material with `mergeGeometries`.
  Six near-LOD meshes: `armor` (orange, shared canvas texture), `gunmetal`, `dark` (frame + hoses + sensor glass, dark glossy tint),
  `chrome`, `decal` (shield + triangle drawn into ONE shared canvas atlas, transparent), `glow` (missile-cell bores, emissive).
- **Animation**: the body is one rigid assembly. Walk/idle is expressed by whole-body bob, roll and a short torso sway applied to the root,
  a slow scan yaw, and the missile-cell glow level (swap among a few shared emissive materials, no per-instance material).
  Turbine/gatling spin is dropped (would need extra draw calls); documented as an accepted deviation (invisible at game range).
- **Rationale**: budget is a hard rule (<= 6 near). Splitting arms/legs per material would exceed it.
- **Alternatives**: separate meshes per part (~250 calls per mech), `InstancedMesh` across mechs (loses per-instance animation).

## Decision 2: LOD
- **Decision**: `THREE.LOD`: level 0 near (6 calls), level 1 beyond ~45 m a single merged low-poly silhouette (boxes/cylinders, vertex colours, 1 call).

## Decision 3: Smooth motion on top of BaseEnemy
- **Decision**: pure integrator `stepMotion` (speed approaches target with accel/decel, yaw with a turn-rate limit, speed scaled down by heading error).
  ArmyRobot sets `moveSpeed` from the integrated speed every fixed step, and sets `desiredYaw` through the limited integrator while
  `lockFacing` is true, so BaseEnemy's faster yaw turn never snaps the visual. BaseEnemy's `followPath` is reused unchanged (shared file).

## Decision 4: Engagement
- States: `patrol`, `advance` (to the 18-25 m band), `engage` (strafe on a ring + salvo), `retreat` (player < 8 m, hysteresis), `destroyed`.
- Pure brain returns state + intent (distance error, strafe), ArmyRobot turns that into a goal point on the nav grid.

## Decision 5: Rockets
- **Decision**: `EnemyProjectiles.fireRocket(from, dir, speed, damage, splashRadius)`: a second bounded pool (cap in tunables); mesh = shared
  small capsule-like geometry + glow. On world/player contact or max range the rocket explodes: `splashDamage()` (pure falloff) is applied to
  the player, `vfx:spawn` explosion emitted. Pool empty drops the shot.

## Decision 6: Footsteps
- No new event. Footfall is a bounded `vfx:spawn` dust puff at each foot-down for near robots plus the existing events; a dedicated footstep
  sound would need a foundation request (recorded as limitation).
