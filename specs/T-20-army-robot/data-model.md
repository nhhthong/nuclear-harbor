# Data Model

## ArmyState
`patrol -> advance -> engage -> retreat -> (advance|engage|patrol)`; `destroyed` terminal (set by the damage path).
- patrol -> advance: sees player within detection range, or recently aware (loseTargetTime), or defend-phase command.
- advance -> engage: sees player and distance within band `[bandMin, bandMax]`.
- engage -> advance: distance > bandMax * hysteresis or no LOS.
- any combat -> retreat: distance < retreatDistance; retreat -> engage/advance when distance > retreatDistance * hysteresis.
- any -> patrol: not aware for loseTargetTime.

## MotionState (per mech)
`speed` (m/s, signed 0..), `yaw`; limits `accel`, `decel`, `turnRate`. `stepMotion(state, targetSpeed, desiredYaw, dt)` mutates in place.

## SalvoState
`phase: idle | telegraph | firing | cooldown`, `timer`, `shotsLeft`. Telegraph (glow ramps) -> N shots at `shotInterval` -> cooldown.
`glowLevel(state)` in 0..1 for the missile cells.

## Rocket (pooled, in EnemyProjectiles)
`mesh`, `velocity`, `speed`, `damage`, `splashRadius`, `life`, `travelled`. Explodes on contact; `splashDamage(distance, radius, damage)` = `damage * (1 - d/r)` clamped, 0 outside.

## Tunables
`ARMY_ROBOT` (src/config/tunables.ts): hp, detectionRange, patrolSpeed, advanceSpeed, retreatSpeed, accel, decel, turnRate, bandMin, bandMax, retreatDistance,
rocketSpeed, rocketDamage, splashRadius, salvoMin/Max, shotInterval, telegraphTime, cooldown, loseTargetTime.
`ARMY_LOCAL` (army/tunables.ts): model scale, LOD distance, hit volume sizes, footstep interval, glow levels, bob amounts.
