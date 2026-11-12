# Feature Specification: HUD, menus and settings (T-06)

**Spec dir**: `specs/T-06-hud-menus` | **Status**: Draft | **Input**: `docs/tickets/T-06-hud-menus.md` (GDD 10, 8, 14, 16; REVIEW #1, #8)

## User Scenarios & Testing

### US1 - See the run state at a glance (P1)
While playing, the player sees HP, ammo (mag/reserve), weapon name, nuclear countdown (mm:ss, red when critical), four tower pips, crosshair, grapple cooldown.
**Test**: emit `player:damaged`, `weapon:ammoChanged`, `countdown:tick`, `tower:activated`; HUD text changes.

### US2 - Navigate to objectives and interact (P1)
A compass strip marker points to the nearest inactive tower (ahead/behind/left/right correct, hidden when all active). Interact prompt and hold-progress bar follow `interact:prompt` / `tower:activationProgress`, clearing on cancel/activation.

### US3 - Combat feedback (P1)
Hit marker flashes on `combat:hit` (distinct colour for critical/weakpoint, grey tick for absorbed); damage-direction indicator; low-HP vignette; toasts.

### US4 - Boss fight HUD (P2)
After `boss:spawned`: name, four weak-point pips with HP, core HP bar locked until `boss:coreExposed`.

### US5 - Menus and flow (P1)
Main Menu (Play, Settings, controls list), Pause (Resume, Settings, Restart, Quit), Game Over (reason; Respawn only for `player-died`; Restart), Victory (time remaining, Restart). Pause on `P` and on pointer-lock loss. Keyboard navigable.

### US6 - Settings (P2)
Mouse sensitivity (0.2-3.0), volume (0-1), quality, FPS cap, key rebinding, reset to defaults; applied immediately, persisted by Settings.

## Requirements
- FR-001 HUD elements of US1-US4 update from events; no console errors.
- FR-002 Pure view-model helpers (time, bearing, ammo, hp ratio, nearest tower) are unit tested.
- FR-003 Screens exist per US5; simulation only runs in `playing`; Play/Resume request pointer lock then set `playing`.
- FR-004 Buttons emit `game:requestRespawn` / `game:requestRestart`.
- FR-005 Settings per US6; rebinding stores `KeyboardEvent.code` / `MouseN` via `ctx.settings.set('bindings')` and updates input.
- FR-006 `ctx.testHooks.ui = { getHudText, isVisible }`.
- FR-007 Event-driven DOM writes; per-frame refresh only for changed HP/compass/timers; no per-frame element creation.
- FR-008 `dispose()` removes all DOM (root, style) and listeners.
- FR-009 CSS only, no external assets; HUD scales with viewport height.

## Success Criteria
- SC-001 All ticket AC1-AC9 hold (unit tests + e2e).
- SC-002 Zero DOM nodes remain after dispose.

## Assumptions
- `P` toggles pause via own keydown listener (Escape releases pointer lock, which pauses); keys read from the current `pause` binding.
- Quality/fpsCap/volume are applied by foundation/other modules reacting to `settings:changed`; the UI only writes them.
- Nearest inactive tower is by horizontal distance.
- Rebinding replaces all codes of the action; other actions keep theirs.
