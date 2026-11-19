# Last Stand: Nuclear Harbor Constitution

## Core Principles

### I. Performance by Design (NON-NEGOTIABLE)

Performance is an architectural requirement, not a final optimisation pass (GDD pillar 5, section 13).

- Objects created and destroyed frequently (projectiles, particles, tracers, casings, dropped
  pickups) MUST come from a bounded `ObjectPool`. When a pool is exhausted the effect is dropped;
  code MUST NOT allocate without bound.
- Repeated static geometry (containers, beams, lamp posts) MUST use `InstancedMesh` or shared
  geometry and materials. Independently animated robots MUST NOT share one animated skeleton.
- Code on the per-frame or fixed-step path MUST NOT allocate in steady state (no `new Vector3()`
  inside `update` / `fixedUpdate`; use module-level scratch objects).
- Collision MUST use Rapier primitives (boxes, capsules, spheres). Mesh colliders are forbidden.
- Simulation runs in the fixed 60 Hz step; rendering is independent. AI update frequency scales
  with distance to the player and MUST preserve gameplay state at every simulation level.
- Every GPU resource MUST be owned by a `ResourceTracker` scope and released in `dispose()`,
  together with event listeners, timers and DOM nodes.

Rationale: the target is 60 FPS on a desktop browser with up to 10 streamed robots alive, a boss and a 72 x 122 m quay;
retrofitting pooling, instancing and disposal is far more expensive than building with them.

### II. Strict, Typed Contracts Between Modules

