# Feature Specification: Procedural audio (T-07)

**Feature Directory**: `specs/T-07-audio`  |  **Input**: `docs/tickets/T-07-audio.md`, GDD 11/14/16, REVIEW #9
**Status**: Implemented

## Summary
Sound for the whole game with no audio files: a small Web Audio synthesis engine (oscillators, noise, envelopes, filters),
a voice allocator, positional playback, master volume and one sound per GDD 11 event group. The module listens to the
event catalogue only and emits nothing.

## User Scenarios
1. **Hear my weapon and movement** (P1): shot, dry click, reload, footsteps, landing, hurt, death, grapple, pickups.
2. **Hear threats** (P1): robot alert/attack/destroyed, Charger wind-up growl lasting the telegraph, charge rumble, wall clang.
3. **Hear the objective** (P1): tower hum rising with progress, cancel blip, activation chord, nuclear alarm, last-10-s beeps,
   expiry blast, and a positional beacon whose rate rises as the player nears the closest inactive tower.
4. **Hear the boss** (P2): spawn horn, telegraph per attack, cannon/slam/missile/EMP, weak-point ping and crunch, core riser, collapse.
5. **Atmosphere** (P2): sea, wind, harbor hum; ducked outside `playing`; one-shots frozen while paused.
6. **Silent fallback** (P1): no gesture / no Web Audio => no sound, no errors.

## Requirements
- **FR-1** All sounds are synthesised; no audio assets, no network requests (AC1).
- **FR-2** One lazily created `AudioContext`, created and resumed on first `pointerdown`/`keydown`; every failure degrades to silence (AC2).
- **FR-3** Sound catalogue `id -> {category, priority, maxInstances, cooldownMs, spatial}`; event -> sound routing table (AC3).
- **FR-4** Voice allocator: cap 24, steal lowest priority/oldest, per-sound cooldown and instance limit (AC6).
- **FR-5** Master gain follows `settings.masterVolume` at once; category buses sfx/ambience/ui; master compressor (AC4).
- **FR-6** World sounds go through an `equalpower` `PannerNode` (inverse, max 120 m), listener follows `ctx.camera`; sounds beyond max distance are skipped (AC5).
- **FR-7** Charger wind-up is a rising low growl whose length equals the event `duration` (AC7).
- **FR-8** Ambience loops fade in on `playing`, duck otherwise; context suspended while `paused` (AC4).
- **FR-9** `dispose()` closes the context and removes listeners, DOM and hooks (AC8).
- **FR-10** `ctx.testHooks.audio = { contextState, activeVoices, playedCount, ... }`; `?audiotest` panel lists every sound id.

## Assumptions (resolved from ticket/PLAN/REVIEW)
- Ambience layers and the tower hum loop are outside the 24-voice cap (fixed, small, counted in `liveNodes()`).
- Enemy movement sounds and machinery near cranes are optional and omitted; harbor hum covers machinery.
- No context is created before a gesture (avoids autoplay warnings); events before it are dropped and not counted.
- `playedCount(id)` counts voices actually started.
- Priority: higher number = more important.

## Success Criteria
AC1-AC8 of the ticket; mapping in `plan.md`.
