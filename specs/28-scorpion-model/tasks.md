# Tasks: Authored STINGER-7 model

## Phase 1: asset (FR-001, FR-002)
- [x] T001 Download the source, render it, find out what it is (four legs, no pincers, curled tail with a cannon)
- [x] T002 `tools/asset-pipeline/scorpion_sf.py` -> `public/assets/enemies/scorpion.glb` (islands split into body, 4 legs, 4 chained tail segments; decimated; gunmetal + green glow material; empties); Blender renders checked

## Phase 2: pure logic and loader, test-first (FR-003, FR-004, FR-005)
- [x] T003 `scorpionAssets.ts` loader with validation and fallback + `scorpionAssets.test.ts`
- [x] T004 `scorpionPose.ts` pure joint maths + `scorpionPose.test.ts`

## Phase 3: rig and wiring (US1, US2, US3)
- [x] T005 [FR-003, FR-004, FR-007] `ScorpionSkin.ts` rig; `ScorpionAssets` wrapper with colliders and `makeRig` in `ScorpionModel.ts`; `Scorpion.ts` uses them
- [x] T006 [FR-005] `index.ts`: async load, no spawn before a look is ready (5 s at most), `?procedural-scorpion`, `testHooks.scorpion.model()`
- [x] T007 [SC-003] Screenshots (low preset) of rest, walk, charge, venom telegraph, tail slam, shield; pose and glow tuned from them (walk seen only mid-charge)

## Phase 4: docs and verification
- [x] T008 [FR-006] Credits (`credits.ts`, `CREDITS.md`), `docs/ASSETS.md`, `docs/DEVIATIONS.md`, README, `specs/README.md`, CLAUDE.md status
- [x] T009 [FR-008, SC-001, SC-002] `npx tsc --noEmit`, `npm test`, `npm run build` pass (re-run 2026-11-20: 655 tests); smoke/e2e skipped (owner policy)
- [ ] T010 skipped: `?colliders` view of the new hit boxes, glow with bloom on medium/high, a plain-chase walk screenshot, real-GPU frame rate (open follow-up in `docs/SPECKIT.md`)
