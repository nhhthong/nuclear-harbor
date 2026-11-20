# Implementation Plan: recorded sound effects

**Spec**: [spec.md](spec.md) | **Branch**: separate audio stream merged with the dev branch `claude/wizardly-cori-697x6r`; squashed into `main` as PR #21 (`93f873e`) with spec 31

## Summary
`src/audio/samples.ts` (manifest, loops, `pickSample`, `seededRng`, byte budget), `src/audio/sampleBank.ts` (fetch + decode, status per file, dispose), `src/audio/sampleVoice.ts` (one buffer through the voice gain), `src/audio/rules.ts` (pure: footstep surface, impact material, low-health level, heartbeat rate). `AudioEngine.play` tries a decoded variant first and falls back to the recipe; `setLoop` drives the heartbeat and breathing loops; `Ambience.addLoop` layers wind and sea and lowers the procedural sea/wind to 35%. Routes in `eventMap.ts` take an optional env (player feet) and requests carry an optional `delay` (reload parts, casing). `index.ts` runs the low-health layer and the warehouse creaks and adds test hooks (`ctx.testHooks.audio`: `play(id)`, `samples()`, `samplePlays()`, `sampleReady(file)`, `lowHealthLevel()`). Assets come from `tools/asset-pipeline/audio.sh`.

## Phases
1. Infrastructure (manifest, loader, fallback, pipeline). 2. Weapon and impacts. 3. Player (footsteps by surface, jump, land, hurt, death, low health). 4. Robots and boss. 5. World, UI, ambience. 6. Mix pass on a real device (open).

## Technical Context
TypeScript strict, Web Audio API, Vitest, ffmpeg-based shell pipeline. Files: `src/audio/{AudioEngine,ambience,catalogue,eventMap,index,samples,sampleBank,sampleVoice,rules,tunables}.ts`, `public/assets/audio/*.ogg` (75), `tools/asset-pipeline/audio.sh`, `src/core/events.ts` (`enemy:waveReleased`), credits and docs. Tests: `samples.test.ts`, `rules.test.ts`, `eventMap.test.ts`, `sounds.test.ts`, `voiceAllocator.test.ts`.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Samples decode once after the unlock gesture (1.27 MB of OGG); one buffer source + gain per voice inside the existing voice cap (24); loop params touched only on change. Decode time and memory on a real device not measured. PASS (unverified on device) |
| II Typed contracts | One new event `enemy:waveReleased` (shared `core/events.ts`, emitted by the samurai, additive); `scorpion:telegraph` is read through its declared augmentation; `SoundRequest` gains an optional `delay`, routes an optional `RouteEnv`. The earlier plan said "No new events" (wrong). PASS |
| III Tunables | `AUDIO.samples`, `ambienceSamples`, `lowHealth`, `surfaces`, `reload`, `casingDelay`, `creak` in `src/audio/tunables.ts`. Per-sample gains and jitter live in the manifest as sound-design data: JUSTIFIED. |
| IV Tests | Manifest/files/orphans/budget, fallback recipes, seeded picks, bank with a fake fetch, low-health curve, surfaces, materials, routes unit-tested; a Chromium run proves fetch, decode and event-driven plays. Listening, loop seams, mix, Safari decode, impact sounds in a browser: not done. Smoke/e2e skipped. |
| V Blast radius | `src/audio`, `public/assets/audio`, the pipeline script, credits and docs, one additive event in `core/events.ts`. DECLARED |
| VI Offline / procedural | JUSTIFIED, and flagged to the owner: Principle VI says "Audio files remain forbidden without maintainer approval". The owner (maintainer) requested this feature and set the 6 MB budget (recorded as approval in the spec); the constitution text is not amended yet. Same-origin OGG precached by the service worker; every id keeps its procedural recipe; no runtime network. |
| VII Simplicity | One manifest, one loader, no streaming, no per-drone loops. PASS |

## Design decisions
- OGG Vorbis mono 44.1 kHz (smallest that fits the 6 MB budget; Safari decode of Ogg Vorbis is unverified, the procedural recipe is the fallback).
- Variant pick avoids an immediate repeat; pitch and gain jitter; seeded rng in tests.
- Surface and material rules are pure and take the ray hit or the player's feet, so they are testable without Web Audio.
- Spec 31 integration: the energy wave plays on `enemy:waveReleased`; the boss shockwave no longer plays it.

## Complexity Tracking
| Item | Why | Simpler option rejected |
|---|---|---|
| Sample layer on top of the procedural engine | Recorded sounds with a never-silent fallback | Replacing the recipes outright would lose the fallback while loading |
