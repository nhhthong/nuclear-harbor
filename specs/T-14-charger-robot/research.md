# Research: Charger robot

## Decisions

- **Hit zone**: `zoneForHit(facing, attackDir, stunned)` uses `isFrontalHit` with `frontArcHalfAngleDeg`; front -> `armor` (x0.1 profile), else `critical` (x2). Stun does not change the rule (robot does not turn, rear stays exposed). Zone profile passed to `resolveDamage` is `{armor: 0.1, critical: 2, body: 1}` built from tunables. A hit without `direction` keeps the zone it arrived with (`body`).
- **Edge detection**: forward ray (`worldOnly`) for obstacles; for ground, sample a downward ray at points along the line every `edgeSampleStep` up to maxChargeDistance in the planner call, so the plan knows the first missing-ground distance up front (strip length). During the charge the downward probe at `edgeProbeDistance` ahead is re-checked each tick as a second safety net, plus `isOnLand`.
- **Wall contact**: forward ray of length `edgeProbeDistance`-independent body half-length + step; stop when obstacle distance <= body half-length.
- **Player contact**: XZ capsule (radius 0.45) vs oriented body box circle approximation each fixed tick during charge, once per charge.
- **Movement**: kinematic translation each fixed tick through `BaseEnemy.step` override (the base path follower is skipped while charging).
- **High rate**: `forceHighRate` true in windup/charge.
- **Telegraph**: single flat `PlaneGeometry` mesh per robot with shared geometry/material, scaled in Z to planned distance.

## Alternatives rejected

- Rapier character controller for the charge: heavier and not needed for a straight line.
- Collision events: ticket mandates cheap distance tests.
