# Implementation Plan: Charger robot (shielded rhino)

**Branch**: `T-14-charger-robot` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-14-charger-robot/spec.md`

## Summary

Replace the charger placeholder in `src/enemies/charger/` with a `BaseEnemy` subclass driven by a pure
decision layer. Pure modules: `chargePlan.ts` (planner, start conditions, hit zone) and `chargerBrain.ts`
(state transitions). A `Charger` class applies the decisions: kinematic charge motion with forward and
downward ray probes, telegraph strip, player contact test, damage-zone override, high-rate scheduling.

## Technical Context

**Language/Version**: TypeScript strict, three.js, Vite

**Primary Dependencies**: Rapier (via `ctx.physics`), enemy framework `BaseEnemy`/`StateMachine` from T-05

**Storage**: N/A

**Testing**: Vitest (pure logic + headless world), Playwright-style e2e via `scripts/e2e.mjs`

**Target Platform**: Desktop browser, 60 FPS

**Project Type**: Browser game module (single project)

**Performance Goals**: no steady-state allocation in `think`/`step`; shared geometry/materials; 1 pooled strip mesh per charger

**Constraints**: edit only `src/enemies/charger/**`, e2e file and spec dir; consume foundation read-only

**Scale/Scope**: 6 chargers in the level

## Constitution Check

*GATE: passes before research and after design.*

| Principle | Status | How |
|---|---|---|
| I Performance | PASS | Module-level scratch vectors; shared geometry/materials via `SharedAssets`; one strip mesh per robot, reused (no per-charge allocation); body/strip disposed via base `release` and shared tracker; AI at high rate only while winding up/charging; box collider only. |
| II Typed contracts | PASS | Only `GameContext`, events already in the catalogue (`charger:*`, `vfx:spawn`), `PlayerState`; no import from other feature folders (only enemies framework siblings in the same module, which T-05 owns and the ticket mandates consuming). No `any`. |
| III Tunables | PASS | Shared numbers from `CHARGER_ROBOT`; local numbers (turn rates, light ramp, strip size, safety margin, contact radii) in `src/enemies/charger/tunables.ts`. |
| IV Test pure logic | PASS | Planner, start conditions, zone and brain are pure with Vitest tests written first; e2e under `tests/e2e/T-14-charger-robot.e2e.mjs`. |
| V Ownership | PASS | Only owned paths touched; foundation requests (if any) go to `foundation-requests.md`. |

## Project Structure

### Documentation (this feature)

```text
specs/T-14-charger-robot/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/enemies/charger/
├── index.ts            # createChargerRobot factory (same export)
├── tunables.ts         # feature-local numbers
├── chargePlan.ts       # planCharge, canStartCharge, zoneForHit (pure)
├── chargePlan.test.ts
├── chargerBrain.ts     # decideCharger transitions (pure)
├── chargerBrain.test.ts
├── Charger.ts          # BaseEnemy subclass, motion, telegraph, damage
└── Charger.test.ts     # headless world test (wall stun, edge stop, contact)
tests/e2e/T-14-charger-robot.e2e.mjs
```

**Structure Decision**: single module folder owned by T-14; pure logic split from the scene-bound class.

## Complexity Tracking

No violations.
