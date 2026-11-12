# T-15 — TITAN-04 boss fight

| | |
|---|---|
| Wave | 2 |
| Depends on | T-02 (to shoot it in play). Soft: T-04 (arena perches), T-10 (effects), T-06 (boss HUD) — all through events |
| GDD sections | 9, 9.1-9.4, 5.4 (HP budget), 15.1 (boss greybox), 15.2, 16 Objectives and Boss; REVIEW #2, #12 |
| Spec dir | `specs/T-15-boss-titan04/` |

## Goal

Implement TITAN-04: a 22 m four-legged sphere-bodied robot that appears on the dock when all towers are active, with four red weak points (500 HP each) that must be destroyed before the core (4,000 HP) is exposed, four phases, and the three mandatory telegraphed attacks: Heavy Cannon, Ground Slam, Missile Barrage.

## Files owned (exclusive)

- `src/boss/**` (replace `src/boss/index.ts`; keep `createBossModule` and id `boss`)
- `tests/e2e/T-15-boss-titan04.e2e.mjs` (browser check, optional but recommended)
- `specs/T-15-boss-titan04/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `BOSS` tunables; `BOSS_ARENA`, `SANDBOX_SPAWN` from `@/config/level`; `ctx.flags.params` (`?boss` spawns immediately; `?bossphase=core` starts with weak points destroyed)
- `Damageable`, `ColliderMeta` (`hitZone: 'armor' | 'weakpoint' | 'core'`), `resolveDamage`; `ctx.physics.addCollider` on a kinematic body in `Groups.enemy` with meta `{ kind: 'boss', damageable, hitZone }`
- `ctx.player` (`position`, `applyDamage`, `addImpulse`, `controlsLocked` for the short awakening), `ctx.physics.hasLineOfSight`, `ObjectPool`
- Events in: `objectives:allActivated` (spawn), `game:respawn` (reset attack timers, keep damage)

## Interfaces provided

- Events out: `boss:spawned`, `boss:phaseChanged`, `boss:weakPointDamaged`, `boss:weakPointDestroyed`, `boss:coreExposed`, `boss:coreDamaged`, `boss:attackTelegraph`, `boss:attack`, `boss:defeated`, `game:checkpoint { id: 'boss-start' }` at spawn (REVIEW #7), `vfx:spawn` requests
- `ctx.testHooks.boss = { getState(): { phase, weakPoints: number[], coreHp }, damageWeakPoint(i, amount), damageCore(amount), forceAttack(id) }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-15-boss-titan04
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-15-boss-titan04/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-15-boss-titan04/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure combat model first with tests (`BossModel.ts`): four weak points with `weakPointHp`, core with `coreHp`; `hitWeakPoint(i, amount)`, `hitCore(amount)`, `hitArmor()`; rules: armour absorbs everything (`armorDamageMultiplier` 0), the core absorbs everything until all four weak points are destroyed, destroyed weak points ignore hits, phase transitions `dormant → awakening → weakpoint-hunt → core-exposed → destroyed`, events returned as data. Include the GDD 5.4 check: total boss HP = 2,000 + 4,000.
2. Pure attack scheduler with tests (`BossAttacks.ts`): cooldown per attack, global `attackInterval`, selection by range/phase, telegraph → impact timeline, and the ability lost per destroyed weak point (GDD 9.2): suggested mapping front → Heavy Cannon cooldown x1.5, left/right → Missile Barrage count −2 each, rear → Ground Slam radius −30%. In `core-exposed` the remaining attacks speed up slightly (REVIEW #12: pressure comes from attacks).
3. Model (greybox per GDD 15.1, primitives): sphere body 15 m in diameter with its centre ~14.5 m high (overall height 22 m), four articulated legs (two boxes each) reaching the ground, armour plates, four red emissive weak-point lights at front/back/left/right on the equator (radius `weakPointRadius`), core hatch at the bottom/front that opens in phase 3 revealing a bright core. Share materials; ≤ 25 draw calls.
4. Colliders on one kinematic body: big ball = `armor`; four small balls slightly proud of the hull = `weakpoint` (meta carries the index via `owner`); core ball = `core`, created (or enabled) only when exposed; leg boxes = `armor`. One `Damageable` adapter per zone forwarding to `BossModel`, returning proper `DamageResult` (`absorbed: true` for armour) so HUD/VFX react.
5. Spawn: on `objectives:allActivated` (or `?boss`) at `BOSS_ARENA.center`; in `?sandbox` at (−20, 0, 24) scaled ×0.4 so it fits. Phase 1 awakening lasts `awakeningDuration`: rise/drop-in animation, `boss:spawned`, checkpoint, no attacks, boss invulnerable. No cinematic camera in v1; optionally lock controls for ≤ 1.5 s.
6. Movement: slow walk (2.5 m/s) keeping 20-35 m from the player and staying inside the arena radius; body yaw turns slowly towards the player so weak points rotate out of view (forces repositioning/grapple). Procedural leg stepping (alternate diagonal pairs); legs are visual + colliders updated with the body.
7. Heavy Cannon (mandatory): telegraph = charging glow + ground marker at the predicted player position for `telegraph` s (`boss:attackTelegraph`), then a pooled energy projectile (`maxProjectiles`) flying at `projectileSpeed`, exploding with `splashRadius`; blocked by world geometry (cover works).
8. Ground Slam (mandatory): when the player is within `groundSlam.radius`: leg raise + expanding red ring decal for `telegraph` s, then radial damage + knockback to a grounded player inside the radius (players standing on perches above 3 m are safe: rewards grappling).
9. Missile Barrage (mandatory): `count` markers on the ground around the player's position (spread 8 m) shown for `telegraph` s, pooled missiles arc down, each with `splashRadius` damage. All three attacks draw their own danger markers (do not depend on T-10).
10. Weak-point feedback (GDD 9.2): light flickers and dims with HP, `boss:weakPointDamaged` on each hit, burst + dead light on destruction; when all four are gone: hatch opens, `boss:coreExposed`, phase `core-exposed`. Core hits emit `boss:coreDamaged`.
11. Defeat: phase `destroyed`, stop attacks, release projectiles, collapse animation over ~3 s, `vfx:spawn { kind: 'big-explosion' }`, emit `boss:defeated`. The flow module turns it into Victory.
12. e2e: `?sandbox&autostart&boss`: `boss:spawned` after boot; `damageCore` before weak points → HP unchanged (absorbed); destroy four weak points through the hook → `boss:coreExposed`; `forceAttack('ground-slam')` emits telegraph then attack and damages a nearby grounded player; `damageCore(4000)` → `boss:defeated`.

## Acceptance criteria

- [ ] **AC1** TITAN-04 spawns at the boss arena when `objectives:allActivated` fires (and with `?boss`), with a sphere body 15 m across, four legs and an overall height of about 22 m, emitting `boss:spawned` and a `boss-start` checkpoint.
- [ ] **AC2** Four red weak points sit at front, back, left and right; each has 500 HP, shows damage feedback, and emits damaged/destroyed events.
- [ ] **AC3** Armour hits and core hits before exposure deal zero damage and report `absorbed` (the boss cannot be killed before all four weak points are destroyed).
- [ ] **AC4** Destroying each weak point removes or weakens a predefined ability; destroying all four opens the core, emits `boss:coreExposed` and switches the phase.
- [ ] **AC5** The core has 4,000 HP; reducing it to zero triggers the collapse sequence and `boss:defeated` exactly once.
- [ ] **AC6** Heavy Cannon, Ground Slam and Missile Barrage each have a visible ground/body telegraph of the configured duration, emit `boss:attackTelegraph` then `boss:attack`, damage the player only inside their danger area, and can be avoided (cover, leaving the radius, standing on a perch for the slam).
- [ ] **AC7** Boss projectiles and missiles are pooled with a hard cap; the boss stays inside the arena.
- [ ] **AC8** The phase sequence awakening → weak-point hunt → core exposed → destroyed is observable through `boss:phaseChanged`.
- [ ] **AC9** Combat model and attack scheduler are pure and unit tested; the boss costs ≤ 25 draw calls.

## Notes

Optional attacks (Shockwave, Target Lock, EMP Pulse) are out of scope (cut list item 3). The countdown is already stopped when the boss appears (REVIEW #12).

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-15
# manual: npm run dev → http://localhost:5173/?sandbox&boss      (scaled boss)
#         npm run dev → http://localhost:5173/?autostart&boss    (full size at the dock)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
