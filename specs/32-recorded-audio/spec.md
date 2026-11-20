# Feature Specification: Recorded sound effects

**Feature**: `32-recorded-audio` | **Created**: 2026-11-20 | **Status**: Wave 1 implemented and merged (PR #21 with spec 31); the mix pass (T019) and several sounds are open; nothing was listened to
**Input**: owner request 2026-11-20: the synthesised sounds read as placeholders; use recorded CC0 / CC-BY samples, BigSoundBank (CC0) first, total budget 6 MB.
**Process**: built as a separate audio stream on its own branch (spec 31 was written in parallel on the dev branch); the coordinator merged it with the main line (conflicts only in docs and the gate route, the recorded gate clank kept), added `enemy:waveReleased` for the samurai crescent, ran the checks and a Chromium preview-build run. Written with the work, not by running the skills in order. Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (Chromium, low preset, preview build; this proves fetch, decode and that events trigger plays, not how anything sounds), `[N]` not verified.

## What the player hears, and why
Every sound used to be oscillators and filtered noise. The game now plays recorded samples for the rifle, reload, casings, impacts, footsteps, voice, low health, robots, boss, world and ambience. Each sound keeps its procedural recipe as the fallback (file missing, still loading, failed to decode: never silence).

## User Scenarios & Testing

### User Story 1 - Weapon and impacts sound recorded (Priority: P1)
Rifle shot (2 BigSoundBank variants), dry click, reload in three parts timed to the reload duration (mag out at 0.12, mag in 0.75 before the end, bolt 0.3 before the end), shell casing 0.38 s after the shot, bullet impacts on metal vs concrete chosen from the ray hit (ground floors and the perimeter wall are concrete; containers, warehouse steel and props are metal), a quiet metal impact on robot hits.
1. Variants never repeat twice in a row when there is a choice; picks and jitter are deterministic with a seeded rng. [U `src/audio/samples.test.ts`]
2. Material choice from the ray hit. [U `src/audio/rules.test.ts`]
3. Shot and reload produced sample plays. [B]; impacts in the browser [N]

### User Story 2 - The player sounds recorded (Priority: P1)
Footsteps on concrete/asphalt vs metal (stair, mezzanine, anything raised above 0.5 m), jump, landing, hurt, death, pickups, hit marker; low-health heartbeat and breathing loops from 35% HP (full at 10%, heartbeat 1.0 to 1.55x faster, procedural beat as fallback).
1. Surface choice and the low-health curve. [U `rules.test.ts`]
2. Jump, land and footstep events produced sample plays; the low-health level reads 0.76 at 18 HP and 0 at full HP. [B]

### User Story 3 - Robots, boss, world, ambience (Priority: P2)
Robot alerts, enemy lasers, melee servo (Spot, Biped), samurai sword, drone buzz on alert, explosions, scorpion steam hiss on telegraphs, boss cannon / stomp / laser / laser charge (quad-laser telegraph) / electric strike / bombs / defeat, energy wave on the samurai crescent release, countdown alarm and beeps, swing gates, random warehouse metal creaks (every 9 to 22 s), wind and sea loops layered on the procedural bed (procedural share 35%).
1. Routes from events to sound ids (including the optional player-feet environment and request `delay`). [U `samples.test.ts`, `src/audio/eventMap.test.ts`]
2. Gate, crescent wave and drone alert events produced sample plays (13 recorded plays in the run). [B]
3. How any of it sounds, loop seams, mix levels. [N]

## Requirements
- **FR-001** Sample layer in `src/audio`: manifest (`samples.ts`: sound id -> variants, gain, pitch and gain jitter, optional offset, loops), loader (`sampleBank.ts`: same-origin relative URLs, per-file status, 15 s timeout, dispose), playback through the existing voice allocator, panner and buses (`sampleVoice.ts`). [U `samples.test.ts` (manifest, picks, fake-fetch bank); B `samples()` = {loading 0, ready 75, failed 0}]
- **FR-002** Fallback: while a sample is loading, missing or failed the recipe plays; every manifest id is a catalogue id with a recipe; everything disposed with the module. [U `samples.test.ts` "only maps catalogue ids, each with a recipe", bank tests; failure in a browser N]
- **FR-003** Pipeline `tools/asset-pipeline/audio.sh`: mono Ogg Vorbis 44.1 kHz, trimmed, peak-normalised, crossfaded loops; header lists every source, author, licence, URL. 75 files, **1,268,320 bytes (1.27 MB)**; the unit test caps the folder at 3 MB (`AUDIO_BYTES_BUDGET`), the owner allows 6 MB. [U files exist, no orphans, byte budget; B all decode]
- **FR-004** Sources: BigSoundBank (Joseph SARDIN, CC0) first (owner decision); OpenGameArt CC0 / CC-BY 3.0 for the rest; no CC-BY-SA, NC or ND; Freesound is not reachable from the sandbox. Credits in `src/ui/credits.ts`, `CREDITS.md` ("Sound effects"), `docs/ASSETS.md`. [review; credits test `src/ui/credits.test.ts`]
- **FR-005** Weapon sounds (User Story 1, shot, dry, reload, casing). [U, B]
- **FR-006** Impact materials (User Story 1). [U; B N]
- **FR-007** Player sounds (User Story 2). [U, B]
- **FR-008** Low-health layer (`AUDIO.lowHealth`: start 0.35, full 0.1, rate 1 to 1.55). [U, B]
- **FR-009** Robot, boss and energy-wave sounds (User Story 3); the energy wave plays on `enemy:waveReleased` (spec 31), no longer on the boss shockwave. [U routes; B drone alert, crescent]
- **FR-010** World, UI and ambience sounds (User Story 3). [U routes; B gate]
- **FR-011** Offline: files in `public/assets/audio/`, precached by the service worker (75 audio entries in `sw.js`, 101 precache entries in all on 2026-11-20); nothing loads from the network. [build output; B no failed requests]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (655 tests, 101 precached entries). [run 2026-11-20: pass]
- **SC-002** Browser run: 75 of 75 files fetched and decoded, no failed requests, no console errors, event-driven plays recorded. [B, done 2026-11-20]
- **SC-003** Mix is balanced on a real device. [N, T019 open]

## Assumptions
- Constitution Principle VI says audio files are forbidden without maintainer approval. The owner (maintainer) requested this feature and set the budget; this spec records that as the approval. The constitution text itself is not amended (open owner decision, version 2.1.0 proposed in the analysis).
- The tower hum and the boss telegraphs stay procedural (they follow progress and attack variants).
- Out of scope, no source or hook yet: roller door (no event), rain (no weather), rocket launch (no BigSoundBank page found), looping per-drone buzz (no per-drone audio hook), boss telegraph variants.
- Not verified: anything heard (no audio output in the sandbox), loop seams, mix levels, Safari Ogg decoding, impact sounds in the browser, frame rate impact, smoke/e2e (skipped).
