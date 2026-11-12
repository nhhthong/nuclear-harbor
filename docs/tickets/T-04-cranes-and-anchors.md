# T-04 — Cranes, perches, lamp posts and grapple anchors

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 7.4, 4.1 (valid anchors), 9.2 (boss arena anchors), 13.3 (LOD), 16 World; REVIEW #2 |
| Spec dir | `specs/T-04-cranes-and-anchors/` |

## Goal

Build the vertical structures of the harbor and register them as grapple targets: six gantry cranes (one base model with scale/colour variants and `THREE.LOD`), steel beams, lamp posts, the elevated tower-3 platform, and boss-arena perches at 8 / 14 / 20 m. Provide the debug tool that checks the anchor density rule.

## Files owned (exclusive)

- `src/structures/**` (replace `src/structures/index.ts`; keep `createStructuresModule` and id `structures`)
- `tests/e2e/T-04-cranes-and-anchors.e2e.mjs` (browser check, optional but recommended)
- `specs/T-04-cranes-and-anchors/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox` — return early from `init` when `ctx.flags.sandbox` is true (the sandbox has its own pillar and perch)
- `@/config/level`: `CRANE_SITES`, `TOWERS` (tower 3 platform), `BOSS_ARENA`, `ZONES`, `KEEP_CLEAR`, `LAND`
- `BOSS.perchHeights`, `GRAPPLE.maxRange`, `WORLD`, `PLAYER.eyeHeight` tunables
- `ctx.physics.addStaticBox` with meta `{ kind: 'static', grappleable: true, anchorId }`; `ctx.physics.hasLineOfSight`
- `ctx.grappleAnchors` (`add`, `coverage`); `GrappleAnchor.landing` for perches
- `ctx.flags.params` (`?anchors` debug view), `ctx.input.wasPressed('debugToggle')` is reserved for T-11: use a query param only

## Interfaces provided

- 6 cranes with box colliders and grappleable beams/booms; lamp posts; the tower-3 platform (top at y = 10 at `TOWERS[2].position`); ≥ 6 boss-arena perches at the three heights
- Registered `GrappleAnchor`s of kinds `crane`, `beam`, `lamp-post`, `perch`
- Pure `checkCoverage()` + `?anchors` debug overlay; `ctx.testHooks.structures = { coverage(): { zone, covered, total }[] }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-04-cranes-and-anchors
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-04-cranes-and-anchors/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-04-cranes-and-anchors/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure builders first (`src/structures/craneLayout.ts` + tests): from a `CraneSite` produce the list of boxes (legs, portal beams, boom, cabin, ladder-less) with sizes, which ones are grappleable, and the anchors (boom tip, portal beam centres, mid-leg points). Ground footprint must stay inside the site's 14 m keep-clear disc; parts above 9 m may overhang.
2. One crane "model" = shared box geometry + 2-3 shared materials; build each crane as instanced/merged meshes; wrap in `THREE.LOD` with a low level (≈6 boxes merged) beyond ~150 m (GDD 7.4, 13.3). Variation by `scale` and colour only.
3. Colliders: one static box per structural member (legs, beams, boom). Beams/booms/portal tops are `grappleable`; legs are not (so players pull up to beams, not into legs).
4. Perches (REVIEW #2): a platform slab ≥ 4 x 4 m with a mast or rail above it. Register a `perch` anchor ~2.2 m above the slab near its inner edge with `landing` at the slab centre, exactly like the sandbox perch (`src/sandbox/index.ts`). Build them on the two dock cranes and on free-standing perch towers around `BOSS_ARENA` (outside its radius, facing the centre): at least two at each of 8, 14 and 20 m, spread around the circle.
5. Tower-3 platform: 8 x 8 m slab with top at y = 10 centred on `TOWERS[2].position`, four legs, a perch anchor on each of two opposite sides, no stairs (grapple only). Keep the slab centre free for the tower model (T-08).
6. Lamp posts: thin posts 8-10 m high with a grappleable arm, placed on a regular pattern in zones B and D (and zone borders) wherever coverage would otherwise fail; skip keep-clear discs and the boss arena interior.
7. Coverage rule (GDD 7.4): pure function sampling walkable points on a 5 m grid at eye height in zones B and D; a sample is covered when at least one anchor is within `GRAPPLE.maxRange`. Unit-test it with the generated anchor set (must be 100%). The runtime tool additionally checks line of sight with `ctx.physics.hasLineOfSight` after `world:ready` and logs uncovered samples.
8. `?anchors` debug view: small spheres on anchors (colour by kind), red markers on uncovered samples, a DOM line with coverage per zone.
9. Slow background animation is optional (GDD 7.2): if added, animate only non-collider decorative parts (warning lights).
10. e2e: boot `/?autostart&anchors`, assert 6 cranes, perch counts per height, coverage 100% for B and D from `testHooks`, no console errors.

## Acceptance criteria

- [ ] **AC1** Six cranes exist at `CRANE_SITES` (3 in zone B, 1 at the yard edge, 2 on the dock), built from one shared base model with scale/colour variation and `THREE.LOD`.
- [ ] **AC2** Crane beams and booms are grappleable colliders with registered anchors; crane legs block movement and bullets.
- [ ] **AC3** Every walkable sample point (5 m grid) in zones B and D has at least one registered anchor within 40 m (unit test), and the runtime tool reports line-of-sight coverage ≥ 95%.
- [ ] **AC4** The boss arena has at least two perches at each of 8 m, 14 m and 20 m with `perch` anchors carrying a `landing` point on the slab.
- [ ] **AC5** An 8 x 8 m platform with its top at y = 10 exists at the tower-3 position and is reachable only by grapple.
- [ ] **AC6** The `?anchors` debug view shows anchors and uncovered samples and prints per-zone coverage.
- [ ] **AC7** The module builds nothing in `?sandbox`; ground footprints stay inside the keep-clear discs; the module costs ≤ 40 draw calls.
- [ ] **AC8** `dispose()` removes meshes, colliders and anchors.

## Notes

The grapple itself is T-12. Its contract: the ray tests all static world colliders and attaches only when the hit collider has `meta.grappleable`; for anchors of kind `perch` it uses `landing`. Container-top anchors are registered by T-03.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-04
# manual: npm run dev → http://localhost:5173/?autostart&anchors
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
