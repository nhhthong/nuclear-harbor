# Contract: grapple events and test hook

Events are declared in `src/core/events.ts` (foundation) and only emitted by T-12:

- `grapple:fired { origin, direction }` on every valid fire
- `grapple:attached { point, distance, anchorId? }` when a target is accepted
- `grapple:released { reason: arrived | manual | stuck | timeout | death }`
- `grapple:failed { reason: no-target | not-grappleable | out-of-range | cooldown }`
- `grapple:cooldown { remaining, total }` at most 10 Hz while cooling, final event has `remaining 0`

Test hook: `ctx.testHooks.grapple = { getState(): { phase, cooldown, target } }` where `phase` is `ready | pulling | cooldown` and `target` is `{ x, y, z, anchorId? } | null`.

Consumes: `player:died`, `game:respawn`, `game:stateChanged`.
