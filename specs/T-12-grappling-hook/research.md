# Research: Grappling hook

No open clarifications. Decisions:

- **Targeting**: one `raycast(eye, look, GRAPPLE.maxRange, { groups: QueryGroups.grapple })`; the query covers all static world so walls occlude. Valid iff `hit.meta.grappleable`. Rationale: GDD 4.1 and PLAN A6. Alternative (raycast only grappleable group) rejected: lets rays pass through walls.
- **Aim assist**: only when the centre ray fails or hits unmarked geometry. Test `ctx.grappleAnchors.inRange(eye, maxRange)` inside a 3 degree cone; pick smallest angle; accept if `physics.raycast` to the anchor reaches it (line of sight, small tolerance). Pure cone math in `aim.ts`.
- **Hook flight**: visual only; pull begins after `min(distance / hookTravelSpeed, 0.4 s)`. The state machine owns this delay so the logic is testable.
- **Pull**: `externalVelocity = normalize(aim - eye) * pullSpeed`, set in `fixedUpdate`. Aim point is the hit point raised by a clearance (0.5 m) for ordinary surfaces; the anchor `position` (perch) as is. Controller collides, so walls stop the player and stuck detection releases.
- **Momentum on release**: the controller keeps the last real velocity as its simulation velocity after external control ends, so the module applies `addImpulse(-(1 - releaseMomentum) * v)` to retain `releaseMomentum` of the pull velocity (GRAPPLE.releaseMomentum, REVIEW #2).
- **Perch landing**: on arrival at a perch anchor with `landing`, if the landing point is within 3 m of the feet and a line check from the eye to above the landing is clear, `player.teleport(landing)` (zero velocity); otherwise release normally.
- **Failure cooldown**: 0.3 s (local tunable); `cooldown` failures do not restart cooldown.
- **Input edge**: `ctx.input.wasPressed('grapple')` is read in `update`, latched into a flag and consumed by the next `fixedUpdate`, where the logic runs (the pull velocity is a fixed-step quantity).
- **Reticle indicator**: a small DOM element in `ctx.uiRoot` tinted when the centre ray (or assist) finds a valid target; evaluated at most once per frame with scratch objects.
