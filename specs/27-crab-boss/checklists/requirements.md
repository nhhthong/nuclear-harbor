# Specification Quality Checklist: Gunslinger Crab Mech final boss

**Created**: 2026-11-18 | **Analysed**: 2026-11-20 | **Feature**: [spec.md](../spec.md)

- [x] No [NEEDS CLARIFICATION] or TODO markers remain
- [x] Requirements are testable (HP, skill numbers and rules are unit tests in `skills.test.ts`, `BossModel.test.ts`, `crabAssets.test.ts`); each carries a check tag
- [x] Success criteria are measurable (232 hits, 356 vs 570, drone cap 6, beam 180 degrees in 4.5 s, GLB sizes)
- [x] Acceptance scenarios exist for each story
- [x] Edge cases recorded and backed by code or tests (GLB failure, player on the boss, beams behind containers, boss death with drones alive); the earlier claim "respawn mid-skill" was not backed by anything and was removed
- [x] Scope bounded (no new audio at the time, no e2e rewrite, no roster change)
- [x] Licences recorded (two CC-BY 4.0 Sketchfab models: `docs/ASSETS.md`, `src/ui/credits.ts`, `CREDITS.md`)
- [x] Numbers match the code on 2026-11-20 (spin 1.4 m, laser 0.4 to 1.3 m, budget 356 vs 570)
- [ ] FR-004 (drone physics meta), FR-005 disposal, HUD bar, movement band have a test: no, marked in the spec
- [ ] A full fight played from the cinematic to victory: no
- [x] Constitution Check has one row per principle (7); Principle II is JUSTIFIED (phase enum)
