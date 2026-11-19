# Specification Quality Checklist: Authored STINGER-7 model

**Created**: 2026-11-19 | **Feature**: [spec.md](../spec.md)

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable (GLB size, triangle count, node names, materials, size and orientation, rig pose and glow are unit tests in `scorpionAssets.test.ts` and `scorpionPose.test.ts`)
- [x] Success criteria are measurable (at most 1.2 MB, about 16k triangles, feet on y = 0, 6.4 x 5.2 x 4.1 m, critical boxes on the head and the cannon)
- [x] Acceptance scenarios defined for each story
- [x] Edge cases recorded (GLB load failure or timeout, `?procedural-scorpion`, mismatch between the brief and the source: four legs, no claws)
- [x] Scope bounded (look and animation only; gameplay, numbers, audio and HUD unchanged)
- [x] Licence recorded (CC-BY 4.0, Mirandanimator, credited in `docs/ASSETS.md`, `src/ui/credits.ts`, README)
