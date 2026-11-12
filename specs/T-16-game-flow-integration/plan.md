# Implementation Plan: Game flow, level population and vertical slice

**Branch**: `T-16-game-flow-integration` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-16-game-flow-integration/spec.md`

## Summary

Replace the flow placeholder with a pure, unit-tested `FlowState` (checkpoint, outcome decisions, run stats, best-result storage rules) plus a thin module that wires events (`player:died`, `countdown:expired`, `boss:defeated`, `game:checkpoint`, `game:requestRespawn`, `game:requestRestart`) to `ctx.state`, `ctx.player.revive` and LocalStorage. Replace random harbor placement with authored robot data (lane-aware, walkable-validated) and final pickup positions. Add three e2e files (sandbox slice, harbor full run with failure paths, optional browser check) and `docs/PLAYTEST.md`.

## Technical Context

**Language/Version**: TypeScript 6 strict, Vite 8, Three.js 0.187, Rapier compat 0.21

**Primary Dependencies**: none new

**Storage**: LocalStorage `nuclear-harbor.best.v1` (wrapped in try/catch)

**Testing**: Vitest (pure logic, placement data validated against the world layout generator), Playwright e2e via `npm run e2e`

**Target Platform**: modern desktop browsers, offline

**Project Type**: web game (single project)

**Performance Goals**: no per-frame allocation in flow; population is built once at `world:ready`

**Constraints**: only files listed in the ticket may change; foundation and other modules read-only

**Scale/Scope**: 30 robots, 22 + 13 pickups, 1 flow module

## Constitution Check

*GATE: passed before research and re-checked after design.*

| Principle | Status | Note |
|---|---|---|
| I Performance | Pass | No per-frame work in flow beyond a stats counter; no GPU resources created; population one-shot. |
| II Typed contracts | Pass | Only catalogued events are used; no module imports another (flow touches only `@/core`, `@/config`; hooks are read by tests only). Population reads `ctx.testHooks.world.lanes` as data, no import. |
| III Tunables in config | Pass | Flow numbers (victory delay, storage key) in `src/flow/tunables.ts`; spawn data authored in `population.ts`; no GDD number changed. |
| IV Pure logic + browser verify | Pass | `FlowState` pure with unit tests incl. "ignore after run ended"; e2e for the three loops. |
| V Ownership | Pass | Files: `src/flow/**`, `src/enemies/population.ts(+test)`, `src/pickups/placements.ts(+test)`, `tests/e2e/T-16-*`, `docs/PLAYTEST.md`, `specs/T-16-*`. Defects elsewhere go to foundation-requests / PLAYTEST. |
| VI Offline, procedural | Pass | No assets, no requests. |
| VII Simplicity | Pass | Restart = page reload (ticket decision); no extra systems. |

## Project Structure

### Documentation (this feature)

```text
specs/T-16-game-flow-integration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── foundation-requests.md   # integration issues for owners
└── tasks.md
```

### Source Code (repository root)

```text
src/flow/
├── FlowState.ts          # pure decisions + stats + best-result logic
├── FlowState.test.ts
├── tunables.ts           # victory delay, storage key
└── index.ts              # createFlowModule (id 'flow')
src/enemies/population.ts       # authored harbor population (+ population.test.ts)
src/pickups/placements.ts       # final pickup data (+ placements.test.ts)
tests/e2e/T-16-vertical-slice.e2e.mjs
tests/e2e/T-16-full-run.e2e.mjs
tests/e2e/T-16-game-flow-integration.e2e.mjs
docs/PLAYTEST.md
```

**Structure Decision**: single project; flow follows the standard module pattern (pure class + thin module).

## Complexity Tracking

No constitution violations.
