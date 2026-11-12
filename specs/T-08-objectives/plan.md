# Implementation Plan: T-08 objectives

**Constitution check**: pure logic separated and unit-tested; no gameplay literals (uses `OBJECTIVES`); resources via `ctx.resources.scope('objectives')`; modules talk only via events; only owned files edited. No violations.

## Structure (all under `src/objectives/`)
- `NuclearCountdown.ts` (+test), `TowerActivation.ts` (+test): pure.
- `towerModel.ts`: procedural three.js tower and visual states.
- `TowerManager.ts`: builds towers and colliders, per-tick interaction, emits tower events.
- `index.ts`: module wiring (countdown, died/respawn, query params, test hooks).
- `tests/e2e/T-08-objectives.e2e.mjs`.

## Decisions
- Logic in `fixedUpdate(dt)`; visual pulse in `update(dt)`.
- No new events (catalogue already has all). Foundation requests: none.
