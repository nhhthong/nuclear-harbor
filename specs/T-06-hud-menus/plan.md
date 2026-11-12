# Plan: T-06 HUD, menus, settings

Respects docs/PLAN.md: owns `src/ui/**`, `tests/e2e/T-06-*`, this folder. No foundation edits; no new deps.

## Files
- `src/ui/format.ts` (+ `format.test.ts`): pure helpers `formatCountdown`, `bearingDeg`, `compassX`, `ammoText`, `hpRatio`, `nearestInactive`, `codeLabel`.
- `src/ui/styles.ts`: scoped CSS (class prefix `nh-`), injected once as `<style>`.
- `src/ui/hud.ts`: builds HUD DOM once; event-driven setters with last-text cache; `refresh()` for HP/compass.
- `src/ui/screens.ts`: menu/pause/settings/gameover/victory DOM + rebinding.
- `src/ui/index.ts`: `createUiModule` wiring, state visibility, pause key, pointer lock, testHooks, dispose.
- `tests/e2e/T-06-hud-menus.e2e.mjs`.

## Decisions
- Single disposer list; every listener registered through one helper.
- Compass: yaw>0 turns left, so relative bearing = atan2 of target vs forward/right; right of view is positive. x clamped over a 120 deg strip.
- Damage direction: payload direction is attacker->player; indicator points toward the source (inverted), relative to yaw. One rotating wedge element, fades.
- Toasts: one line element, timer cleared on dispose.
- Settings has Back returning to the caller screen (menu or pause).
