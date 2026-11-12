---

description: "Task list for T-18 weapon asset pipeline"
---

# Tasks: Weapon asset pipeline (G36C view model)

**Input**: `specs/T-18-weapon-asset-pipeline/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Tests**: included (constitution IV: pure logic tested first).

## Phase 1: Setup

- [X] T001 Copy `assets-src/weapons/g36c/v_g36c.mdl` into a scratch dir and dump header/bones/sequences/bodyparts with a throwaway `python3 -I` script to confirm layout (no files committed)
- [X] T002 Create `tools/asset-pipeline/` skeleton and README.md (choice: pure-Python reader plus direct GLB writer, Blender validation only)

## Phase 2: Foundational (conversion pipeline)

- [X] T003 Implement MDL v10 reader (header, bones, textures, bodyparts, meshes, sequences, RLE animation, attachments) in `tools/asset-pipeline/mdl.py` with bounds checks (untrusted input)
- [X] T004 [P] Implement minimal GLB writer (skin, meshes, PNG textures, animations, nodes) in `tools/asset-pipeline/glb.py`
- [X] T005 Implement `tools/asset-pipeline/convert.py` (body selection, axis/unit conversion, texture downscale, material merge to at most 6, clip sampling, report) and `convert.sh`
- [X] T006 [P] Add `tools/asset-pipeline/validate_blender.py` and call it from `convert.sh` when `blender` exists
- [X] T007 Run conversion; write `public/assets/weapons/g36c/g36c.glb`; check size under 4 MB and recovered clips

## Phase 3: User Story 1 - Real rifle in first person (P1)

**Goal**: GLB renders as view model. **Independent test**: screenshot.

- [X] T008 [P] [US1] Write `src/weapon/viewmodel/glbTunables.ts` (framing offset, scale, muzzle fallback)
- [X] T009 [US1] Implement `src/weapon/viewmodel/GlbViewModel.ts` (from parsed glTF scene, basic materials, muzzle/eject nodes, ResourceTracker, dispose)
- [X] T010 [US1] Implement `src/weapon/viewmodel/createViewModel.ts` (query switch, lazy load, swap)

## Phase 4: User Story 2 - Animations (P1)

- [X] T011 [P] [US2] Write failing unit test `src/weapon/viewmodel/glbClips.test.ts` for clip mapping
- [X] T012 [US2] Implement `src/weapon/viewmodel/glbClips.ts` and wire mixer in GlbViewModel (idle loop, draw, reload scaled to duration, shoot round-robin, procedural motion if no clips)

## Phase 5: User Story 3 - Fallback (P1)

- [X] T013 [P] [US3] Write unit test `src/weapon/viewmodel/createViewModel.test.ts` (404 and corrupt data keep procedural, one warning, disposal during load)
- [X] T014 [US3] Make factory pass T013 (single log, discard late result)

## Phase 6: User Story 4 - Provenance and verification (P2)

- [X] T015 [P] [US4] Update `docs/ASSETS.md` (contents, author, permission, decision, animation outcome, credit)
- [X] T016 [US4] Add Node GLB parse test (GLTFLoader on the shipped GLB: clips, bones, draw calls) in `src/weapon/viewmodel/glbAsset.test.ts`
- [X] T017 [US4] Write `tests/e2e/T-18-weapon-asset-pipeline.e2e.mjs` (GLB reachable same origin, fallback on blocked file, screenshot)

## Phase 7: Polish

- [X] T018 Take and inspect view-model screenshot (temporary local wiring of the factory, not committed)
- [X] T019 Run typecheck, test, build, smoke, e2e T-02 and T-18; commit

## Dependencies

Setup, then Foundational, then US1; US2 and US3 depend on T009/T010; US4 after the GLB exists. T004 and T006 parallel to T003/T005.
