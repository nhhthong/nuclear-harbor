# Implementation Plan: Optimisation, Offline Packaging and Integration Backlog (T-17)

**Branch**: `T-17-optimization-offline` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-17-optimization-offline/spec.md`

## Summary

Cross-cutting last ticket. Measure first (menu 384 draw calls, harbor ~214), find the cause of the menu overhead, then: apply settings (pure `quality.ts` presets + fps cap + volume), static-once sun shadow with a small dynamic refresh, hand-written service worker with build-time precache manifest, Credits screen, playtest fixes (defend balance, warehouse light, UI request, checkpoint copy, tunable cleanup), vendor chunking, bench/leakcheck/offline scripts, docs and real screenshots.

## Technical Context

**Language/Version**: TypeScript 6 strict, Node 20+

**Primary Dependencies**: three 0.187, @dimforge/rapier3d-compat 0.21, Vite 8 (no new runtime dependency)

**Storage**: LocalStorage (existing `Settings`), Cache Storage (service worker)

**Testing**: Vitest (pure logic), Playwright e2e/smoke scripts on software GL

**Target Platform**: desktop browsers; offline after first load

**Project Type**: browser game (single project)

**Performance Goals**: draw calls <= 350, triangles <= 1.5 M, 60 FPS on real hardware (unverifiable here)

**Constraints**: offline, no CDN, no per-frame allocation, shadows static-once

**Scale/Scope**: 30 robots, 1 boss, one harbor level

## Constitution Check

| Principle | Status | Note |
|---|---|---|
| I Performance by design | PASS | Goal of the ticket; presets, static shadow, no new hot-loop allocation, new lights are cheap and shadow-free; dispose of new resources via ResourceTracker. |
| II Typed contracts | PASS | No event renamed/removed; UI keeps going through ctx/EventBus; only additive changes. Boss checkpoint fix makes the payload comply with the contract. |
| III Tunables in config | PASS | Quality presets, defend balance and light values go to tunables files; balance values change with a recorded playtest reason (docs/PLAYTEST.md). |
| IV Test pure logic | PASS | Pure `quality` preset/fps-cap logic, precache manifest builder and credits data are unit-tested; browser checks via smoke + e2e + offline script. |
| V Exclusive ownership | DEVIATION (allowed) | The ticket is the declared cross-cutting exception; every touched file is listed below for Tech Lead review. No other agent is in flight. |
| VI Offline / procedural | PASS (note) | Service worker, manifest and procedural icons add offline support. The G36C GLB already exists under Tech Lead approval (docs/ASSETS.md). |
| VII Simplicity | PASS | Hand-written SW, no workbox; one small preset table; no new framework. |

Post-design re-check: unchanged, no unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/T-17-optimization-offline/
├── plan.md, research.md, data-model.md, quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (planned touched files; final list in the hand-over)

```text
src/core/quality.ts (+test)        # new pure presets, fps-cap helper
src/core/{Renderer,Game,GameLoop,Settings}.ts  # apply settings, fps cap, shadow autoUpdate
src/audio/*                        # master volume applied
src/world/{index,lighting,buildings}.ts  # shadow-once, warehouse lights, draw-call fixes
src/ui/{screens,index,styles}.ts   # credits, request() fix, settings wiring
src/boss/index.ts                  # checkpoint copy
src/enemies/tunables.ts, src/objectives/*, src/config/tunables.ts  # defend balance, unused tunables
src/offline/register.ts (+test)    # SW registration (production only)
src/main.ts                        # call registration
public/{sw.js,manifest.webmanifest,icons}, vite.config.ts  # precache plugin, chunks, minify
scripts/{bench,leakcheck,offline}.mjs, tests/e2e/T-17-*.e2e.mjs
docs/{PERFORMANCE,OFFLINE,PLAYTEST}.md, README.md, docs/playtest/*.png
```

**Structure Decision**: single project; new code in `src/core/quality.ts` and `src/offline/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Edits to foundation and other tickets' files (Principle V) | Ticket T-17 explicitly is the cross-cutting exception | Foundation requests would leave the backlog unfixed |
