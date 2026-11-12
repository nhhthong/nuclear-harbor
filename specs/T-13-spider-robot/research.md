# Research: Spider Robot

- **Decision**: Subclass `BaseEnemy`, reuse its path following. **Rationale**: ownership and consistency with the sphere; separation, sim levels, cleanup are free. **Alternatives**: own movement loop (duplicates code).
- **Decision**: Hop is a `hop` FSM state driven by `step` override: base `followPath` is bypassed while hopping (moveSpeed 0) and position follows a parabola. **Rationale**: base class has no hop hook; `position` is public. **Alternative**: foundation change (not allowed).
- **Decision**: Hop trigger probes the segment from the current position to the next path point in `think` with `ctx.physics.raycast` at 0.3 m (must hit) and hopMax+0.2 m (must be clear) and checks landing cell with `nav.isWalkable`. Because the nav grid already blocks obstacle cells, hop is only started when the straight line to the goal is not nav-walkable but is probe-hoppable. **Rationale**: matches ticket step 3.
- **Decision**: Analytic legs: each leg has a hip offset on the body, a foot world target (preallocated Float32Array), a home point ahead of the body in yaw; a foot steps when its distance to home exceeds the stride threshold and its tripod is allowed (the other tripod is not stepping). Knee computed analytically (midpoint raised). Segments are two scaled cylinders per leg, positioned each frame with preallocated vectors.
- **Decision**: Flank side alternates via module counter (`nextSide`), stored per spider at spawn so groups split.
- **Decision**: Patrol speed 0.6 of full speed (proposed, in local tunables).
- **Decision**: Burst = single bolt per `fireInterval` (matches shared pool and framework); strafing during attack via a goal perpendicular to the player direction.
