# Research: TITAN-04

No open clarifications; decisions resolve ticket gaps.

- **Weak-point positions**: Decision: four spheres on the equator at yaw offsets 0/180/270/90 deg (front = facing -Z in body space, back, left, right). Rationale: ticket step 3. Alternative: spread over hemisphere - rejected, harder to aim/read.
- **Hits through Damageable**: Decision: one adapter per zone (armor, 4 weak points, core) forwarding to `BossModel`; absorbed -> `DamageResult.absorbed = true`. Rationale: `resolveDamage` already handles zones. Alternative: single damageable using hit zone - rejected, weak-point index needs identity.
- **Core collider**: Decision: created when core is exposed, removed on dispose/defeat. Rationale: ticket step 4.
- **Awakening invulnerability**: Decision: model rejects all damage while phase is `dormant`/`awakening`. Alternative: disable colliders - rejected, bullets would pass through.
- **Ground slam safety**: Decision: player is safe if `position.y > groundSlam safe height 3 m` or outside radius at the impact moment. Rationale: ticket step 8.
- **Cannon projectile**: Decision: fixed-step travel, per-step segment `hasLineOfSight` against world; explode on block or on reaching target ground position / ground. Alternative: Rapier raycast per step - same cost; `hasLineOfSight` is the provided API.
- **Missiles**: Decision: parabolic arc from above to each marker over the telegraph tail (`flight` 1.0 s, local), damage on land by distance to player.
- **Scheduler time**: Decision: pure `BossAttacks.update(dt, ctx)` returns actions data; all timers in sim time in `fixedUpdate`.
- **Movement**: Decision: simple steering towards a ring of 20-35 m around the player, clamped to arena radius minus margin, yaw slerped at a slow rate; legs animated by phase of travelled distance. No pathfinding (arena is keep-clear).
- **Sandbox**: scale 0.4 at (-20, 0, 24); danger radii and ranges scaled by the same factor.
- **Draw calls**: ~1 body + 4 legs x 2 + 4 plates + 4 weak points + hatch + core + 2 decals pools; kept <= 25 with shared materials; projectile/marker pools are extra but capped and hidden when unused (counted only when visible).
