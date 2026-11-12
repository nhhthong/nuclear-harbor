# Research: T-16

## R1 Who sets game state on death
- Decision: flow sets `gameOver` on `player:died`; UI reacts to `game:over`/`game:stateChanged`. UI's request helper emits the request then forces `playing` if still not playing, so flow must handle respawn synchronously.
- Rationale: ticket step 1-2; UI code (src/ui/screens.ts) already works this way.
- Alternatives: UI-driven state (rejected, not its contract).

## R2 Checkpoint payload lifetime
- Decision: clone position on `game:checkpoint` (payload vectors are only valid during the callback; boss emits the live player vector).
- Rationale: PLAN 5 conventions.

## R3 Restart
- Decision: `window.location.reload()` keeping the query string (ticket step 3). Injected as a function so unit/e2e can observe it.
- Alternatives: in-place restart (T-17).

## R4 Lane data for Charger placement
- Decision: read `ctx.testHooks.world.lanes` at population time (world init precedes `world:ready`), fall back to a static copy of the generator output; a unit test compares the fallback with the real generator so drift is caught.
- Alternatives: import the world module (forbidden by constitution II).

## R5 Walkable validation
- Decision: spawn/patrol points are on lane centre lines or open ground; at runtime nudge to nearest walkable cell with a console warning; unit tests validate against a nav grid rasterised from the world layout boxes.

## R6 Victory delay
- Decision: 3 s timer driven by fixed-step dt in the flow module (paused state freezes it); death or expiry during the window is ignored (the boss is already defeated; a respawn could never produce another defeat).

## R7 Best result
- Decision: key `nuclear-harbor.best.v1` JSON `{completed, bestTimeRemaining}`; higher remaining time wins; storage errors swallowed.
