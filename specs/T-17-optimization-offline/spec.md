# Feature Specification: Optimisation, Offline Packaging and Integration Backlog (T-17)

**Feature Branch**: `T-17-optimization-offline` (spec dir only; work stays on the assigned worktree branch)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: ticket `docs/tickets/T-17-optimization-offline.md` plus an 8-item backlog (menu draw calls, applied settings, static shadows, offline service worker, credits, playtest fixes, bundle size, real screenshots).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stay within the performance budget in every screen (Priority: P1)

A player on a modest machine opens the game. The menu, the harbor and the sandbox all render within the draw-call budget, and the sun shadow does not cost a full re-render every frame.

**Why this priority**: M6 exit criterion; the menu currently measures about 384 draw calls against a 350 budget.

**Independent Test**: The smoke run prints draw calls per state and fails above budget; the shadow map is observed not auto-updating.

**Acceptance Scenarios**:

1. **Given** the main menu, **When** a frame is rendered, **Then** draw calls are at most 350.
2. **Given** the harbor in play with all robots alive, **When** rendered on medium, **Then** draw calls are at most 350 and triangles at most 1.5 M.
3. **Given** a running game, **When** the player and robots move, **Then** static world shadows are not re-rendered each frame, and dynamic casters still cast shadows near the player.

---

### User Story 2 - Settings actually change the game (Priority: P1)

The player picks graphics quality, an FPS cap and a master volume in the settings UI. The game applies them at once and remembers them after a reload.

**Why this priority**: Currently the controls store values that nothing reads.

**Independent Test**: Unit tests on the pure preset/cap logic; browser check that changing quality changes shadow resolution and that volume reaches the audio master gain.

**Acceptance Scenarios**:

1. **Given** quality set to low, **When** applied, **Then** shadows and post effects are off and pixel ratio is reduced.
2. **Given** an FPS cap of 30, **When** the game runs, **Then** rendering happens at most about 30 times a second while simulation stays fixed-step.
3. **Given** volume set to 0.3, **When** applied, **Then** master gain equals 0.3 and persists after reload.

---

### User Story 3 - Play offline after the first load (Priority: P2)

A player loads the game once online, then disconnects and can still start and play it. The game is installable as a web app.

**Why this priority**: GDD 14 requires offline play.

**Independent Test**: An automated script loads the production build, goes offline, reloads, and reaches the playing state with zero failed requests; a separate check asserts no cross-origin request.

**Acceptance Scenarios**:

1. **Given** one online load, **When** the network is blocked and the page reloads, **Then** the game boots and reaches `playing`.
2. **Given** a new build version, **When** the player returns online, **Then** old caches are removed and the new build is cached.

---

### User Story 4 - A survivable, readable first run (Priority: P2)

Holding E at a tower is dangerous but survivable for a competent player (about a medkit of HP lost), and the warehouse interior is visible.

**Why this priority**: Playtest findings show a lethal defend phase and a nearly black warehouse where tower 1 stands.

**Independent Test**: A scripted run records HP lost at towers 1, 2 and 4 and compares with the target; screenshots of the warehouse show a visible interior.

**Acceptance Scenarios**:

1. **Given** default HP, **When** a 5 s hold is done at towers 1, 2 and 4, **Then** the player survives with at most about 50 HP lost.
2. **Given** the player inside the warehouse, **When** viewed, **Then** walls, floor and tower are distinguishable.

---

### User Story 5 - Credits, flow robustness and code hygiene (Priority: P3)

The main menu has a Credits entry naming the weapon model author and libraries. UI requests no longer force `playing` when flow refuses them; the boss checkpoint payload carries a copy of the player position; unused tunables are removed or marked.

**Why this priority**: Attribution is a promise to the asset author; the others remove known fragility.

**Independent Test**: Unit/e2e tests: credits screen opens and closes; a refused request leaves state unchanged; the checkpoint payload is not the live vector.

**Acceptance Scenarios**:

