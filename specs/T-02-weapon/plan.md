# Implementation Plan: T-02 Weapon

**Spec**: `spec.md` | **Stack**: TypeScript strict, three.js, Vitest. No new dependency.

## Constitution Check
Tunables in config (`WEAPON` + `src/weapon/tunables.ts` for floor/view model numbers); pooled effects via `ObjectPool`; ResourceTracker scope `weapon`; no cross-module imports (events/ctx only); no assets; only owned files touched. PASS.

## Structure (all under `src/weapon/`)
- `WeaponState.ts` (+test): pure ammo/cooldown/reload state machine.
- `recoil.ts` (+test): `SpreadModel` (spread cone), `RecoilKick` (accumulated kick; recovers only its own offset).
- `tunables.ts`: respawn floor, view model offsets, effect lifetimes.
- `viewmodel/ViewModel.ts` interface; `viewmodel/ProceduralViewModel.ts` default (shared materials, few meshes).
- `effects.ts`: `WeaponEffects` with three `ObjectPool`s (tracers, casings, flash).
- `index.ts`: `createWeaponModule` glue.

## Flow
`update()`: latch `wasPressed` fire/reload; view model + effects update. `fixedUpdate()`: build step input from latches + `isDown('fire')`, gate on alive / controlsLocked, `state.step`, then handle results (shot: raycast with spread, damage, events, effects, recoil; reload start/finish; dry fire). Recoil recovery in fixedUpdate.

## AC mapping
AC1/2/5/9: `WeaponState.test.ts`. AC7/9: `recoil.test.ts`. AC3/4/6/8: `tests/e2e/T-02-weapon.e2e.mjs` plus manual `?sandbox` check.
