# Feature Specification: Aim down sights, auto reload, heavier gravity

**Feature**: `24-ads-autoreload-gravity` | **Created**: 2026-11-15 | **Status**: Implemented (not playtested on a real GPU)
**Input**: owner request: "right mouse = iron sight (hold), auto reload as a Settings toggle, gravity a bit light: increase it".

## User Scenarios & Testing

### User Story 1 - Hold right mouse to aim (Priority: P1)
While the right mouse button is held the rifle moves to the screen centre, the camera zooms in, the crosshair hides, and shots are more accurate.

**Acceptance**
1. Holding RMB raises `aimAmount` from 0 to 1 in about 0.15 s; releasing returns it to 0.
2. FOV goes from 75 to 55 deg, mouse sensitivity scales with the zoom, walk speed drops to 70%, sprint is not possible while aiming.
3. Spread and camera recoil are halved at full aim.
4. Aim is cancelled while reloading, dead, or when controls are locked (menu, pause, cinematic).

### User Story 2 - Auto reload toggle (Priority: P1)
A Settings checkbox "Auto reload" (default ON). When on, the rifle starts reloading as soon as the magazine empties and reserve ammo exists. `R` always reloads manually.

**Acceptance**
1. ON: last round fired -> reload starts in the same step. OFF: nothing starts until `R` (or pulling the trigger on an empty magazine, existing behaviour).
2. The choice persists in LocalStorage.

### User Story 3 - Heavier gravity (Priority: P2)
Falling and jumping feel less floaty. Jump heights stay the same (ground 3.9 m, air jump +3.3 m); only air time shortens.

## Requirements
- **FR-001** New action `aim`, default `Mouse2`. `reload` default becomes `KeyR` only.
- **FR-002** Saved bindings that still give `Mouse2` to `reload` are migrated (Mouse2 removed from `reload`).
- **FR-003** New setting `autoReload: boolean`, default true, shown in Settings, persisted.
- **FR-004** `PlayerState.aimAmount` (0..1) is written by the weapon module and read by the player controller and the HUD.
- **FR-005** `PLAYER.gravity` = -22; `jumpSpeed` and `airJumpSpeed` re-derived so heights are unchanged.
- **FR-006** All new numbers live in `src/config/tunables.ts` (`ADS`) or the existing `PLAYER`.
- **FR-007** No new events, no new runtime dependency, no allocation per frame.

## Success Criteria
- `npx tsc --noEmit`, unit tests and build pass; new unit tests cover auto reload, bindings migration, ADS smoothing and jump height.
- A scripted screenshot shows the rifle centred while aiming with no console errors (check manually on a real GPU for feel).

## Assumptions
- "Iron sign" means iron sights (ADS). Hold, not toggle (owner).
- Touch/mobile input is out of scope.
- The G36C GLB has no sight geometry guaranteed to align; the ADS pose is tuned by eye and may need adjustment.
