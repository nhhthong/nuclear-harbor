# Feature Specification: Weapon asset pipeline (G36C view model)

**Feature Branch**: `T-18-weapon-asset-pipeline` (worktree branch; spec dir is explicit)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Convert the supplied GoldSrc view model `assets-src/weapons/g36c/v_g36c.mdl` (46 bones, 6 sequences, 18 embedded textures) to a GLB with skeleton, textures and idle/reload/draw/shoot animations through a scripted, repeatable offline pipeline; load it as an alternative first-person view model (`?viewmodel=glb`) with automatic fallback to the procedural one; record provenance." Source documents: `docs/tickets/T-18-weapon-asset-pipeline.md` (including "Update: asset supplied"), GDD 5.1-5.3.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the real rifle in first person (Priority: P1)

A player (or reviewer) opens the game with `?viewmodel=glb` and sees the supplied G36C rifle with arms, textured, correctly scaled and oriented in the bottom-right of the view, instead of the box-built placeholder.

**Why this priority**: This is the whole point of the optional track: real weapon art in the shipped game.

**Independent Test**: Load the sandbox with the switch, take a screenshot of the first-person view, and confirm the rifle is recognisable, upright, pointing forward and textured.

**Acceptance Scenarios**:

1. **Given** the converted model is shipped, **When** the game starts with `?viewmodel=glb`, **Then** the rifle model is visible as the view model and the muzzle points away from the player.
2. **Given** the game starts without the switch, **When** the player looks at the weapon, **Then** the procedural placeholder is shown (default unchanged).

---

### User Story 2 - The rifle animates with the weapon states (Priority: P1)

Firing, reloading and drawing play the model's own animations (or, if they cannot be recovered, the existing procedural motion on the static model), and the rifle returns to idle afterwards.

**Why this priority**: Without animation the model feels dead; the weapon module already announces fire and reload events.

**Independent Test**: In the browser, fire once and reload; confirm the active animation clip changes to a shoot and a reload clip and returns to idle.

**Acceptance Scenarios**:

1. **Given** the real model is active, **When** the player fires, **Then** a shoot animation plays and the muzzle/ejection positions used for tracers, flash and casings come from the model.
2. **Given** the real model is active, **When** a reload starts, **Then** the reload animation plays, scaled to the reload duration, and idle resumes.

---

### User Story 3 - Never lose the weapon (Priority: P1)

If the model file is missing, corrupt or slow, the player still has a working rifle: the procedural one stays and the game raises no console error.

**Why this priority**: GDD 5.1 makes the procedural fallback mandatory; the game must also run offline.

**Independent Test**: Request the GLB path with the file blocked/404 and with garbage content; the procedural model remains visible and shooting works.

**Acceptance Scenarios**:

1. **Given** the switch is on and the model request fails, **When** the load error occurs, **Then** the procedural view model stays, one warning is logged, and gameplay continues.
2. **Given** the model loads, **When** the page is inspected, **Then** every request is to the same origin.

---

### User Story 4 - Repeatable conversion with recorded provenance (Priority: P2)

A developer re-runs one command to regenerate the shipped model from the source file, and the asset record states source, author, permission and decision.

**Why this priority**: Makes the asset reproducible and the licence situation auditable.

**Independent Test**: Run the conversion script on a clean checkout and compare the output structure (bones, clips, texture count) with the validation report.

**Acceptance Scenarios**:

1. **Given** `assets-src/weapons/g36c/v_g36c.mdl`, **When** the conversion command runs offline, **Then** it produces a model file plus textures and a validation report (bone count, clips, triangle count, bounds).
2. **Given** `docs/ASSETS.md`, **When** reviewed, **Then** it names the author, the user-stated permission, the contents and the ship decision.

---

### Edge Cases

- The source contains duplicate or alternate body parts/levels of detail: only the view-model set (hands plus weapon) is exported.
- A texture is large (512 px and up): downscaled so the shipped files stay modest.
- Animation data cannot be fully recovered: report plainly and use procedural motion on the static model.
- Pointer-lock, pause and death: the model hides/shows exactly like the placeholder.
- Disposal on module teardown must release all GPU resources; a load that finishes after disposal must be discarded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide a scripted, offline, repeatable command that converts `v_g36c.mdl` into a web model with skeleton, textures and animation clips, and prints a validation report.
- **FR-002**: The converted model MUST be in metres, forward = -Z, up = +Y, with textures visible and no missing material.
- **FR-003**: Only the view-model body set (hands and weapon) MUST be exported; duplicate alternates are skipped.
- **FR-004**: The game MUST offer the real model as an alternative first-person view model selected with `?viewmodel=glb`; the procedural model MUST remain the default.
- **FR-005**: The alternative view model MUST honour the existing view model contract (root object, muzzle and ejection positions, update, fire, reload, dispose).
- **FR-006**: Idle, draw, shoot and reload animations MUST map to the existing weapon states; if recovery fails, procedural motion MUST be applied to the static mesh and the outcome documented.
- **FR-007**: On any load or parse failure the system MUST keep the procedural model, log once, and never throw into the game loop.
- **FR-008**: The model load MUST add no request outside the page origin and MUST work offline after first load.
- **FR-009**: The model MUST use at most 6 draw calls and release its GPU resources on dispose.
- **FR-010**: `docs/ASSETS.md` MUST record source file, author (funnky), user-stated permission, contents and the ship decision.
- **FR-011**: A unit or browser check MUST cover the load-failure fallback.

### Key Entities

- **Source model**: the GoldSrc file with bones, body parts, textures, sequences and attachments.
- **Converted model**: the shipped model file plus texture images and validation report.
- **View model**: the first-person object that the weapon module animates and parents to the camera.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: One command regenerates the shipped model from the source in under 2 minutes with no network.
- **SC-002**: With the switch on, a screenshot shows a recognisable, textured, upright rifle pointing forward; with it off, behaviour is unchanged.
- **SC-003**: Fire and reload visibly change the active animation and return to idle, in 100% of the e2e runs.
- **SC-004**: With the model blocked or corrupt, the player still has a working rifle and the console shows no error.
- **SC-005**: Total shipped model files stay under 4 MB.
- **SC-006**: Existing checks (typecheck, unit tests, build, smoke, T-02 e2e) stay green.

## Assumptions

- The author permits use according to the project owner; no licence text is inside the file. Derived files may be committed (ticket update) and credit is kept.
- Shipping a binary asset is approved by the ticket update, an exception to constitution principle VI recorded in the plan.
- The switch is a query parameter read from the page URL; the weapon module's one-line hook into the new factory is a foundation request because only `src/weapon/viewmodel/` is owned.
- Muzzle position comes from attachment 0 and the ejection port from attachment 1 if plausible, otherwise tunable defaults.
- Out of scope: third-person/world models, sound, other weapons.
