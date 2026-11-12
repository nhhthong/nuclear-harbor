# Implementation Plan: Weapon asset pipeline (G36C view model)

**Branch**: `T-18-weapon-asset-pipeline` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/T-18-weapon-asset-pipeline/spec.md`

## Summary

A pure-Python MDL v10 reader (`tools/asset-pipeline/mdl.py`) parses bones, body parts, tri-strips/fans, 8-bit textures and RLE animation, and a GLB writer (`glb.py`) emits a skinned glTF with embedded PNG textures to `public/assets/weapons/g36c/`. `convert.sh` runs it offline and optionally validates the GLB by importing it into headless Blender. At runtime `GlbViewModel` (in `src/weapon/viewmodel/`) is built from a GLB loaded with three's bundled `GLTFLoader`, plays clips mapped to fire/reload/draw/idle; `createViewModel` returns the procedural model immediately and swaps in the GLB model only after a successful load.

## Technical Context

**Language/Version**: TypeScript 6 strict (runtime); Python 3 stdlib only (tooling, run with `-I`)

**Primary Dependencies**: three (`GLTFLoader`, `SkeletonUtils` from `three/examples/jsm`, already bundled); no new runtime dependency. Blender 4.0.2 optional, validation only.

**Storage**: static files under `public/assets/weapons/g36c/`

**Testing**: Vitest (clip mapping, fallback factory, GLB parse in Node), Playwright e2e `tests/e2e/T-18-weapon-asset-pipeline.e2e.mjs`, manual screenshot

**Target Platform**: desktop browser, offline after first load

**Project Type**: single web project plus offline tooling

**Performance Goals**: model at most 6 draw calls, no per-frame allocation

**Constraints**: same-origin requests only, GLB under 4 MB, edits limited to ticket-owned files

**Scale/Scope**: one weapon, 6 clips, 46 bones

## Constitution Check

| Principle | Status |
|---|---|
| I Performance | PASS: at most 6 draw calls (materials merged), one mixer, scratch objects in update, resources owned by a `ResourceTracker` scope and released in dispose |
| II Typed contracts | PASS: implements `ViewModel`; no cross-feature imports; no `any` |
| III Tunables | PASS: framing offset/scale/clip speeds in `src/weapon/viewmodel/glbTunables.ts` (feature-local) |
| IV Test pure logic | PASS: clip mapping and fallback factory are testable without a browser; e2e plus screenshot for rendering |
| V Ownership | PASS with one foundation request: `src/weapon/index.ts` must call `createViewModel` (see `foundation-requests.md`); not edited here |
| VI Offline / assets | EXCEPTION, see Complexity Tracking: binary asset committed on explicit ticket update; no network; procedural stays default |
| VII Simplicity | PASS: direct GLB writer, no Blender at runtime or in the conversion path |

Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/T-18-weapon-asset-pipeline/
├── spec.md, checklists/requirements.md
├── plan.md, research.md, data-model.md, quickstart.md, contracts/
├── foundation-requests.md
└── tasks.md
```

### Source Code (repository root)

```text
tools/asset-pipeline/        mdl.py glb.py convert.py convert.sh validate_blender.py README.md
public/assets/weapons/g36c/  g36c.glb
src/weapon/viewmodel/        GlbViewModel.ts glbClips.ts glbTunables.ts createViewModel.ts (+ tests)
tests/e2e/                   T-18-weapon-asset-pipeline.e2e.mjs
docs/ASSETS.md
```

**Structure Decision**: tooling in `tools/asset-pipeline`, runtime code only in `src/weapon/viewmodel/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Binary art asset committed (principle VI) | Ticket "Update: asset supplied" permits committing derived GLB/PNG under user-stated author permission | Procedural only ignores the supplied asset; procedural stays default and fallback |
| Output dir `public/assets/weapons/g36c` instead of ticket's `public/models/weapon` | Ticket update and assignment name the former | Superseded path contradicts the update |
