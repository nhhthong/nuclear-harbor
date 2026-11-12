# Implementation Plan: Spider Robot

**Branch**: `T-13-spider-robot` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/T-13-spider-robot/spec.md`

## Summary

Replace the placeholder in `src/enemies/spider/` with a `SpiderRobot extends BaseEnemy`. Decisions are made by a pure `decideSpider` and `computeFlankPoint` (unit tested); movement, nav-path following, separation, HP/zones and cleanup come from the T-05 base class. A small `legs.ts` holds a zero-allocation tripod gait; a `hop.ts` holds the pure hop eligibility and parabola maths. Meshes and materials are shared through `SharedAssets`.

## Technical Context

**Language/Version**: TypeScript strict, Three.js, Vite
**Primary Dependencies**: T-05 enemy framework (`BaseEnemy`, `NavGrid`, `EnemyProjectiles`, perception), Rapier through `ctx.physics`
**Storage**: N/A
**Testing**: Vitest for pure logic (`spiderBrain`, `hop`, `legs`); Playwright e2e `tests/e2e/T-13-spider-robot.e2e.mjs`
**Target Platform**: Browser (WebGL), 60 Hz fixed sim
**Project Type**: single web project, feature folder `src/enemies/spider/`
**Performance Goals**: no per-frame allocation in gait/animate; legs only animate at `active` sim level; 10 spiders in harbor
**Constraints**: edit only owned files; foundation read-only; tunables from `SPIDER_ROBOT`, extra numbers in `src/enemies/spider/tunables.ts`
**Scale/Scope**: 10 spiders per harbor, 6 legs each (12 segment meshes, shared geometry)

## Constitution Check

*GATE: pass before research; re-checked after design (still passes).*

| Principle | Status | Notes |
|---|---|---|
| I Performance by Design | PASS | Shared geometry/materials via `SharedAssets`; gait uses preallocated vectors and typed arrays; legs skipped at `dormant`, static at `simplified`; hop rays only in the scheduled think; no per-frame allocation |
| II Typed Contracts | PASS | Only `createSpiderRobot: EnemyFactory` exported; uses typed events through the base class; no `any` |
| III Tunables in Config | PASS | Shared numbers from `SPIDER_ROBOT`; feature-local numbers in `spider/tunables.ts`, none inline |
| IV Test Pure Logic, Verify in Browser | PASS | `spiderBrain`, `computeFlankPoint`, hop eligibility and gait stepping are pure with Vitest; e2e covers the browser flow |
| V Exclusive File Ownership | PASS | Only `src/enemies/spider/**`, the T-13 e2e and `specs/T-13-spider-robot/**`; foundation gaps go to `foundation-requests.md` |
| VI Offline, Procedural | PASS | Primitive geometry only, no assets |
| VII Simplicity | PASS | Analytic two-segment legs (no IK solver); no new abstractions beyond brain, hop, legs, tunables |

No violations; Complexity Tracking not needed.

## Project Structure

### Documentation (this feature)

```text
specs/T-13-spider-robot/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/spider-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/enemies/spider/
├── index.ts          # createSpiderRobot factory (kept export)
├── SpiderRobot.ts    # BaseEnemy subclass: states, firing, hop execution, model
├── spiderBrain.ts    # pure decideSpider + computeFlankPoint
├── hop.ts            # pure hop eligibility + parabola
├── legs.ts           # gait state + zero-allocation update
├── tunables.ts       # SPIDER_LOCAL
└── *.test.ts         # unit tests
tests/e2e/T-13-spider-robot.e2e.mjs
```

**Structure Decision**: single feature folder under the enemies module; pure logic split from scene code for testability.
