# T-06 — HUD, menus and settings

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 10, 8 (direction hint), 14 (settings persistence), 16; REVIEW #1, #8 |
| Spec dir | `specs/T-06-hud-menus/` |

## Goal

Replace the placeholder overlay with the full DOM UI: in-game HUD (HP, ammo, weapon name, countdown, tower progress, compass marker to the nearest inactive tower, crosshair + hit marker, interact prompt, grapple cooldown, boss bar, damage direction, toasts) and the Main Menu, Pause, Settings, Game Over and Victory screens.

## Files owned (exclusive)

- `src/ui/**` (replace `src/ui/index.ts`; keep `createUiModule` and id `ui`)
- `tests/e2e/T-06-hud-menus.e2e.mjs` (browser check, optional but recommended)
- `specs/T-06-hud-menus/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`; `ctx.uiRoot` (DOM host; add class `interactive` to clickable elements)
- `ctx.state` (`current`, `set`), `ctx.input.requestPointerLock()`, `getBindings()`, `ctx.settings` (`get/set/resetToDefaults`)
- `ctx.player` (`hp`, `maxHp`, `position`, `yaw`) read every frame for HP and compass
- Events in: `game:stateChanged`, `game:over`, `game:victory`, `player:damaged`, `player:healed`, `weapon:ammoChanged`, `weapon:reloadStarted/Finished`, `combat:hit`, `grapple:cooldown/attached/failed`, `tower:registered`, `tower:activationProgress/Cancelled/activated`, `objectives:allActivated`, `countdown:tick/stopped`, `interact:prompt`, `pickup:collected`, `enemy:destroyed`, `boss:spawned`, `boss:weakPointDamaged/Destroyed`, `boss:coreExposed`, `boss:coreDamaged`, `boss:defeated`, `ui:toast`
- `OBJECTIVES`, `BOSS`, `WEAPON` tunables for initial values

## Interfaces provided

- Events out: `game:requestRespawn`, `game:requestRestart`; state transitions `menu/paused → playing`, `playing → paused` (P key), `→ menu`
- Settings screen writing `mouseSensitivity`, `masterVolume`, `quality`, `fpsCap`, and key rebinding through `ctx.settings.set('bindings', ...)`
- `ctx.testHooks.ui = { getHudText(): Record<string, string>, isVisible(screen) }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-06-hud-menus
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-06-hud-menus/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-06-hud-menus/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure view-model helpers with tests (`src/ui/format.ts`): countdown `mm:ss`, compass bearing from player position/yaw to a target (−180..180° and a clamped on-screen x), ammo text, HP bar ratio, nearest inactive tower selection.
2. Structure: one root `<div>` under `ctx.uiRoot` with a scoped stylesheet injected once (`<style>` element owned and removed by the module). No external fonts or images. Sci-fi look with CSS only.
3. HUD (visible in `playing`): HP bar + number, ammo `mag / reserve` + weapon name + reload indicator, countdown (turns red when `critical`), four tower pips (inactive / activating with progress ring / active), compass strip with a marker pointing to the nearest inactive tower (REVIEW #8; hidden once all are active), crosshair, hit marker (flash on `combat:hit`; different colour for `critical`/`weakpoint`, grey "absorbed" tick for armour), interact prompt + hold progress bar, grapple cooldown ring, damage direction indicator from `player:damaged.direction`, low-HP vignette, toast line.
4. Boss HUD (after `boss:spawned`): name, four weak-point pips with HP, core HP bar (locked icon until `boss:coreExposed`).
5. Update strategy: event-driven DOM writes; only HP, compass and timers refresh in `update()` and only when the value changed (cache last text). No layout thrash, no per-frame element creation.
6. Screens: Main Menu (Play, Settings, controls list generated from current bindings), Pause (Resume, Settings, Restart, Quit to menu), Settings, Game Over (reason text from `game:over`; "Respawn at checkpoint" only for `player-died`, plus Restart), Victory (time remaining, Restart). Buttons emit `game:requestRespawn` / `game:requestRestart`; the flow module (T-16) acts on them.
7. Pointer lock: clicking Play/Resume calls `ctx.input.requestPointerLock()` then `ctx.state.set('playing')`. The foundation pauses automatically when the lock is lost; `P` (action `pause`) toggles pause using your own `keydown` listener because `ctx.input` is disabled outside `playing`. With `?autostart`, lock on the first canvas click.
8. Settings: sliders for mouse sensitivity (0.2-3.0) and master volume (0-1), select for quality (low/medium/high) and FPS cap (0/30/60/120), rebinding rows ("press a key or mouse button", stored as `KeyboardEvent.code` / `MouseN`), "Reset to defaults". Persisted by `Settings` automatically.
9. Accessibility basics: menus keyboard-navigable (Tab/Enter/Escape), readable contrast, HUD scales with viewport height (`clamp()`/`vh`).
10. e2e: boot `/`, assert the main menu is visible and the simulation is paused; click Play → state `playing`, HUD visible; emit a few events from the page (`ctx.events.emit('weapon:ammoChanged', ...)`, `countdown:tick`, `tower:activated`, `boss:spawned`) and assert HUD text; open Settings, change quality, reload the page and assert it persisted.

## Acceptance criteria

- [ ] **AC1** The HUD shows player HP, magazine/reserve ammo, weapon name, nuclear countdown as `mm:ss`, and the state of the four towers, all updating from events without console errors.
- [ ] **AC2** A compass marker points to the nearest inactive tower and is correct for targets ahead, behind, left and right (unit test on bearing maths); it disappears when all towers are active.
- [ ] **AC3** A crosshair is always visible while playing; a hit marker flashes on `combat:hit` with distinct feedback for critical and for absorbed hits.
- [ ] **AC4** The interact prompt and hold progress appear from `interact:prompt` / `tower:activationProgress` and clear on cancel/activation.
- [ ] **AC5** During the boss fight the HUD shows the boss name, four weak-point states and the core HP, with the core shown as locked until exposed.
- [ ] **AC6** Main Menu, Pause, Settings, Game Over and Victory screens exist; the simulation only runs in `playing`; Pause appears when pointer lock is lost and on `P`.
- [ ] **AC7** Settings expose mouse sensitivity, volume, graphics quality and FPS cap, apply immediately, persist across reloads, and keys can be rebound (reload on right mouse and R by default).
- [ ] **AC8** Game Over offers "Respawn at checkpoint" (death only) and "Restart" which emit `game:requestRespawn` / `game:requestRestart`.
- [ ] **AC9** No DOM nodes or listeners remain after `dispose()`; HUD updates allocate no elements per frame.

## Notes

You can test every HUD element before the gameplay tickets land by emitting events from the browser console: `__NH__.game.ctx.events.emit(...)`.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-06
# manual: npm run dev → http://localhost:5173/  and  /?sandbox
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
