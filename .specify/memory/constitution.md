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
  have their meaning changed by a feature ticket. Additions follow the rules of Principle V.

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
- Every ticket's acceptance criteria MUST be testable; each one is verified by a unit test, by a
  browser check under `tests/e2e/`, or by a written manual check in the ticket's spec folder.
- A change is not done until `npm run typecheck && npm test && npm run build && npm run smoke`
  passes. The smoke test (no console errors, canvas renders, simulation advances) MUST stay green.

Rationale: rendering and feel need eyes, but rules do not; automated checks on rules keep
parallel work from silently breaking the game loop.

### V. Exclusive File Ownership

- Every file has exactly one owner: the foundation or one ticket. A ticket MUST only create or
  edit files listed under "Files owned" in its ticket document (plus its `specs/T-XX-name/`
  folder and its `tests/e2e/T-XX-*.e2e.mjs` file).
- Foundation-owned files (`src/core/**`, `src/config/**`, `src/physics/**`, `src/combat/**`,
  `src/assets/**`, `src/sandbox/**`, `src/modules.ts`, `src/main.ts`, `index.html`, `scripts/**`,
  build and tool configuration, `.specify/**`, `.claude/**`, `docs/PLAN.md`, `docs/tickets/**`)
  MUST NOT be edited by feature tickets. A needed change is requested from the maintainer by
  recording it in the ticket's spec folder (`specs/T-XX-name/foundation-requests.md`) and worked
  around locally until it lands.
- New events are added by TypeScript declaration merging in the feature's own `events.ts`; new
  feature-local numbers go in the feature's own `tunables.ts`. Neither requires editing a shared
  file.

Rationale: contributors work on separate branches at the same time; disjoint file sets are
what makes their branches merge without conflicts.

### VI. Offline, Self-Contained, Procedural

- The game MUST run with no backend and no network after the first load. Runtime requests to
  CDNs or any third-party origin are forbidden; all code and data ship in the build output.
- All v1 content MUST be procedural: primitive or generated geometry, generated textures, Web
  Audio synthesis. Binary art or audio assets MUST NOT be added without maintainer approval.
- Third-party assets of unverified licence (including the GameBanana weapon mod referenced by the
  GDD) MUST NOT be committed. The procedural weapon view model is the shipping default.
- New runtime dependencies beyond `three` and `@dimforge/rapier3d-compat` require maintainer
  approval.

Rationale: GDD section 14 requires offline play; the project has no licensed assets and the
build environment cannot reach asset hosts.

### VII. Simplicity and Scope Discipline

- Implement what the ticket and the referenced GDD sections ask for, in the simplest form that
  meets the acceptance criteria. No speculative abstraction, no framework inside a module.
- Decisions recorded in `docs/REVIEW.md` and `docs/PLAN.md` are binding defaults. A deviation
  MUST be justified in the ticket's `plan.md` and reported in the hand-over summary.
- When time runs short, cut in the order of the GDD cut list (15.2). The boss's four weak points
  plus core MUST NOT be cut. (Amendment 1.0.1: grapple, four towers and the Charger were
  removed or replaced by owner decision; see `docs/DEVIATIONS.md`.)

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

- Each ticket follows the Spec Kit flow described in `docs/SPECKIT.md`: specify, plan, tasks,
  (analyze), implement, with artifacts in `specs/T-XX-name/`. The ticket document in
  `docs/tickets/` is the input to the specify step.
- Spec Kit steps run non-interactively: open questions are resolved with the defaults in the
  ticket, `docs/PLAN.md` and `docs/REVIEW.md`, and recorded as assumptions.
- Work happens on a feature branch and is merged into `main` through a pull request; do not push
  to `main` directly.
- Definition of Done is the one in `docs/PLAN.md`; the hand-over summary lists acceptance
  criteria status, deviations, and any foundation requests.

## Governance

- This constitution supersedes other practice documents. Where it conflicts with a ticket, the
  constitution wins and the conflict is reported to the maintainer.
- The maintainer owns this file. Amendments are made only by the maintainer, recorded with a
  version bump: MAJOR for removing or redefining a principle, MINOR for a new or materially
  expanded principle or section, PATCH for clarifications.
- Every spec, plan and review MUST check compliance with the principles above (the "Constitution
  Check" in the plan template). A justified exception is recorded in the plan's complexity
  tracking section.
- Runtime guidance for developers lives in `docs/PLAN.md`, `docs/SPECKIT.md` and the ticket
  documents.

**Version**: 1.0.2 | **Ratified**: 2026-11-12 | **Last Amended**: 2026-11-15
