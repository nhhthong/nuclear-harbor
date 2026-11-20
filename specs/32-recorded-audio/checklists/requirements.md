# Requirements checklist: spec 32

**Created**: 2026-11-20 | **Analysed**: 2026-11-20 | **Feature**: [spec.md](../spec.md)

- [x] Owner request and process recorded (recorded sounds, BigSoundBank first, 6 MB budget)
- [x] No [NEEDS CLARIFICATION] or TODO markers remain; status states what is open (T019) and that nothing was listened to
- [x] Requirements FR-001..011 carry check tags; scenarios in the template structure
- [x] Testable acceptance (manifest files exist, budget, fallback recipes, deterministic picks, low-health curve, surface and material choice, routes)
- [x] Numbers in tunables (`AUDIO.samples`, `lowHealth`, `surfaces`, `reload`, `casingDelay`, `creak` in `src/audio/tunables.ts`) and match the spec; 75 files, 1.27 MB, test cap 3 MB, owner cap 6 MB
- [x] Third-party assets CC0 / CC-BY only, credited (`credits.ts`, `CREDITS.md`, `docs/ASSETS.md`)
- [x] Offline: same-origin files in `public/`, precached by the service worker (75 entries)
- [x] Stale statements removed ("spec 31 is on another branch", "no new events", boss shockwave plays the energy wave)
- [ ] Anything audibly verified (levels, loop seams, mix, Safari Ogg): no
- [ ] Impact sounds checked in a browser: no
- [ ] Constitution Principle VI amended for audio files: no, owner decision
- [x] Constitution Check has one row per principle (7)
