# Tasks: ADS, auto reload, gravity

- [x] T001 Add `ADS` tunables and new gravity/jump numbers in src/config/tunables.ts
- [x] T002 Add `aim` action, reload = KeyR, bindings migration in src/core/InputManager.ts and src/core/Settings.ts (+ tests)
- [x] T003 Add `autoReload` setting and Settings UI toggle (src/core/Settings.ts, src/ui/screens.ts)
- [x] T004 Add `autoReload` to `WeaponState.step` with tests (src/weapon/WeaponState.ts)
- [x] T005 Add `PlayerState.aimAmount`; player controller: speed, sprint block, sensitivity (src/player)
- [x] T006 Weapon module: aim smoothing, FOV, spread/recoil scaling (src/weapon/index.ts) + pure helper test
- [x] T007 View models: ADS pose for procedural and GLB
- [x] T008 HUD: hide crosshair while aiming; show aim binding label
- [x] T009 Jump height unit test for the new gravity
- [x] T010 Run `npx tsc --noEmit`, `npm test`, `npm run build`; scripted screenshot of ADS (smoke/e2e skipped per owner; verified with scripted hip/aimed screenshots on both rifles)
- [x] T011 Update docs (CLAUDE.md status, PLAN.md Current state, DEVIATIONS.md, specs/README.md)
