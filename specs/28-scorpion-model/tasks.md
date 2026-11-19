# Tasks: Authored STINGER-7 model

- [x] T001 Download the source, render it, find out what it is (four legs, no pincers, curled tail with a cannon)
- [x] T002 `tools/asset-pipeline/scorpion_sf.py` -> `public/assets/enemies/scorpion.glb` (islands split into body, 4 legs, 4 chained tail segments; decimated; gunmetal + green glow material; empties); Blender renders checked
- [x] T003 `scorpionAssets.ts` loader with validation and fallback (+ tests)
- [x] T004 `scorpionPose.ts` pure joint maths (+ tests)
- [x] T005 `ScorpionSkin.ts` rig; `ScorpionAssets` wrapper with colliders and `makeRig` in `ScorpionModel.ts`; `Scorpion.ts` uses them
- [x] T006 `index.ts`: async load, no spawn before a look is ready (5 s at most), `?procedural-scorpion`, `testHooks.scorpion.model()`
- [x] T007 Screenshots (low preset) of rest, walk, charge, venom telegraph, tail slam, shield; tune pose and glow from them
- [x] T008 Credits (`credits.ts`), `docs/ASSETS.md`, `docs/DEVIATIONS.md`, README, `specs/README.md`, CLAUDE.md status
- [x] T009 `npx tsc --noEmit`, `npm test`, `npm run build`; smoke/e2e skipped per owner policy
