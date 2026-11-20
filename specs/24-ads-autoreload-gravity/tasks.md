# Tasks: ADS, auto reload, gravity

## Phase 1: config and pure logic (test-first where pure)
- [x] T001 [FR-005, FR-006] `ADS` tunables and gravity/jump numbers in `src/config/tunables.ts`
- [x] T002 [FR-001, FR-002] `aim` action, `reload` = KeyR, bindings migration (`InputManager.ts`, `Settings.ts`) + `Settings.test.ts`
- [x] T003 [FR-003] `autoReload` setting and Settings checkbox (`Settings.ts`, `ui/screens.ts`)
- [x] T004 [FR-003] `autoReload` in `WeaponState.step` + tests (`WeaponState.test.ts`)
- [x] T005 [FR-004, FR-008] `PlayerState.aimAmount`; player controller speed, sprint block, sensitivity
- [x] T006 [FR-004, FR-008] `src/core/ads.ts` helpers + `ads.test.ts`; weapon module: aim smoothing, FOV, spread/recoil scaling (`src/weapon/index.ts`)
- [x] T009 [FR-005] Jump height test (`ads.test.ts`); later rewritten for the natural jump (2026-11-19)

## Phase 2: presentation
- [x] T007 [FR-004] View models: ADS pose for the procedural rifle and the G36C GLB (tuned by eye)
- [x] T008 [FR-009] HUD: crosshair fades out while aiming; aim binding label in the controls help

## Phase 3: verification and docs
- [x] T010 [FR-007, SC-001, SC-002] `npx tsc --noEmit`, `npm test` (450 tests then; 655 on 2026-11-20), `npm run build` pass; scripted hip/aimed screenshots on both rifles, no console errors. Smoke/e2e: skipped (owner policy, e2e stale)
- [x] T011 Docs: CLAUDE.md status, PLAN.md Current state, DEVIATIONS.md, specs/README.md
- [ ] T012 skipped: browser check of the Settings "Auto reload" checkbox and of ADS while moving or reloading; no one did it, no GPU or manual playtest yet (open follow-up in `docs/SPECKIT.md`)
