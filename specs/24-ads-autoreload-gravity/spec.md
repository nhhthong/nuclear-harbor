# Feature Specification: Aim down sights, auto reload, heavier gravity

**Feature**: `24-ads-autoreload-gravity` | **Created**: 2026-11-15 | **Status**: Implemented and merged (PR #11, with spec 25); not played on a real GPU
**Input**: owner request: "right mouse = iron sight (hold), auto reload as a Settings toggle, gravity a bit light: increase it".
**Process**: written by the coordinator together with the implementation on the dev branch `claude/wizardly-cori-697x6r` (one agent, no sub-agents), not by running the skills in order. Rewritten to match the shipped code in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, scripted), `[N]` not verified.

## User Scenarios & Testing

### User Story 1 - Hold right mouse to aim (Priority: P1)
While the aim button is held the rifle moves to the screen centre, the camera zooms in, the crosshair fades out and shots are more accurate.

**Acceptance**
1. Holding the button moves `aimAmount` 0 -> 1 with `ADS.response` 14 (95% after about 0.2 s); releasing returns it to 0. [U `src/core/ads.test.ts`]
2. FOV 75 -> 55 deg and mouse sensitivity scaled by tan(fov/2) ratio. [U `ads.test.ts`] Walk speed x0.7 and no sprint while aiming. [N: no unit test; the player controller applies `ADS.moveSpeedScale`]
3. Spread and camera recoil x0.5 at full aim. [U the blend `aimScale` in `ads.test.ts`; its use in `src/weapon/index.ts` is [N]]
4. Aim is cancelled while reloading, dead or when controls are locked (menu, pause, cinematic). [N: logic is in `src/weapon/index.ts` (`wantAim`), no test]
5. Hip and aimed screenshots of the G36C GLB and of the procedural rifle: rifle centred, crosshair hidden, no console errors. [B]

### User Story 2 - Auto reload toggle (Priority: P1)
Settings checkbox "Auto reload", default ON. When on, the rifle starts reloading as soon as the magazine empties and reserve ammo exists. `R` always reloads.

**Acceptance**
1. ON: reload starts in the step the last round is fired; OFF: nothing starts until `R` or a trigger pull on the empty magazine. [U `src/weapon/WeaponState.test.ts` "auto reload"]
2. The choice persists (LocalStorage), default on. [U `src/core/Settings.test.ts`] The checkbox in the Settings screen itself was not exercised in a browser. [N]

### User Story 3 - Heavier gravity (Priority: P2)
Falling and jumping feel less floaty.

**As built (history, three steps)**: `PLAYER.gravity` -15 -> -22 (this spec, heights kept) -> -30 (spec 25 commit, heights kept: ground jump 3.9 m, air jump +3.3 m) -> jump speeds lowered at owner request to a natural jump (2026-11-19, commit `2d85cdd`; `docs/DEVIATIONS.md` "Natural jump height"). **Current**: gravity -30, `jumpSpeed` 7.55, `airJumpSpeed` 7.15, so ground jump 0.95 m, air jump +0.85 m, chained at the apex 1.8 m. [U `ads.test.ts` "natural jump heights" and "dodge thresholds reachable"]

## Requirements
- **FR-001** Action `aim`, default `Mouse2`; `reload` default `KeyR` only. [U: default not asserted directly; covered by the migration test only] 
- **FR-002** Saved bindings that give `Mouse2` to `reload` are migrated (Mouse2 removed; default restored if nothing is left). [U `Settings.test.ts`]
- **FR-003** Setting `autoReload: boolean`, default true, in Settings, persisted. [U `Settings.test.ts`, `WeaponState.test.ts`; UI toggle [N]]
- **FR-004** `PlayerState.aimAmount` (0..1) is written by the weapon module (`stepAim` in `src/core/ads.ts`) and read by the player controller, the view models and the HUD. [U helpers; [B] screenshots]
- **FR-005** Gravity and jump numbers as in User Story 3 (current values). [U `ads.test.ts`]
- **FR-006** ADS numbers live in `ADS` (`src/config/tunables.ts`: fovDeg 55, response 14, moveSpeedScale 0.7, spreadScale 0.5, recoilScale 0.5, sprintBlockAbove 0.1); the rifle ADS poses are in `WEAPON_LOCAL.viewModel.ads` and `GLB_VIEW.ads` (tuned by eye). [review, no test]
- **FR-007** No new events, no new runtime dependency, no per-frame allocation. [review, no test]
- **FR-008** Aim target = button held and alive and controls free and not reloading; aim and sprint are mutually exclusive. [N]
- **FR-009** Crosshair opacity = 1 - `aimAmount`. [B]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (450 tests when this shipped; 655 now). [run 2026-11-20: pass]
- **SC-002** Scripted hip/aimed screenshots on both rifles, no console errors. [B, done; feel on a real GPU [N]]

## Assumptions
- "Iron sign" means iron sights (ADS); hold, not toggle (owner). No scope overlay. Touch input is out of scope.
- The G36C GLB has no sight geometry guaranteed to align; the ADS pose is tuned by eye; ADS while moving or reloading was not checked. [N]
- Smoke and e2e are skipped (owner policy; the e2e scripts are stale).
