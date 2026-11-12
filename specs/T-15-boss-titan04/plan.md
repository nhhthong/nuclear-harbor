# Implementation Plan: TITAN-04 Boss Fight

**Branch**: `T-15-boss-titan04` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-15-boss-titan04/spec.md`

## Summary

Replace the `src/boss/index.ts` placeholder with the TITAN-04 module. Rules live in two pure, unit-tested classes (`BossModel`, `BossAttacks`); a greybox primitive model, kinematic colliders with per-zone `Damageable` adapters, pooled projectiles/missiles/markers and an e2e check sit around them. Everything talks to other modules through events and `ctx.testHooks.boss`.

## Technical Context

**Language/Version**: TypeScript strict, Node 20+, Vite

**Primary Dependencies**: three, @dimforge/rapier3d-compat (existing only)

**Storage**: N/A

**Testing**: Vitest (pure logic), Playwright e2e `tests/e2e/T-15-boss-titan04.e2e.mjs`

**Target Platform**: Desktop browser, offline

**Project Type**: Single web game project (feature module)

**Performance Goals**: 60 FPS; boss <= 25 draw calls; no per-frame allocation

**Constraints**: pooled projectiles (cap `BOSS.maxProjectiles`), Rapier primitives only, own files only

**Scale/Scope**: one boss, 3 attacks, 4 weak points + core

## Constitution Check

*GATE: passed before research; re-checked after design (still passes).*

| Principle | Status | How |
|---|---|---|
| I Performance | PASS | `ObjectPool` for cannon shots, missiles, ground markers (hard caps); shared geometry/materials; boss model built once, merged-free but <= 25 meshes; module-level scratch vectors; Rapier sphere/box colliders only; all GPU objects via `ctx.resources.scope('boss')` and disposed. |
| II Typed contracts | PASS | Only `GameContext`, event bus, `Damageable`, `ColliderMeta`, `ctx.player`; no imports from other feature folders; no `any`; events already exist in the catalogue. |
| III Tunables | PASS | `BOSS`, `BOSS_ARENA`, `SANDBOX_SPAWN` used; boss-local numbers (ability scaling, leg gait, collapse time, sandbox scale, marker sizes) in `src/boss/tunables.ts`. |
| IV Test pure logic | PASS | `BossModel.test.ts`, `BossAttacks.test.ts` written first; every AC mapped (see below); e2e covers flow. |
| V Ownership | PASS | Only `src/boss/**`, `tests/e2e/T-15-*`, `specs/T-15-boss-titan04/**`. No foundation requests expected. |
| VI Offline/procedural | PASS | Primitives and canvas-free materials; no assets, no network, no new deps. |
| VII Simplicity | PASS | No optional attacks, no cinematic; weak points + core fully kept. No deviation from PLAN/REVIEW. |

## Project Structure

### Documentation (this feature)

```text
specs/T-15-boss-titan04/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/boss/
├── index.ts          # createBossModule: lifecycle, events, hooks, glue
├── tunables.ts       # boss-local numbers
├── BossModel.ts      # pure combat model (+ .test.ts)
├── BossAttacks.ts    # pure scheduler/timeline (+ .test.ts)
├── BossBody.ts       # three.js greybox, legs, weak-point lights, hatch/core, collapse pose
├── BossColliders.ts  # kinematic body, colliders, Damageable adapters
└── BossProjectiles.ts# pooled cannon shots, missiles, danger markers
tests/e2e/T-15-boss-titan04.e2e.mjs
```

**Structure Decision**: single feature folder; pure logic isolated from three/Rapier so Vitest runs in Node.

## AC mapping

AC1 e2e (spawn, checkpoint) + model test; AC2 model test + e2e; AC3 model test + e2e; AC4 attacks test (ability scaling) + e2e; AC5 model test (single defeat) + e2e; AC6 attacks test (timeline) + e2e slam + manual check for cannon cover; AC7 pool test via `droppedCount` + arena clamp unit test; AC8 model test + e2e phase events; AC9 unit tests + e2e draw-call read from `renderer.webgl.info` delta (manual note if headless inaccurate).

## Complexity Tracking

No violations.
