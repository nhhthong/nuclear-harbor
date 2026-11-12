# Spec: T-10 VFX (pooled particles and effects)

Input: `docs/tickets/T-10-vfx.md`; GDD 13.4, 2, 5.3, 9.2, 16. Owner: `src/vfx/**`.

## User stories
1. As a player I see feedback for every shot without other modules asking: dust/spark on world hits, sparks on robot hits, a distinct bright ricochet spark on armour/absorbed hits, a red burst on weak point/core hits (AC2).
2. As a player I see robots explode with smoke and the boss die in a longer, staged explosion (AC3).
3. As a module author I can request any `VfxKind` with `vfx:spawn {kind, position, normal?, scale?, duration?}` (AC1).
4. As a player on weak hardware, particles never exceed a budget set by the quality preset; low-priority effects drop first (AC4, AC5).

## Functional requirements
- FR1 Fixed-capacity struct-of-arrays particle buffer; spawn returns false when full; swap-remove compaction; no allocation after construction (AC4, AC6).
- FR2 Recipes as data per kind (count, cone, speed, life, size, colour ramp, gravity, drag, optional flash light / shockwave ring), scaled by `scale`.
- FR3 Rendering: two `THREE.Points` (additive, alpha) = 2 draw calls for particles; extras: one ring InstancedMesh, one decal InstancedMesh, 3 pooled point lights (none on low quality).
- FR4 Event mapping: `combat:impact`, `combat:hit`, `enemy:destroyed`, `charger:stunned`, `pickup:collected`, `tower:activated`, `boss:*`, `player:landed` (hard), `vfx:spawn`.
- FR5 Budget 600 / 1500 / 3000 per quality (`settings:changed`); drops counted.
- FR6 Simulation only in `update(dt)`; `?vfxtest` cycles each kind every 2 s in front of the player.
- FR7 `ctx.testHooks.vfx = { liveParticles, liveEmitters, dropped, capacity }`; `dispose()` releases everything.

## Assumptions (resolved from ticket/PLAN)
- `dropped()` counts particles that could not be spawned. `liveEmitters()` = scheduled staged spawns + live rings + lit lights.
- Red weak-point burst is an internal recipe id (`weakpoint-burst`), not a new `VfxKind` (shared types are read-only).
- `boss:weakPointDamaged` has no position; `combat:hit` already covers it, so it is not subscribed. Boss position is remembered from `boss:spawned`.
- `telegraph-ring`: `scale` = ring radius in metres, `duration` default 1 s.
- Hard landing threshold and all vfx numbers live in `src/vfx/tunables.ts`.
- Armour ricochet direction = look direction reflected about the hit normal.

## Acceptance mapping
AC1 recipes test + e2e/manual `?vfxtest`; AC2 mapping tests; AC3 scheduler/sequence tests; AC4 buffer tests + e2e; AC5 two Points + budget test; AC6 buffer identity test; AC7 e2e dispose check / code review.
