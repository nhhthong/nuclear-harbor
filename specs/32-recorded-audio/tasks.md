# Tasks: spec 32
## Phase 1: infrastructure
- [x] T001 Sample manifest, loops, seeded variant/pitch/gain pick (`samples.ts`)
- [x] T002 Loader with per-file status, timeout and dispose (`sampleBank.ts`); sample voices (`sampleVoice.ts`)
- [x] T003 Engine: sample-first playback with recipe fallback, request `delay`, `setLoop`, ambience loop layer
- [x] T004 Pipeline `tools/asset-pipeline/audio.sh` (trim, normalise, crossfade loops, Vorbis mono 44.1 kHz)
## Phase 2: weapon and impacts
- [x] T005 Rifle shot (2 BigSoundBank variants), dry click, reload in three timed parts, shell casing
- [x] T006 Impacts: metal vs concrete from the ray hit (`impactMaterial`), armour hits, quiet metal on robot hits
## Phase 3: player
- [x] T007 Footsteps on concrete vs metal (`footstepSurface`: stair, mezzanine, raised surfaces)
- [x] T008 Jump, landing, hurt, death, pickups, hit marker
- [x] T009 Low-health heartbeat and breathing loops (level below 35 % HP, faster heartbeat); procedural beat fallback
## Phase 4: robots and boss
- [x] T010 Robot alerts, enemy lasers, melee servo (Spot, Biped), samurai sword, drone buzz on alert, robot explosions, duck explosion
- [x] T011 Scorpion steam hiss on telegraphs; boss cannon, stomp, laser, electric strike, laser charge on the quad-laser telegraph, bombs, defeat; energy wave on the shockwave
## Phase 5: world, UI, ambience
- [x] T012 Countdown alarm and beeps, swing-gate sound, warehouse metal creaks
- [x] T013 Wind and sea loops layered on the procedural bed
- [ ] T014 Roller door, rain, per-drone looping buzz, rocket launch: skipped (no event, no weather, no per-drone audio hook, no BigSoundBank source)
- [x] T015 Energy wave routed to the samurai crescent wave (`enemy:waveReleased`, emitted when it is released); the boss shockwave no longer plays it
## Tests, credits, docs
- [x] T016 Tests: files exist, no orphans, byte budget, fallback recipes, seeded picks, bank, low-health curve, surfaces, materials, routes
- [x] T017 Credits (credits.ts, CREDITS.md "Sound effects", docs/ASSETS.md), DEVIATIONS, SPECKIT, specs/README
- [x] T018 `npx tsc --noEmit && npm test && npm run build` run and passing. Browser listening, smoke, e2e: skipped (coordinator listens after the merge).
## Phase 6: mix pass
- [ ] T019 Listen on a real device; balance manifest gains, bus and loop levels, footstep and casing loudness

## Coordinator verification (2026-11-20)
- Merge of the audio stream with the main line: conflicts only in docs and the gate route (the recorded gate clank kept); `enemy:waveReleased` added for the samurai crescent.
- `npx tsc --noEmit`, `npm test` (655 passed), `npm run build` (101 precached entries): pass.
- Browser (Chromium, low preset, preview build): all 75 OGG files fetched and decoded (`samples()` = {loading 0, ready 75, failed 0}), no failed requests, no console errors; shot, reload, jump, land, footstep, gate, crescent wave and drone alert events produced sample plays (13 recorded); the low-health level reads 0.76 at 18 HP and 0 at full HP.
- Not verified: how anything sounds (no audio output in the sandbox), loop seams, mix levels (T019), Safari Ogg decoding.