1. **Given** the main menu, **When** Credits is chosen, **Then** G36C view model by funnky, Three.js and Rapier are listed and Back returns.
2. **Given** flow refuses a request, **When** the UI sent it, **Then** the game state is not changed to playing.

---

### User Story 6 - Smaller download and honest evidence (Priority: P3)

The JS payload is split and minified with before/after sizes reported; screenshots of menu, harbor, warehouse and boss arena are inspected before and after and described honestly.

**Why this priority**: Load time on weak connections; trustworthy playtest notes.

**Independent Test**: Build output sizes recorded; screenshots exist in `docs/playtest/` and are described in `docs/PLAYTEST.md`.

**Acceptance Scenarios**:

1. **Given** a production build, **When** sizes are measured, **Then** vendor chunks are separate and totals are documented before/after.

### Edge Cases

- Service worker unsupported or registration fails: the game still runs online.
- Dev server: the service worker is not registered.
- FPS cap higher than display refresh: no effect.
- Quality change mid-run: the shadow map refreshes once.
- Settings storage unavailable: defaults are used.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every game state (menu, play, sandbox) MUST render within the `maxDrawCalls` budget.
- **FR-002**: Quality presets MUST control shadow resolution/enabled, post effects and pixel ratio / view distance; changes apply live.
- **FR-003**: An FPS cap setting MUST limit render rate without altering the simulation step.
- **FR-004**: Master volume MUST reach the audio output and persist.
- **FR-005**: Static shadows MUST be rendered once per world/quality change; dynamic casters near the player MUST still be shadowed.
- **FR-006**: The production build MUST include a hand-written service worker that precaches all built files (including the GLB), with a versioned cache and old-cache cleanup, registered only in production.
- **FR-007**: A web manifest and icons MUST make the game installable; README and `docs/OFFLINE.md` MUST give install/preload/clear instructions.
- **FR-008**: An automated check MUST prove offline boot and absence of cross-origin requests.
- **FR-009**: A Credits screen MUST list the G36C model (funnky), Three.js and Rapier.
- **FR-010**: Defend-phase pressure MUST be rebalanced through tunables and the result recorded.
- **FR-011**: The warehouse interior MUST be lit without extra shadow casters.
- **FR-012**: UI requests MUST NOT force state when flow refuses; the boss checkpoint payload MUST NOT contain live vectors; unused T-05 tunables MUST be removed or marked.
- **FR-013**: The bundle MUST be split into vendor chunks and minified; before/after sizes reported.
- **FR-014**: `npm run bench` and `npm run leakcheck` MUST output JSON; the leak check MUST show resources return to baseline across restarts.
- **FR-015**: `docs/PERFORMANCE.md` MUST hold benchmark numbers, the streaming decision, and state that real-device numbers are pending.

### Key Entities

- **Quality preset**: named bundle of shadow, post, pixel-ratio and view-distance values.
- **Settings**: quality, FPS cap, volume; persisted per browser.
- **Precache manifest**: list of build files with a version hash used by the service worker.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Draw calls at most 350 in menu, harbor and sandbox.
- **SC-002**: With the network disabled after one load, the game reaches play in the automated check with 0 failed requests.
- **SC-003**: Zero requests leave the origin during a full boot.
- **SC-004**: A scripted 5 s tower hold costs at most about 50 HP at towers 1, 2 and 4.
- **SC-005**: Initial download size is lower than the 1.8 MB gzip baseline or the reason it cannot be is documented.
- **SC-006**: All unit, smoke and e2e checks pass.

## Assumptions

- Headless software-GL numbers are relative only; real low-end/mid device runs are pending and need the owner (`?bench` instructions provided).
- The project owner granted permission to use the G36C model by funnky (see `docs/ASSETS.md`).
- Streaming is not needed (expected; confirmed by measurement in `docs/PERFORMANCE.md`).
- This ticket may edit any module (cross-cutting); touched files are listed in the plan.
