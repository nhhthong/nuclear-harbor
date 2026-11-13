# Implementation Plan: Final Boss Refresh (spherical walker)

**Branch**: `T-22-final-boss` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

## Summary

Replace the TITAN-04 greybox with a faithful procedural port of `docs/reference-models/final_boss.html` (scaled so the boss is 18 m tall), keep the existing fight model/attacks, move weak points to the four knee LEDs and the core to the eye, and add a landing cinematic (sky fall, impact, title card) with locked and invulnerable player, E skip after 2 s and a fast-forward hook. Pure logic (landing spot, cinematic timeline) is unit tested; browser behaviour by T-15 (updated) and new T-22 e2e.

## Technical Context

**Language/Version**: TypeScript strict, Three.js 0.187, Vite, Rapier. **Testing**: Vitest + Playwright e2e (scripts/e2e.mjs).
**Performance Goals**: boss <= 40 draw calls, total scene under 350; no per-frame allocation.
**Constraints**: procedural only, offline, ownership of src/boss/** and tests/e2e/T-15/T-22 only.
**Scale**: one boss, 2 x 4-shot pools as before.

## Constitution Check

| Principle | Status |
|---|---|
| I Performance | PASS: merged geometry per material (<= 40 draws), textures created once and shared, pools unchanged, scratch vectors only, everything tracked by the `boss` resource scope and disposed. |
| II Typed contracts | PASS: only existing events/hooks; no cross-module imports; camera/player touched through GameContext (`player.controlsLocked`, `invulnerableFor`, `ctx.camera`). |
| III Tunables | PASS: all new numbers in `src/boss/tunables.ts`; level numbers read from `BOSS_ARENA`. |
| IV Test pure logic | PASS: landing spot and cinematic timeline are pure with Vitest tests; e2e for cinematic. |
| V Ownership | PASS: edits only under src/boss/**, T-15/T-22/T-16 e2e (timing only, justified), spec dir. No foundation edits. |
| VI Offline procedural | PASS: canvas textures, no assets or CDN. |
| VII Simplicity | PASS: no new framework; the eye doubles as cannon muzzle; deviation: height 18 m local tunable instead of shared `BOSS.totalHeight` (22, shared file untouched). |

Post-design re-check: no violations.

## Project Structure

### Documentation

```text
specs/T-22-final-boss/  spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md, analyze.md
```

### Source Code

```text
src/boss/
  tunables.ts        model scale, cinematic timings, landing numbers
  BossTextures.ts    shared armour/leg canvas textures (once)
  BossBody.ts        reference port: merged static parts, animated legs, hydraulics
  BossColliders.ts   hull ball, knee weak-point balls, leg boxes, eye core
  landing.ts (+test) pickLandingSpot(...)
  cinematic.ts (+test) timeline(t) -> camera/bars/flags
  CinematicFx.ts     DOM bars + title card, streak/glow/ring meshes
  index.ts           integration, hooks
tests/e2e/T-15-*.mjs (updated), T-22-final-boss.e2e.mjs (new), T-16-full-run (wait for hunt phase)
```

**Structure Decision**: single-module upgrade inside the boss folder.

## Complexity Tracking

No violations to justify.
