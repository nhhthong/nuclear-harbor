# T-09 — Pickups: ammo crates, medkits and enemy drops

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 5.4, 13.4 (pooled drops), 16 Player; REVIEW #11 |
| Spec dir | `specs/T-09-pickups/` |

## Goal

Implement the ammo and health economy: ammo crates (+30 rounds) and medkits (+40 HP) placed in the four zones and in the boss arena, plus a 15% ammo drop from destroyed robots limited per zone, all collected by walking over them.

## Files owned (exclusive)

- `src/pickups/**` (replace `src/pickups/index.ts`; keep `createPickupsModule` and id `pickups`). `src/pickups/placements.ts` is handed to T-16 for final tuning later.
- `tests/e2e/T-09-pickups.e2e.mjs` (browser check, optional but recommended)
- `specs/T-09-pickups/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ECONOMY` tunables; `ZONES`, `BOSS_ARENA`, `TOWERS`, `KEEP_CLEAR`, `zoneAt` from `@/config/level`
- `ctx.player` (`position`, `hp`, `maxHp`, `alive`, `heal()`); `ctx.physics.raycast` (ground snap, `QueryGroups.worldOnly`)
- `ObjectPool` for dropped pickups
- Events in: `world:ready` (place), `enemy:destroyed` (drop roll), `objectives:allActivated` (spawn boss-arena supplies), `game:respawn`

## Interfaces provided

- Events out: `pickup:spawned`, `pickup:collected`; request `weapon:grantAmmo { amount }`; `vfx:spawn { kind: 'pickup' }`; `ui:toast` (e.g. "+30 ammo")
- `ctx.testHooks.pickups = { list(): {id, kind, position, dropped}[], counts(), spawn(kind, position) }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-09-pickups
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-09-pickups/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-09-pickups/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure logic with tests: `collect(kind, playerState)` rules (medkit refused at full HP, ammo always accepted), drop roll `shouldDrop(rng, zoneDropsSoFar)` honouring `enemyAmmoDropChance` and `maxEnemyDropsPerZone`, and a budget test: placed crates/medkits equal `ECONOMY.ammoCratesInZones` (14) + `ammoCratesInBossArena` (8) and `medkitsInZones` (10) + `medkitsInBossArena` (3), and supply ≥ GDD 5.4 demand at 50% accuracy even with zero drops.
2. `placements.ts`: candidate XZ positions per zone derived from `level.ts` (near each tower, in Charger-heavy zone A, a few flagged `elevated: true` meant to end up on container tops/perches to reward grappling, GDD 5.4). Distribute 14 crates and 10 medkits across A/B/C/D (suggested 5/4/2/3 crates, 3/3/2/2 medkits); boss arena: 8 crates + 3 medkits on a ring just outside the arena radius.
3. Placement at runtime (on `world:ready`): for each candidate raycast down from y = 40 with `QueryGroups.worldOnly` and rest the pickup on the first surface; candidates over the sea are skipped with a console warning. This keeps placements valid whatever T-03 builds; `elevated` candidates intentionally land on top of containers.
4. Boss-arena supplies spawn when `objectives:allActivated` fires (or immediately with `?boss`), so they cannot be used up before the fight.
5. Visuals: procedural box crate (olive, yellow stripe) for ammo and white box with a green cross for medkits, slow bob + spin, soft emissive so they read at distance; two shared geometries/materials; use `InstancedMesh` or shared meshes.
6. Collection: in `fixedUpdate` test horizontal distance ≤ `ECONOMY.pickupRadius` and |dy| ≤ 1.5 m to each active pickup (a flat loop over ≤ 50 items is fine; no physics sensors required). Ammo → emit `weapon:grantAmmo`; medkit → `ctx.player.heal(ECONOMY.medkitHeal)` and only consume when it returned > 0. Emit `pickup:collected`, a toast and a vfx request.
7. Enemy drops: on `enemy:destroyed` roll the drop; spawn a pooled ammo pickup (`ECONOMY.enemyAmmoDropAmount` rounds) at the position snapped to ground; despawn after `ECONOMY.dropLifetime` with a blink in the last 5 s; cap live drops with the pool (GDD 13.4).
8. Sandbox: one ammo crate at (4, 0, 6) and one medkit at (-4, 0, 6).
9. e2e: `?sandbox&autostart`: damage the player by 50 through `ctx.player.applyDamage`, teleport onto the medkit → HP 90 and `pickup:collected`; teleport onto the crate → a `weapon:grantAmmo { amount: 30 }` event is observed; a medkit at full HP is not consumed.

## Acceptance criteria

- [ ] **AC1** Walking over an ammo crate emits `weapon:grantAmmo { amount: 30 }` and removes the crate; walking over a medkit heals 40 HP (capped at max) and removes it; a medkit is not consumed at full HP.
- [ ] **AC2** The harbor contains exactly 14 ammo crates and 10 medkits across the four zones after `world:ready`, each resting on a surface; 8 crates and 3 medkits appear around the boss arena when all towers are activated.
- [ ] **AC3** Destroyed robots drop ammo with 15% probability, at most `maxEnemyDropsPerZone` per zone, using a bounded pool; drops expire after their lifetime.
- [ ] **AC4** A unit test proves the supply (start 210 + crates) covers the GDD 5.4 demand at 50% accuracy without counting drops.
- [ ] **AC5** Pickups are visible, animated, and share geometry/materials (≤ 4 draw calls for all pickups).
- [ ] **AC6** Every collection emits `pickup:collected` with kind, amount and position.
- [ ] **AC7** `dispose()` removes all meshes and listeners; no per-frame allocations in the collection loop.

## Notes

The weapon (T-02) owns ammo counts and handles `weapon:grantAmmo`; in your e2e check assert the emitted event rather than the ammo value so the test passes without T-02.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-09
# manual: npm run dev → http://localhost:5173/?sandbox
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
