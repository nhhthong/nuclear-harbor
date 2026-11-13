# Implementation Plan: Bomber Duck + Spot dog (T-19)

**Branch**: `T-19-duck-spot` | **Date**: 2026-11-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-19-duck-spot/spec.md`

## Summary

Replace `src/enemies/charger/**` and `src/enemies/spider/**` with `src/enemies/duck/**` and `src/enemies/spot/**`. Both extend `BaseEnemy` and keep the internal ids `charger` / `spider`. Pure decision logic (brains, hop curve, blast resolution, gait) is unit tested; models are procedural, merged with vertex colours (`mergeGeometries`) inside a `THREE.LOD`. Only the `charger` and `spider` lines of `factories.ts` change.

## Technical Context

**Language/Version**: TypeScript strict, Three.js 0.187, Vite
**Primary Dependencies**: three, @dimforge/rapier3d-compat (no new ones)
**Storage**: N/A
**Testing**: Vitest (pure logic + headless world), Playwright e2e (T-13 and T-14 files rewritten for Spot and Duck)
**Target Platform**: desktop browser, offline
**Project Type**: single web game project
**Performance Goals**: 60 FPS with 30 robots; near robot <= 6 draw calls, far 1-2; no per-frame allocation
**Constraints**: global maxDrawCalls 350; shared geometry/materials built once; disposal via resource scope; only owned files edited
**Scale/Scope**: 6 ducks, 10 Spot dogs in the harbor

## Constitution Check

*GATE: passed before research and re-checked after design.*

| Principle | Status | How |
|---|---|---|
| I Performance | PASS | Merged vertex-colour meshes, shared geometry/materials in `SharedAssets` (tracked once); LOD far = 1 mesh; scratch vectors only; beep/hop/lunge use timers, no pools needed (no projectiles). |
| II Typed contracts | PASS | Only `GameContext`, events, `BaseEnemy`; new events by declaration merging in `duck/events.ts`; no imports from other feature folders (spot imports `duck/modelKit` inside the enemies module only). |
| III Tunables | PASS | `duck/tunables.ts`, `spot/tunables.ts`; shared GDD config untouched. |
| IV Tests | PASS | Pure brains + blast + lunge planning unit tested; e2e per robot; full gate commands. |
| V Ownership | PASS | Edits: `src/enemies/duck|spot/**`, deleted `charger|spider/**`, two lines in `factories.ts`, line-local test updates (`EnemyManager.test.ts`), e2e T-13/T-14/T-16-slice references, this spec folder. Other asks go to `foundation-requests.md`. |
| VI Offline/procedural | PASS | No textures from CDN, no assets; canvas textures not used. |
| VII Simplicity | PASS | Reuse base class; one deviation recorded below. |

## Project Structure

### Documentation (this feature)

```text
specs/T-19-duck-spot/
├── spec.md, checklists/requirements.md
├── plan.md, research.md, data-model.md, quickstart.md
├── tasks.md, analyze.md, foundation-requests.md
```

### Source Code (repository root)

```text
src/enemies/
├── duck/    index.ts Duck.ts duckBrain.ts blast.ts hop.ts model.ts events.ts tunables.ts (+ tests)  modelKit.ts
├── spot/    index.ts Spot.ts spotBrain.ts model.ts tunables.ts (+ tests)
├── factories.ts   (charger and spider lines only)
```

**Structure Decision**: one folder per robot; `duck/modelKit.ts` (geometry painting and merging helpers) is reused by `spot/model.ts` to avoid duplicating ~40 lines.

## Design

- **Duck states**: `patrol -> hop -> arming -> destroyed`. Detect (LOS within range or recently seen) -> hop. Distance <= armDistance (2.5) -> arming; the countdown is `fsm.timeInState / 1 s`; `duck:beep` fires at counts 3,2,1; at 3.0 s `resolveBlast(distance3D, radius)` decides 15 damage or a harmless pop. Killing it earlier goes through the base `destroy()` (small pop).
- **Hop**: speed 6.2 m/s average; period 0.62 s; grounded fraction 0.2 (movement paused on landing); visual y = 4h u(1-u). Parabola is pure (`hop.ts`).
- **Spot states**: `patrol -> chase -> telegraph -> lunge -> retreat -> (circle) -> chase`. Lunge: locked direction, 15 m/s, max 9 m, one hit per lunge (contact test vs player capsule), 10 damage, impulse knockback; stops at non-walkable. Cooldown 2.5 s from lunge end; during cooldown Spot retreats then circles at about 6 m.
- **Events**: duck reuses `charger:windup` (arming, duration 3 s), `charger:hitPlayer` (blast hit), `enemy:alerted`, `enemy:attacked`; adds `duck:beep`, `duck:explode`. Spot reuses `enemy:alerted` / `enemy:attacked`.
- **Models**: parts painted with vertex colours and merged into body (static), beak (animated jaw), beacon (emissive swap), feet (waddle); Spot body + two diagonal leg-pair meshes (trot translation) + emissive optics. LOD near/far.
- **Tunables policy**: HP/damage/speeds in module tunables; shared `SPIDER_ROBOT`/`CHARGER_ROBOT` left (ammo-budget test uses them) and flagged for the cleanup ticket.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Module HP differs from `*_ROBOT.hp` in config | Owner asked for new HP; config edit would break the shared GDD ammo budget test | Editing GDD tunables is not owned by this ticket |
| Spot imports `duck/modelKit` | avoid duplicate helper | A third shared folder is not in the ownership list |
