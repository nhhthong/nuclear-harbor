# Implementation Plan: Grappling hook

**Branch**: `worktree-agent-ac78139cf7f3cfab0` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-12-grappling-hook/spec.md`; ticket `docs/tickets/T-12-grappling-hook.md`; `docs/PLAN.md` sections 3-7.

## Summary

A pure `GrappleState` machine (ready, pulling, cooldown) decides outcomes from per-step inputs (fire edge, ray result, eye position, moved distance). A thin module (`src/grapple/index.ts`) feeds it from `ctx.physics.raycast` (query group `grapple`, validity via `meta.grappleable`), drives `ctx.player.externalVelocity`, emits the already-declared `grapple:*` events, and draws hook, cable and a DOM crosshair tint. Perch anchors end with a guided placement on `landing`; ordinary surfaces release with partial momentum and an aim point 0.5 m above the hit so the capsule clears container lips.

## Technical Context

**Language/Version**: TypeScript 6 strict (`noUncheckedIndexedAccess`), ES modules

**Primary Dependencies**: three.js 0.187 (visuals), Rapier via `ctx.physics` (no direct import)

**Storage**: N/A

**Testing**: Vitest for `GrappleState` and aim math; Playwright e2e `tests/e2e/T-12-grappling-hook.e2e.mjs` against `dist/`

**Target Platform**: Desktop browser, 60 Hz fixed step

**Project Type**: Single web project (game feature module)

**Performance Goals**: zero steady-state allocation while pulling; one raycast per fire press plus one per frame for the crosshair indicator

**Constraints**: only `src/grapple/**`, its e2e file and its spec folder are edited; events already declared in `src/core/events.ts` (reasons `arrived|manual|stuck|timeout|death`; failures `no-target|not-grappleable|out-of-range|cooldown`)

**Scale/Scope**: one module, ~5 source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I Performance by design | PASS | Scratch vectors at module level; hook/cable meshes created once in `init` (single shared geometry/material), tracked by `ctx.resources.scope('grapple')`; no pooling needed (one hook); DOM node and listeners removed in `dispose`. |
| II Typed contracts | PASS | Uses only `GameContext`, existing events and shared types; no imports from other feature folders; no `any`/ts-ignore. |
| III Tunables in config | PASS | Shared values from `GRAPPLE` in `src/config/tunables.ts`; feature-local numbers (failure cooldown, cone angle, clearance, events rate, perch teleport range) in `src/grapple/tunables.ts`. |
| IV Test pure logic | PASS | State machine and aim-cone math are pure with Vitest tests written first; browser e2e covers pillar, perch, container, failure, cooldown. |
| V Exclusive ownership | PASS | No foundation edits. Any need goes to `foundation-requests.md` (none expected). |

Post-design re-check: PASS (no violations; Complexity Tracking not needed).

## Project Structure

### Documentation (this feature)

```text
specs/T-12-grappling-hook/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/events.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/grapple/
├── index.ts          # createGrappleModule (id 'grapple'): wiring, targeting, player drive
├── GrappleState.ts   # pure state machine
├── GrappleState.test.ts
├── aim.ts            # pure aim-assist cone test and pull-target helpers
├── aim.test.ts
├── visuals.ts        # hook head, cable, DOM crosshair indicator
└── tunables.ts       # feature-local numbers
tests/e2e/T-12-grappling-hook.e2e.mjs
```

**Structure Decision**: single feature folder owned by T-12, pure logic split from three.js/DOM code so it unit-tests in Node.
