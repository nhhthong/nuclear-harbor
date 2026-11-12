# T-18 — Weapon asset pipeline MDL → GLB (optional)

| | |
|---|---|
| Wave | optional |
| Depends on | T-02 merged (done). Asset supplied: `assets-src/weapons/g36c/v_g36c.mdl` (UNBLOCKED) |
| GDD sections | 5.1, 5.2, 16 Weapon Asset, 17.1; REVIEW #3 |
| Spec dir | `specs/T-18-weapon-asset-pipeline/` |

## Goal

Optional track: the user supplied a single GoldSrc view model (G36C, author credited as funnky, permission to use stated by the user; see docs/ASSETS.md). Convert the GoldSrc `v_*.mdl` view model to GLB with headless Blender and load it as an alternative view model. The procedural model stays the default and the fallback.

## Files owned (exclusive)

- `tools/asset-pipeline/**` (scripts, README, licence report). Raw archives go in `tools/asset-pipeline/input/` which is git-ignored and must never be committed.
- `src/weapon/viewmodel/GlbViewModel.ts` and a loader switch inside `src/weapon/viewmodel/` (coordinate with T-02's `ViewModel` interface; no other weapon file)
- `public/models/weapon/**` ONLY if the licence check passes
- `docs/ASSETS.md` (source, author, licence, decision)
- `tests/e2e/T-18-weapon-asset-pipeline.e2e.mjs` (browser check, optional but recommended)
- `specs/T-18-weapon-asset-pipeline/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `ViewModel` interface from T-02 (`src/weapon/viewmodel/ViewModel.ts`)
- Blender 4.0.2 headless (`blender --background --python ...`); three.js `GLTFLoader` (already part of `three/examples/jsm`, bundled, no CDN)
- The archive supplied by the user (gamebanana.com is not reachable from the build environment)

## Interfaces provided

- `tools/asset-pipeline/convert.sh` + Blender Python script producing a validated GLB
- `GlbViewModel` implementing `ViewModel`, selected with `?viewmodel=glb` or a setting, falling back to the procedural model on any load error
- `docs/ASSETS.md` licence and provenance record

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-18-weapon-asset-pipeline
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-18-weapon-asset-pipeline/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-18-weapon-asset-pipeline/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. STOP condition: if no archive has been uploaded, do only the licence-independent groundwork (pipeline scripts tested on a self-made MDL-free sample such as an OBJ, the `GlbViewModel` loader tested with a procedurally exported GLB) and report the ticket as blocked. Never download from mirrors.
2. Inspect the archive in an isolated directory (treat as untrusted data): list files, identify `v_` / `p_` / `w_` models and textures, read any readme; record file names, author and stated terms in `docs/ASSETS.md` (GDD 5.1, 17.1).
3. Licence gate: unless the readme or author explicitly permits redistribution/modification, do NOT commit any derived model. Record the decision; the procedural model remains the shipped asset (GDD 5.1 "mandatory fallback").
4. Conversion (GDD 5.2): Blender has no GoldSrc importer built in. Options in order: (a) a pure-Python MDL v10 reader written in `tools/asset-pipeline/` (header, bones, bodyparts/meshes with triangle strips/fans, embedded 8-bit paletted textures → PNG, sequences if feasible) building the mesh through `bpy`; (b) an existing open-source importer add-on only if it can be vendored offline with a compatible licence. Document the choice.
5. Blender script: import → validate mesh (normals, UVs, scale to metres, orientation −Z forward/+Y up), materials (unlit base colour texture), skeleton/animations if recovered; export GLB (optionally meshopt-free, small). If animations cannot be recovered, export the static mesh and drive it with the same procedural animation as the placeholder (GDD 5.3).
6. Runtime: `GlbViewModel` loads the GLB lazily after boot, positions it to match the procedural model's framing, exposes `muzzleLocalPosition`, maps `playFire`/`playReload` to clips or procedural motion, disposes through `ResourceTracker`. Selection via `?viewmodel=glb`; any failure logs once and keeps the procedural model.
7. Verify in three.js: correct scale/orientation in first person, textures visible, no console errors, draw calls ≤ 6 for the model.

## Acceptance criteria

- [ ] **AC1** `docs/ASSETS.md` records the GameBanana source URL, the archive contents, author and licence findings, and the ship/no-ship decision.
- [ ] **AC2** No file derived from the mod is committed unless the licence check passed; raw archives are never committed.
- [ ] **AC3** A scripted, repeatable headless Blender conversion produces a GLB from the supplied `v_*.mdl` (or the ticket is reported blocked with the groundwork done).
- [ ] **AC4** The converted model renders correctly as the first-person view model in three.js with correct orientation, scale and textures.
- [ ] **AC5** Animations are verified, or replaced by the procedural fire/reload motion, and the choice is documented.
- [ ] **AC6** The procedural view model remains the default and the automatic fallback when the GLB is missing or fails to load.
- [ ] **AC7** The GLB path adds no network request outside the origin and is covered by a load-failure unit or e2e check.

## Notes

This ticket never blocks a milestone. GDD 16 "Weapon Asset" items about the archive stay open until the user uploads it.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
# requires the user-provided archive in tools/asset-pipeline/input/
bash tools/asset-pipeline/convert.sh tools/asset-pipeline/input/<archive>
# manual: npm run dev → http://localhost:5173/?sandbox&viewmodel=glb
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.


## Update: asset supplied (supersedes the BLOCKED notes above)
- Source file: `assets-src/weapons/g36c/v_g36c.mdl` (GoldSrc MDL v10, renamed from `v_aug.mdl`; header name still says `v_aug.mdl`). Single file: embedded textures and animations, no `T.mdl`/`01.mdl` companions.
- Contents (inspected): 46 bones (arms/fingers + `body`, `mag`, `mag1`, `bolt001`, `bolt`, `select`, `sss`, `fff`), 6 sequences (`idle` 112f@30, `reload` 133f@40.3, `draw` 43f@32, `shoot1..3` 34f@40), 18 BMP textures (`hands_1..4`, `g36c_01..14`, several 512², some 256x1024 / 1024x256), 3 bodyparts, 2 attachments. The ORIGINAL GDD asset (DesertTech MDR) is no longer used; the previously supplied SG552/MSBS file was discarded by the user.
- Licence: the user states the author (funnky) permits use. The file contains no readme/credits. Record this in `docs/ASSETS.md` (already seeded) and keep the credit in the game credits. The mod's source archive/URL is not needed.
- Because the licence statement is the user's, files derived from this model MAY be committed under `public/assets/weapons/g36c/` (GLB + PNG textures). Keep `assets-src/` as the source of truth.
- Goal: GLB view model with skeleton and the 6 animations if recoverable, mapped to the weapon states (idle, reload, draw, fire), loaded by `GlbViewModel` as an alternative to the procedural model, with automatic fallback to the procedural one on any load error. Muzzle position from attachment 0, ejection port from attachment 1 if plausible.
- AC1-AC3 are reworded accordingly: record provenance as above; derived files may be committed; scripted headless conversion from `v_g36c.mdl` (do not report blocked).
