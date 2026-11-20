# Tasks: spec 32

## Phase 1: infrastructure (FR-001, FR-002, FR-003)
- [x] T001 Sample manifest, loops, seeded variant/pitch/gain pick (`samples.ts`) + `samples.test.ts`
- [x] T002 Loader with per-file status, timeout and dispose (`sampleBank.ts`); sample voices (`sampleVoice.ts`)
- [x] T003 Engine: sample-first playback with recipe fallback, request `delay`, `setLoop`, ambience loop layer
- [x] T004 Pipeline `tools/asset-pipeline/audio.sh` (trim, normalise, crossfade loops, Vorbis mono 44.1 kHz); 75 files, 1.27 MB

## Phase 2: weapon and impacts (FR-005, FR-006)
- [x] T005 Rifle shot (2 BigSoundBank variants), dry click, reload in three timed parts, shell casing
- [x] T006 Impacts: metal vs concrete from the ray hit (`impactMaterial`), armour hits, quiet metal on robot hits

## Phase 3: player (FR-007, FR-008)
- [x] T007 Footsteps on concrete vs metal (`footstepSurface`: stair, mezzanine, raised surfaces)
- [x] T008 Jump, landing, hurt, death, pickups, hit marker
- [x] T009 Low-health heartbeat and breathing loops (below 35% HP, faster heartbeat); procedural beat fallback

## Phase 4: robots and boss (FR-009)
- [x] T010 Robot alerts, enemy lasers, melee servo (Spot, Biped), samurai sword, drone buzz on alert, robot and duck explosions
- [x] T011 Scorpion steam hiss on telegraphs; boss cannon, stomp, laser, electric strike, laser charge on the quad-laser telegraph, bombs, defeat

## Phase 5: world, UI, ambience (FR-009, FR-010)
- [x] T012 Countdown alarm and beeps, swing-gate sound, warehouse metal creaks
- [x] T013 Wind and sea loops layered on the procedural bed
- [x] T015 Energy wave routed to the samurai crescent wave (`enemy:waveReleased`, spec 31); the boss shockwave no longer plays it
- [ ] T014 skipped: roller door (no event), rain (no weather), per-drone looping buzz (no per-drone audio hook), rocket launch (no BigSoundBank source found), boss telegraph variants and tower hum stay procedural

## Phase 6: tests, credits, docs, verification (FR-004, FR-011)
- [x] T016 Tests: files exist, no orphans, byte budget, fallback recipes, seeded picks, bank, low-health curve, surfaces, materials, routes
- [x] T017 Credits (`credits.ts`, `CREDITS.md` "Sound effects", `docs/ASSETS.md`), DEVIATIONS, SPECKIT, specs/README
- [x] T018 `npx tsc --noEmit && npm test` (655 tests) `&& npm run build` (101 precached entries) pass; coordinator Chromium run (low preset, preview build): 75 of 75 files decoded, no failed requests, no console errors, shot, reload, jump, land, footstep, gate, crescent wave and drone alert produced 13 recorded plays, low-health level 0.76 at 18 HP and 0 at full; smoke/e2e skipped
- [ ] T019 skipped: mix pass on a real device (manifest gains, bus and loop levels, loop seams, footstep and casing loudness) and Safari Ogg decode; there is no audio output in the sandbox (open follow-up in `docs/SPECKIT.md`)
- [ ] T020 skipped: owner decision on amending Principle VI (audio files) in the constitution; spec records the approval, the text is unchanged
