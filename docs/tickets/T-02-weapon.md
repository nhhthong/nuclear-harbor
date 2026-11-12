# T-02 — Weapon (shooting, reload, ammo, procedural view model)

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 5.1, 5.3, 5.4 (ammo numbers), 13.4, 16 Player/Weapon Asset |
| Spec dir | `specs/T-02-weapon/` |

## Goal

Implement the automatic rifle: hitscan shooting at 8 rounds/s, magazine 30 / reserve 180, 1.8 s reload (right mouse or R), crit multiplier through hit zones, recoil and spread, and a procedural first-person view model with muzzle flash, tracers and shell casings. The GameBanana model is NOT used (REVIEW #3).

## Files owned (exclusive)

- `src/weapon/**` (replace `src/weapon/index.ts`; keep `createWeaponModule` and id `weapon`). `src/weapon/viewmodel/` must hide the model behind a small interface so T-18 can swap it.
- `tests/e2e/T-02-weapon.e2e.mjs` (browser check, optional but recommended)
- `specs/T-02-weapon/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ctx.input`: `isDown('fire')`, `wasPressed('fire')`, `wasPressed('reload')`
- `ctx.player.getEyePosition / getLookDirection`, `ctx.player.pitch / yaw` (recoil kick), `alive`, `sprinting`, `velocity`
- `ctx.physics.raycast(origin, dir, WEAPON.range, { groups: QueryGroups.playerShot })` → `RayHit.meta.damageable / hitZone`
- `WEAPON` tunables, `ObjectPool`, `ctx.camera` (parent of the view model)
- Events in: `weapon:grantAmmo { amount }`, `game:respawn` (ammo floor), `world:ready` (emit initial ammo)

## Interfaces provided

- Events out: `weapon:fired`, `weapon:dryFire`, `weapon:reloadStarted`, `weapon:reloadFinished`, `weapon:ammoChanged`, `combat:hit`, `combat:impact`
- `ctx.testHooks.weapon = { getAmmo(): { mag, reserve }, isReloading(), fireOnce() }`
- `src/weapon/viewmodel/ViewModel.ts` interface (`object3d`, `muzzleLocalPosition`, `update(dt, state)`, `playFire()`, `playReload(duration)`, `dispose()`) with the procedural implementation as default

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-02-weapon
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-02-weapon/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-02-weapon/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure `WeaponState` (`src/weapon/WeaponState.ts` + tests): mag/reserve counts, fire cooldown from `WEAPON.fireRate`, automatic fire while held, dry fire, reload timer (cannot fire while reloading, reload moves `min(magSize - mag, reserve)` rounds), reload refused when the magazine is full or reserve is empty, auto-reload when firing on an empty magazine with reserve left, `grantAmmo`. Driven by `step(dt, { fireHeld, firePressed, reloadPressed })` returning what happened this tick.
2. Pure spread/recoil model (`src/weapon/recoil.ts` + tests): spread grows per shot and recovers over time, larger while sprinting/moving; recoil kick values from tunables.
3. Latch edge inputs in `update()` (`wasPressed`) and consume them in `fixedUpdate()`; never read edges in `fixedUpdate` directly.
4. On a shot: ray from the eye along the look direction perturbed by the current spread. If `hit.meta.damageable` → `applyDamage({ amount: WEAPON.damage, zone: hit.meta.hitZone ?? 'body', source: 'player', point, direction })` and emit `combat:hit` with the returned `DamageResult`; else emit `combat:impact`. Do not multiply crits yourself: targets apply zone multipliers.
5. Recoil: add the pitch/yaw kick to `ctx.player.pitch/yaw` and recover part of it over time (keep the accumulated kick in your module so only your own offset is recovered).
6. Procedural view model: box/cylinder primitives (receiver, barrel, magazine, stock, sight) parented to `ctx.camera`, rendered with a small FOV-independent offset; idle sway from player velocity, kick-back on fire, a simple magazine-drop reload animation lasting `WEAPON.reloadDuration`. Keep it under ~30 draw-call-free meshes by merging geometry or sharing materials.
7. Pooled effects (caps in `WEAPON.max*`): muzzle flash (sprite/mesh + short point light or emissive only), tracer line from muzzle to hit point, shell casings (simple ballistic arc, no physics bodies). When a pool is empty, skip the effect.
8. Emit `weapon:ammoChanged` whenever counts change and once on `world:ready`; include `magSize` and `WEAPON.name`.
9. `game:respawn`: guarantee at least `respawnReserveFloor` reserve rounds (put the value, default 60, in `src/weapon/tunables.ts`).
10. Hide the view model and block firing when the player is dead or `ctx.player.controlsLocked`.
11. e2e: in `?sandbox&autostart` aim at dummy 0 (set `ctx.player.yaw/pitch` or teleport in front of it), hold `Mouse0` for 1 s, assert 8 ± 1 shots, `combat:hit` events with `dealt` 25 (body) and 50 (critical head box), then press `KeyR` and assert the reload timing.

## Acceptance criteria

- [ ] **AC1** Holding fire shoots 8 rounds per second (±1 over 2 s) until the 30-round magazine is empty, then dry-fires or auto-reloads.
- [ ] **AC2** Reload takes 1.8 s, is triggered by right mouse and by R, cannot be interrupted by firing, and moves the correct number of rounds from reserve (start: 30 + 180).
- [ ] **AC3** A body hit on a sandbox dummy deals 25, a hit on its `critical` box deals 50 (2.0x); the values come from `DamageResult`, with `combat:hit` emitted for each.
- [ ] **AC4** Shots that hit static geometry emit `combat:impact` with the correct point and normal; shots do not hit the player capsule.
- [ ] **AC5** `weapon:grantAmmo { amount: 30 }` increases the reserve by 30 and emits `weapon:ammoChanged`.
- [ ] **AC6** A procedural view model is visible in first person with muzzle flash, recoil kick, tracers and ejected casings; all three effect types are pooled and bounded.
- [ ] **AC7** Spread and recoil are visible when spraying and recover when not firing; all numbers come from tunables.
- [ ] **AC8** No firing and no view model while the player is dead.
- [ ] **AC9** `WeaponState` and recoil logic are covered by unit tests that do not need three.js or the DOM.

## Notes

Bullets are hitscan (GDD 13.4 "player bullets" are represented by pooled tracers). Sound and impact particles belong to T-07 and T-10, driven by your events.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-02
# manual: npm run dev → http://localhost:5173/?sandbox  (shoot the red dummies; head = crit)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
