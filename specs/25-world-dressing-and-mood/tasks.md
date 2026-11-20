# Tasks: World dressing, supplies, mood

## Phase 1: placement and assets (US1)
- [x] T001 [FR-001, FR-002, FR-003, FR-007, FR-008] First low-poly vehicle pack (`props.py`) and 11 vehicles with colliders and tests (`layout.ts`, `vehicles.ts`, `vehicles.test.ts`, `vehicleModels.test.ts`)
- [x] T002 [history, no FR] Overturned burning wrecks tried (flame shader, smoke) and removed again at the owner's request
- [x] T004 [FR-001, FR-002, FR-008] `industrial.glb` (`industrial.py`, Poly Haven CC0) and clutter on the apron (`dressing.ts`, `dressing.test.ts`, `dressingModels.test.ts`)
- [x] T005 [FR-002, FR-008] 3DModelsCC0 packs, `terminal.glb` (`terminal.py`), clutter in the court and on the quay
- [x] T010 [FR-001, FR-002] PR #13: vehicles rebuilt from Sketchfab CC-BY models (`vehicles_sf.py`, 12 vehicles incl. the crane truck, 5.5 MB, textured PBR, tint on paint only); tests updated
- [x] T007 [FR-002] Credits for the CC-BY vehicles (`credits.ts`, `CREDITS.md`, `docs/ASSETS.md`)

## Phase 2: supplies (US2)
- [x] T003 [FR-006] Fewer supplies and drops; ammo budget test re-based (`tunables.ts`, `placements.ts`, `damage.test.ts`, `placements.test.ts`). Later changes by other specs: +1 crate (spec 29), two container-top supplies moved to the ground (2026-11-19), budget 356 vs 570

## Phase 3: mood (US3)
- [x] T006 [FR-004] Cold overcast: sky shader uniforms, sun/hemi/fog tunables, desaturating grade (`lighting.ts`, `tunables.ts`, `Renderer.ts`); tuned three times from screenshots

## Phase 4: verification and docs
- [x] T008 [FR-005, SC-001, SC-002] `npx tsc --noEmit`, `npm test` (463 tests then; 655 on 2026-11-20), `npm run build` pass; scripted low-preset screenshots of each dressed area and of the mood, no console errors; smoke/e2e skipped (owner policy)
- [x] T009 Docs: README, `docs/ASSETS.md`, `docs/DEVIATIONS.md`, `docs/PLAN.md`, `CLAUDE.md`, `specs/README.md`
- [ ] T011 skipped: frame rate with ~60 instanced kinds and the mood on medium/high presets (bloom) on a real GPU; no GPU in the sandbox (open follow-up in `docs/SPECKIT.md`)
