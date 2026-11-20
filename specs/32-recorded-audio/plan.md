# Implementation Plan: recorded sound effects

**Spec**: [spec.md](spec.md)

## Summary
`src/audio/samples.ts` (manifest, loops, `pickSample`, `seededRng`, byte budget), `src/audio/sampleBank.ts` (fetch + decode, status per file, dispose), `src/audio/sampleVoice.ts` (one buffer through the voice gain), `src/audio/rules.ts` (pure: footstep surface, impact material, low-health level, heartbeat rate). `AudioEngine.play` tries a decoded variant first and falls back to the recipe; `setLoop` drives the heartbeat and breathing loops; `Ambience.addLoop` layers the wind and sea loops and lowers the procedural sea/wind. Routes in `eventMap.ts` take an optional env (player feet) and requests carry an optional `delay` (reload parts, casing). `index.ts` runs the low-health layer and the warehouse creaks and adds test hooks. Assets come from `tools/asset-pipeline/audio.sh`.

## Phases
1. Infrastructure (manifest, loader, fallback, pipeline). 2. Weapon and impacts. 3. Player (footsteps by surface, jump, land, hurt, death, low health). 4. Robots and boss. 5. World, UI, ambience. 6. Mix pass on a real device.

## Constitution Check
| Principle | Status |
|---|---|
| I Performance | Samples decode once after unlock (about 1.3 MB of OGG); one buffer source + gain per voice inside the existing voice cap; loop params touched only on change. PASS |
| II Typed contracts | No new events; routes read existing events (`scorpion:telegraph` through its declared augmentation). `SoundRequest` gains an optional `delay`; routes an optional `RouteEnv`. PASS |
| III Tunables | `AUDIO.samples`, `ambienceSamples`, `lowHealth`, `surfaces`, `reload`, `casingDelay`, `creak`; sample gains live in the manifest (sound design data). PASS |
| IV Tests | Manifest/files/budget, fallback recipes, seeded picks, bank with a fake fetch, curve, surfaces, routes; listening by the coordinator. PASS |
| V Blast radius | `src/audio`, `public/assets/audio`, the pipeline script, credits and docs. DECLARED |
| VI Offline / procedural | Same-origin OGG precached by the service worker; every id keeps its procedural recipe. PASS |
| VII Simplicity | One manifest, one loader, no streaming, no per-drone loops. PASS |
