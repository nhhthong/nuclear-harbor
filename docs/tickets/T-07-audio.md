# T-07 — Procedural audio (Web Audio synthesis)

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 11, 14 (offline), 16; REVIEW #9 |
| Spec dir | `specs/T-07-audio/` |

## Goal

Give the game sound without any audio files: a small Web Audio synthesis engine (oscillators, noise, envelopes, filters) with a voice limit, positional playback, master volume, and a sound for every event group in GDD 11: environment, machinery, player, enemies, objective, boss.

## Files owned (exclusive)

- `src/audio/**` (replace `src/audio/index.ts`; keep `createAudioModule` and id `audio`)
- `tests/e2e/T-07-audio.e2e.mjs` (browser check, optional but recommended)
- `specs/T-07-audio/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ctx.settings.get('masterVolume')` + `settings:changed`; `ctx.camera` (listener pose); `ctx.player.position`
- Events in (all read-only): `game:stateChanged`, `weapon:fired/dryFire/reloadStarted/reloadFinished`, `combat:hit/impact`, `player:damaged/died/footstep/landed/healed`, `grapple:fired/attached/released/failed`, `enemy:alerted/attacked/destroyed`, `charger:windup/chargeStarted/stunned/hitPlayer`, `tower:registered/activationStarted/activationProgress/activationCancelled/activated`, `objectives:allActivated`, `countdown:tick/expired`, `pickup:collected`, `boss:spawned/attackTelegraph/attack/weakPointDamaged/weakPointDestroyed/coreExposed/defeated`, `game:over/victory`

## Interfaces provided

- Audible feedback for the events above; no events emitted
- `ctx.testHooks.audio = { contextState(), activeVoices(), playedCount(id) }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-07-audio
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-07-audio/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-07-audio/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure parts with tests: the sound catalogue (`id → { category, priority, maxInstances, cooldownMs, spatial }`), the event → sound mapping table, a voice allocator (cap ~24 voices; steals the lowest-priority/oldest voice; per-sound rate limit so 8 shots/s do not stack unbounded), distance attenuation helper, and the tower beacon interval as a function of distance.
2. Engine: lazily create one `AudioContext`; resume it on the first user gesture (`pointerdown`/`keydown`) and never throw when audio is unavailable (headless, autoplay policy): the module must degrade to silence. Master `GainNode` ← `masterVolume`; category buses (sfx, ambience, ui); a soft compressor/limiter on the master.
3. Synthesis helpers: one-shot builder taking oscillator type/frequency sweep, noise burst (shared pre-rendered white-noise `AudioBuffer`), ADSR envelope, biquad filter sweep. Each sound is a small function `(engine, time, destination) => stopTime`. Nodes are disconnected on `ended`.
4. Spatial: sounds with a world position go through a `PannerNode` (HRTF off, `equalpower`, inverse distance, max distance ~120 m); update the `AudioListener` from `ctx.camera` in `update()`.
5. Player: rifle shot (noise crack + low thump, slight random pitch), dry click, reload (two clicks timed to `duration`), footsteps (walk/sprint), landing thud, hurt, death, grapple fire (whoosh), attach (metal clank), release, fail (dull click), pickup chimes (ammo/medkit different).
6. Enemies: sphere alert chirp, enemy shot (laser zap), destroyed explosion (noise + sub drop); Charger wind-up growl rising over `duration` (GDD 11: "roar/warning before charging"), charge rumble, wall impact clang, player hit.
7. Objective: tower activation hum that rises with `activationProgress`, cancel blip, activated chord, nuclear alarm (two-tone siren) when the countdown is critical, final 10 s beeps, expiry blast; a quiet positional beacon ping from the nearest inactive tower whose rate increases as the player gets closer (supports GDD 8 direction hint).
8. Boss: spawn horn, telegraph cue per attack type, cannon blast, slam impact, missile launch + explosion, weak-point hit ping, weak-point destroyed crunch, core exposed riser, defeat sequence.
9. Ambience (loops built from filtered noise + slow LFOs): sea wash, wind, distant harbor hum; machinery hum near cranes is optional. Fade ambience in on `playing` and down in menus/pause; suspend one-shots while paused.
10. e2e: boot `?sandbox&autostart`, dispatch a click (gesture), emit `weapon:fired` and others from the page, assert `playedCount` increments, `activeVoices` never exceeds the cap after 200 rapid emits, and there are no console errors when `AudioContext` is suspended.

## Acceptance criteria

- [ ] **AC1** No audio file is loaded: every sound is synthesised with the Web Audio API and the build contains no audio assets or network requests.
- [ ] **AC2** The module is silent but error-free when the `AudioContext` cannot start (no user gesture, headless); audio starts after the first user gesture.
- [ ] **AC3** Each GDD 11 group is audible: environment ambience, player (shot, reload, grapple, footsteps, hurt), enemies (alert, attack, destroyed, Charger wind-up/impact), objective (activation, alarm), boss (spawn, each mandatory attack, damage, collapse).
- [ ] **AC4** Master volume follows the setting immediately; ambience ducks outside `playing`.
- [ ] **AC5** World sounds are positional relative to the camera and attenuate with distance.
- [ ] **AC6** Active voices never exceed the configured cap; rapid fire for 10 s does not grow node counts (voice allocator unit test + e2e).
- [ ] **AC7** The Charger wind-up sound lasts the telegraph duration and is clearly distinguishable from other enemy sounds.
- [ ] **AC8** `dispose()` closes the `AudioContext` and removes listeners.

## Notes

Until the other tickets merge, drive sounds by emitting events from the console or from a temporary `?audiotest` panel inside your module (cycle through all sound ids).

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-07
# manual: npm run dev → http://localhost:5173/?sandbox  then in the console: __NH__.game.ctx.events.emit('weapon:fired', {...})
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
