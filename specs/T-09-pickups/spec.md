# Feature Specification: Pickups (ammo crates, medkits, enemy drops)

**Ticket**: docs/tickets/T-09-pickups.md | **GDD**: 5.4, 13.4, 16 Player | **REVIEW**: #11 | **Status**: Implemented

## User Scenarios & Testing

### US1 - Walk over supplies (P1)
The player walks over an ammo crate (+30 rounds) or a medkit (+40 HP). Ammo is always accepted; a medkit
is refused (stays in the world) at full HP.
Tests: `logic.test.ts` (collect rules), e2e `?sandbox&autostart`.

### US2 - Harbor economy (P1)
After `world:ready` the harbor holds exactly 14 crates + 10 medkits over zones A-D, each resting on the first
surface below its candidate position. When all towers are activated (or at boot with `?boss`), 8 crates +
3 medkits appear on a ring just outside the boss arena.
Tests: `placements.test.ts` (counts, zone split, land, budget), runtime snap in e2e/manual.

### US3 - Robot drops (P2)
A destroyed robot drops a 15-round ammo pickup with 15% chance, at most 2 per zone, from a bounded pool;
drops expire after 60 s and blink in the last 5 s.
Tests: `logic.test.ts` (`shouldDrop`, lifetime/blink helpers).

## Requirements
- FR-1 `collect(kind, player)` pure rule; medkit consumed only if `player.heal()` returned > 0.
- FR-2 Placement candidates derived from `config/level.ts` (`placements.ts`, handed to T-16); `elevated`
  candidates land on container tops/perches; sea candidates are skipped with a console warning.
- FR-3 Collection loop: horizontal distance <= `ECONOMY.pickupRadius`, |dy| <= 1.5 m; no allocation per tick.
- FR-4 Events: `pickup:spawned`, `pickup:collected` (kind, amount, position), `weapon:grantAmmo`,
  `vfx:spawn {kind:'pickup'}`, `ui:toast`.
- FR-5 Visuals: two instanced meshes (ammo, medkit) with shared geometry/material => 2 draw calls; bob + spin.
- FR-6 Sandbox: one crate at (4,0,6), one medkit at (-4,0,6), nothing else.
- FR-7 `ctx.testHooks.pickups = { list, counts, spawn }`.
- FR-8 `dispose()` removes meshes and listeners via `ResourceTracker` scope.

## Success criteria
AC1-AC7 of the ticket (see `tasks.md` for the mapping).

## Assumptions (resolved from ticket/PLAN/REVIEW defaults)
- Per-zone drop cap counts drops spawned over the run (the ammo budget), not only live ones.
- Drops outside any zone (over the sea) never spawn. Drop position is ground-snapped; if no surface, skipped.
- `game:respawn` clears live drops (counters kept). Boss-arena supplies are spawned once.
- Sandbox candidates keep the given y when no surface is found.
- Pool capacity = `maxEnemyDropsPerZone * 4` (4 zones).
- Indoor tower-1 pickups use a lower ray origin (`castFromY`) so they land inside the warehouse, not on its roof.
