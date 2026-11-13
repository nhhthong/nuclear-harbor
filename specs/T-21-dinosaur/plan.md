# Implementation Plan: Dinosaur semi-boss (T-21)

**Branch**: `worktree-agent-a0e6d6ab0bcf8412c` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-21-dinosaur/spec.md`

## Summary

A new gameplay module `dinosaur` (`src/dinosaur/**`) that picks 2 of the 4 towers with a seeded RNG, spawns a ~9 m mecha T-Rex when the player first comes within 35 m of such a tower, and runs its guard / three-skill fight. The model is a faithful, merged-geometry port of `docs/reference-models/dinosaur_semi_boss.html`. Rules (seed pick, skill choice, damage falloff, hit tests, state timers) are pure functions with Vitest tests; the module glues them to Rapier hit volumes (Groups.enemy colliders on a kinematic body, as the boss module does), the event bus and the scene. The dinosaur is NOT in `ctx.enemies`, so population totals and the T-16 flow are untouched.

## Technical Context

**Language/Version**: TypeScript 6 strict, Vite 8

**Primary Dependencies**: three 0.187, Rapier (via `ctx.physics`), Vitest 5

**Storage**: N/A

**Testing**: Vitest unit tests next to code; Playwright e2e `tests/e2e/T-21-dinosaur.e2e.mjs`

**Target Platform**: desktop browser, 60 FPS

**Project Type**: single web project (game)

**Performance Goals**: <= 25 draw calls per dinosaur (target ~16), global `maxDrawCalls` 350, no steady-state allocation

**Constraints**: only own files plus one-line edit in `src/modules.ts`; no imports from other feature folders; no CDN; shared textures/materials once

**Scale/Scope**: at most 2 dinosaurs per run

## Constitution Check

*GATE: passes before research and after design.*

| Principle | Check | Result |
|---|---|---|
| I Performance | Merged geometry per material group (vertex-coloured armour + glow = 2 materials), ~16 draw calls; shared geometry/materials created once; telegraph decals preallocated, no per-frame `new`; Rapier boxes/balls only (no mesh colliders); all GPU objects tracked in `ctx.resources.scope('dinosaur')`; pickups for drops use a small bounded array (max 8) | Pass |
| II Typed contracts | Only `GameContext`, event bus, `PlayerState`, shared types; events added by declaration merging in `src/dinosaur/events.ts`; no import from other feature folders (RNG, drops, shake are local); no `any` | Pass |
| III Tunables | All numbers in `src/dinosaur/tunables.ts`; tower positions from `@/config/level` | Pass |
| IV Tests | Pure logic (`guards.ts`, `brain.ts`, `combat.ts`) unit-tested first; e2e covers spawn, skills, drops, draw calls; typecheck/test/build/smoke green | Pass |
| V Ownership | Owns `src/dinosaur/**`, `tests/e2e/T-21-*`, `specs/T-21-dinosaur/`; shared edit: one line in `src/modules.ts` (ticket-authorised); guaranteed pickup drops and camera shake service go to `foundation-requests.md` | Pass (one authorised shared edit) |

No violations; Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/T-21-dinosaur/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
├── analyze.md
├── foundation-requests.md
└── tasks.md
```

### Source Code (repository root)

```text
src/dinosaur/
├── index.ts          module: seed pick, proximity spawn, per-tick glue, test hooks
├── tunables.ts       DINO numbers
├── events.ts         dino:* events (declaration merging)
├── guards.ts         seeded RNG + pickGuardTowers (pure)
├── brain.ts          skill choice, cooldowns, timelines (pure)
├── combat.ts         stomp falloff, tail-spin and ram hit tests (pure)
├── DinoModel.ts      merged model builder + animation rig
├── Dinosaur.ts       one dinosaur: Damageable, colliders, FSM, movement
├── drops.ts          ammo + medkit drop pickups (bounded)
└── *.test.ts
tests/e2e/T-21-dinosaur.e2e.mjs
```

**Structure Decision**: one feature folder, pure rules split from scene glue so they unit-test without three.js or Rapier.
