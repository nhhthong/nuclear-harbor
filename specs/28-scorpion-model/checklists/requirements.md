# Specification Quality Checklist: Authored STINGER-7 model

**Created**: 2026-11-19 | **Analysed**: 2026-11-20 | **Feature**: [spec.md](../spec.md)

- [x] No [NEEDS CLARIFICATION] or TODO markers remain
- [x] Requirements are testable (GLB size, triangles, node names, materials, orientation, rig pose and glow are unit tests in `scorpionAssets.test.ts` and `scorpionPose.test.ts`); each carries a check tag
- [x] Success criteria are measurable (0.71 MB, 15.6k triangles, feet on y = 0, 6.4 x 5.2 x 4.1 m, critical boxes on head and cannon)
- [x] Acceptance scenarios exist for each story
- [x] Edge cases recorded (GLB load failure or timeout, `?procedural-scorpion`, brief vs source: four legs, no claws)
- [x] Scope bounded (look and animation only)
- [x] Licence recorded (CC-BY 4.0, Mirandanimator: `docs/ASSETS.md`, `src/ui/credits.ts`, `CREDITS.md`, README)
- [x] Numbers match the code on 2026-11-20 (the earlier "about 16k" is now 15.6k, 0.71 MB)
- [ ] FR-008 (gameplay unchanged), the 5 s timeout and the `?colliders` view have a test or browser check: no, marked in the spec
- [x] Constitution Check has one row per principle (7); Principle III row is JUSTIFIED (named constants, not tunables)