- TypeScript `strict` (plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
  MUST pass with zero errors. `any`, `@ts-ignore` and `@ts-expect-error` are forbidden in `src/`
  unless a comment justifies the single occurrence.
- Feature modules MUST communicate only through `GameContext`: the typed `EventBus`
  (`src/core/events.ts`), the registries, `PlayerState` and the shared types in
  `src/core/types.ts`. A feature module MUST NOT import from another feature module's folder.
- Existing events and shared types are a published contract: they MUST NOT be renamed, removed or
  have their meaning changed by a feature, unless its plan justifies it in the Constitution Check
  (spec 27 retired the boss weak-point phases this way). Additions follow Principle V.

Rationale: several contributors build modules in parallel; compile-time contracts are the only cheap way
to keep independently written code compatible.

### III. Tunables Live in Config

- Every gameplay number MUST be read from `src/config/tunables.ts` (GDD values and shared
  defaults) or from the feature's own `src/<feature>/tunables.ts` (feature-local values). Numeric
  gameplay literals in feature logic are forbidden.
- Values tagged `GDD x.y` in `tunables.ts` MUST NOT be changed without a recorded playtest reason.
- Level layout shared by several modules (zones, tower positions, crane sites, boss arena, spawn)
  MUST come from `src/config/level.ts`.

Rationale: the GDD marks all numbers as starting values to be playtested; balancing must be a
one-file change.

### IV. Test Pure Logic, Verify in the Browser

- Game rules MUST be written as pure functions or classes without three.js scene, DOM or Rapier
  dependencies wherever possible (damage, ammo, state machines, timers, countdown, placement
  generators, budgets) and MUST be covered by Vitest unit tests written before or with the code.
- Every feature's acceptance criteria MUST be testable; each one is verified by a unit test, by a
  browser check (scripted screenshots or `tests/e2e/`), or by a written manual check in the
  feature's spec folder. Anything not run is written as "skipped" with the reason, never as verified.
- A change is not done until `npx tsc --noEmit && npm test && npm run build` passes (what CI runs).
  `npm run smoke` and `npm run e2e` are optional and currently stale (see `docs/SPECKIT.md`); a
  feature that revives them MUST say so in its plan.

Rationale: rendering and feel need eyes, but rules do not; automated checks on rules keep
parallel work from silently breaking the game loop.

### V. Small, Declared Blast Radius

- A feature owns its folder `src/<feature>/`, its `specs/NN-name/` folder and its tests. Edits to
  shared code (`src/core/**`, `src/config/**`, `src/physics/**`, `src/combat/**`, `src/assets/**`,
  `src/modules.ts`, `src/main.ts`, `scripts/**`, build configuration) are allowed only when the
  feature needs them, MUST be additive where possible, and MUST be listed in the plan's
  Constitution Check with the reason. Never edit `.specify/templates`, `.specify/scripts` or
  `.claude/skills` as part of a feature.
- New events are added by TypeScript declaration merging in the feature's own `events.ts`; new
  feature-local numbers go in the feature's own `tunables.ts`, which avoids touching shared files.
- Parallel work (several branches or sub-agents) MUST use disjoint file sets or separate worktrees;
  a coordinator merges.

Rationale: contributors still work on separate branches at the same time; declaring the shared
files a change touches keeps merges predictable. (Amendment 2.0.0: replaces per-ticket exclusive
ownership, which stopped matching how features are built.)

### VI. Offline, Self-Contained, Procedural

- The game MUST run with no backend and no network after the first load. Runtime requests to
  CDNs or any third-party origin are forbidden; all code and data ship in the build output.
- Content is procedural by default: primitive or generated geometry, generated textures, Web
  Audio synthesis. Binary assets (GLB models) are allowed when built offline by a script in
  `tools/asset-pipeline/` from CC0 or CC-BY sources, shipped from `public/assets/`, loaded from
  the same origin, with a procedural fallback where one exists (new models should have one).
  Audio files remain forbidden without maintainer approval.
- Every third-party asset MUST be recorded in `docs/ASSETS.md` (source, author, licence, script)
  and credited in `src/ui/credits.ts` and `CREDITS.md`. Assets of unverified licence
  MUST NOT be committed; raw downloads and archives stay out of git (`tools/asset-pipeline/input/`).
- New runtime dependencies beyond `three` and `@dimforge/rapier3d-compat` require maintainer
  approval.

Rationale: GDD section 14 requires offline play; the project must stay legally clean and
reproducible from its asset scripts. (Amendment 2.0.0: owner approved free CC0/CC-BY models.)

### VII. Simplicity and Scope Discipline

- Implement what the spec and the referenced GDD sections ask for, in the simplest form that
  meets the acceptance criteria. No speculative abstraction, no framework inside a module.
- Decisions recorded in `docs/DEVIATIONS.md`, `docs/PLAN.md` ("Current state") and
  `docs/REVIEW.md` are binding defaults. A deviation MUST be justified in the feature's `plan.md`
  and recorded in `docs/DEVIATIONS.md`.
- Owner decisions override the GDD. (Amendments: 1.0.1 grapple, four towers and the Charger
  removed; 2.0.0 the boss weak points and the GDD cut-list rule are gone, the final boss is the
  Gunslinger Crab Mech with one HP pool; see `docs/DEVIATIONS.md`.)

Rationale: a small, working vertical slice that is fun beats a broad, half-finished feature set.

## Technical Constraints

- Stack: TypeScript (strict), Three.js, Vite, Rapier via `@dimforge/rapier3d-compat`, Web Audio
  API, DOM/CSS for HUD and menus, LocalStorage for persistence. Node 20 or newer.
- Coordinates and units: metres, seconds; +X east, +Y up, +Z south; ground at y = 0; player yaw 0
  faces -Z. `PlayerState.position` is the feet position.
- Architecture: one `GameModule` per feature folder, exported from `src/<feature>/index.ts` with
  the factory name and module id already present in the placeholder; registration order is fixed
  in `src/modules.ts`.
- Input: hold state may be read anywhere; edge state (`wasPressed`) and look deltas are read in
  `update()` only. Gameplay timers advance in `fixedUpdate` only.
- Sandbox: `?sandbox` selects the foundation test scene. Level-building modules build nothing in
  sandbox mode; gameplay modules add their own minimal sandbox fixture.
- Code and documents are written in English. Commit messages and files MUST NOT contain model or
  vendor names beyond the required attribution trailer.

## Development Workflow

- Each new feature follows the Spec Kit flow described in `docs/SPECKIT.md`: specify, plan, tasks,
  (analyze), implement, with artifacts in `specs/NN-name/` (NN = next free number, explicit
  `SPECIFY_FEATURE_DIRECTORY`). Small fixes and tuning do not need Spec Kit. `specs/T-XX-name/`
  and `docs/tickets/` are historical.
- Spec Kit steps run non-interactively: open questions are resolved with the defaults in the
  ticket, `docs/PLAN.md` and `docs/REVIEW.md`, and recorded as assumptions.
- Work happens on a feature branch and is merged into `main` through a pull request; do not push
  to `main` directly.
- Definition of Done is the one in `docs/SPECKIT.md` ("Continuing the work"); `docs/PLAN.md`
  section 7 is the original, partly stale version. The hand-over summary lists acceptance
  criteria status, deviations, shared files touched and anything skipped.

## Governance

- This constitution supersedes other practice documents. Where it conflicts with a ticket, the
  constitution wins and the conflict is reported to the maintainer.
- The maintainer owns this file. Amendments are made only by the maintainer, recorded with a
  version bump: MAJOR for removing or redefining a principle, MINOR for a new or materially
  expanded principle or section, PATCH for clarifications.
- Every spec, plan and review MUST check compliance with the principles above (the "Constitution
  Check" in the plan template). A justified exception is recorded in the plan's complexity
  tracking section.
- Runtime guidance for developers lives in `docs/PLAN.md` ("Current state"), `docs/DEVIATIONS.md`
  and `docs/SPECKIT.md`.

**Version**: 2.0.1 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-19

Amendment 2.0.0 (2026-11-19, MAJOR: principles V and VI redefined, IV and VII corrected): audited
against the repo after specs 24 to 28. Per-ticket file ownership became declared blast radius (V);
authored CC0/CC-BY GLBs are allowed with credits and fallbacks (VI); the smoke requirement was
dropped from the definition of done to match CI (IV); weak-point and cut-list text removed (VII).
Principle II got a justified-exception clause (spec 27 precedent). Principles I and III were checked
against the code (no cross-module imports, no `any`, pools, `ResourceTracker`, tunables) and are unchanged.

Amendment 2.0.1 (2026-11-19, PATCH): the credits table moved from README.md to CREDITS.md; Principle VI now names that file.
