# Feature Specification: T-02 Weapon

**Input**: `docs/tickets/T-02-weapon.md`; GDD 5.1, 5.3, 5.4, 13.4, 16. **Status**: Implemented

## User Scenarios

1. **Shoot (P1)**: Holding fire shoots an automatic hitscan rifle at 8 rounds/s from a 30-round magazine (180 reserve). Empty magazine: dry-fire click, or auto-reload when reserve remains.
2. **Reload (P1)**: Right mouse or R starts a 1.8 s reload that cannot be interrupted by firing; it moves `min(30 - mag, reserve)` rounds. Refused when the magazine is full or the reserve is empty.
3. **Damage feedback (P1)**: A shot that hits a damageable applies 25 damage with the collider's hit zone and emits `combat:hit` with the returned `DamageResult` (body 25, critical 50, computed by the target). A shot that hits static geometry emits `combat:impact` (point, normal). Bullets never hit the player capsule.
4. **Feel (P2)**: Spread grows per shot and recovers; larger while sprinting or moving. Camera recoil kicks pitch/yaw and partly recovers. A procedural first-person view model shows kick-back, a magazine-drop reload, muzzle flash, tracers and ejected shell casings.
5. **Ammo economy (P2)**: `weapon:grantAmmo` adds to reserve; `game:respawn` guarantees a reserve floor (60); `weapon:ammoChanged` is emitted on every change and once on `world:ready`.
6. **Dead / locked (P2)**: No firing and no view model while the player is dead or `controlsLocked`.

## Requirements

- FR-01 `WeaponState`: pure, three.js-free state machine driven by `step(dt, {fireHeld, firePressed, reloadPressed})`.
- FR-02 Pure spread/recoil model; all numbers from `WEAPON` tunables or `src/weapon/tunables.ts`.
- FR-03 Edge inputs latched in `update()`, consumed in `fixedUpdate()`.
- FR-04 Effects (muzzle flash, tracers, casings) pooled with `WEAPON.max*` caps; skipped when a pool is empty. No physics bodies for casings.
- FR-05 View model behind a `ViewModel` interface (`object3d`, `muzzleLocalPosition`, `update`, `playFire`, `playReload`, `dispose`) so a later ticket can swap it. No external model asset (REVIEW #3).
- FR-06 Events out: `weapon:fired/dryFire/reloadStarted/reloadFinished/ammoChanged`, `combat:hit`, `combat:impact`. `ctx.testHooks.weapon = { getAmmo, isReloading, fireOnce }`.
- FR-07 Resources tracked via `ctx.resources.scope('weapon')`; handlers unsubscribed and objects removed on `dispose()`.

## Acceptance criteria

AC1-AC9 as in the ticket; mapped in `plan.md`.

## Assumptions

- Targets apply zone multipliers; the weapon sends base `WEAPON.damage` only.
- `weapon:fired` is emitted for each shot with the spread-perturbed direction; magazine counts are post-shot.
- `weapon:grantAmmo` has no reserve cap (a cap, if any, belongs to pickups).
- The foundation sandbox already provides dummies; no extra fixture is needed.
- Death/respawn resets any in-progress reload.
