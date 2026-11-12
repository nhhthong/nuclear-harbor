# Implementation Plan: Procedural audio (T-07)

**Spec**: `spec.md`  |  Owns `src/audio/**`, `tests/e2e/T-07-audio.e2e.mjs`, `specs/T-07-audio/**`

## Technical Context
TypeScript strict, Web Audio API only, no new dependencies. Pure logic in Node-testable files; engine/browser code covered by e2e.

## Constitution Check
I perf: bounded voice cap, shared noise buffer, nodes disconnected on `ended`, no per-frame allocation in `update` (scratch vectors).
II: only `GameContext`/events, no cross-module imports. III: numbers in `src/audio/tunables.ts` (synthesis constants stay inside sound recipes).
IV: unit tests for allocator, math, catalogue, routing, sound recipes (recording synth); e2e for runtime. V: foundation untouched, no requests needed.
VI: procedural, offline, no assets. VII: simplest form. **No violations.**

## Structure (`src/audio/`)
| File | Role |
|---|---|
| `tunables.ts` | cap, distance model, bus levels, beacon timings, ducking |
| `catalogue.ts` | `SoundId`, `SOUND_DEFS` |
| `voiceAllocator.ts` | pure allocator (cap, steal, cooldown, instances) |
| `math.ts` | `distanceGain`, `beaconInterval` |
| `eventMap.ts` | `EVENT_ROUTES`: event payload -> `SoundRequest[]` |
| `synth.ts` | `Synth` interface, `VoiceBuilder` (osc/noise/envelope/filter), noise buffer |
| `sounds.ts` | one recipe per sound id `(synth) => stopTime` |
| `ambience.ts` | looping sea/wind/hum beds |
| `AudioEngine.ts` | context, buses, panner, listener, voices, hum loop |
| `index.ts` | module: gestures, event wiring, beacon, ducking, hooks, `?audiotest` |

## Decisions
- Context created on first gesture; paused => `suspend()`, playing => `resume()`.
- Steal kills voice with a 15 ms fade; cleanup is idempotent and independent of `ended` (context may be stalled).
- Beacon: nearest inactive tower from `tower:registered`/`tower:activated`; interval from `beaconInterval(distance)`.

## AC mapping
AC1 build check + e2e request log; AC2 e2e (no gesture); AC3 catalogue/routing tests + `?audiotest`; AC4 e2e hooks;
AC5 `distanceGain` test + panner; AC6 allocator test + e2e 200 emits; AC7 recipe test; AC8 e2e dispose.
