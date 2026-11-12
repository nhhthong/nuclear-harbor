# Feature Specification: Cranes, perches, lamp posts and grapple anchors (T-04)

**Input**: `docs/tickets/T-04-cranes-and-anchors.md`, GDD 7.4, 4.1, 9.2, 13.3, 16; REVIEW #2.

## User Scenarios & Testing

### US1 - Traverse the harbor vertically (P1)
As a player I see six gantry cranes and can grapple to their beams/booms; legs block me.
**Independent test**: e2e boots `/?autostart&anchors`, counts 6 cranes and their anchors.
1. Given the harbor, when it loads, then six cranes stand on `CRANE_SITES` (LOD, scale/colour variants).
2. Given a crane, when I shoot/walk into a leg, then it blocks; beams/booms are grappleable colliders.

### US2 - Always something to grapple in B and D (P1)
Every walkable point of zones B and D has an anchor within 40 m (GDD 7.4).
**Independent test**: pure `checkCoverage()` unit test = 100%; runtime LOS check >= 95%.

### US3 - Boss-arena perches and tower-3 platform (P1)
Perches at 8/14/20 m (>= 2 each) around the boss arena with `perch` anchors + `landing`; an 8x8 m
platform with top at y = 10 at tower 3, grapple-only access.

### US4 - Debug view (P2)
`?anchors` shows anchor spheres by kind, red markers on uncovered samples, per-zone coverage line.

### Edge cases
- `?sandbox`: module builds nothing and registers no hooks.
- Crane ground footprint stays inside its 14 m keep-clear disc; lamp posts avoid keep-clear discs,
  the boss arena and the control center.
- `dispose()` removes meshes, colliders, anchors, DOM.

## Requirements
- **FR-001** Six cranes from one base model (shared box geometry, shared materials, scale/colour
  variation, `THREE.LOD` with a ~6-box low level beyond 150 m).
- **FR-002** One static box collider per structural member; beams/booms/portal tops/mid beams
  grappleable, legs not.
- **FR-003** Anchors of kinds `crane`, `beam`, `lamp-post`, `perch` registered in `ctx.grappleAnchors`.
- **FR-004** Lamp posts (8-10 m, grappleable arm) on a regular grid in B and D, greedily filled where
  coverage would fail.
- **FR-005** >= 6 perch towers (slab >= 4x4, mast, `landing` on slab) outside the arena radius.
- **FR-006** Tower-3 platform: 8x8 m, top y = 10, four legs, two opposite perch anchors, no stairs.
- **FR-007** Pure `checkCoverage()` (5 m grid, eye height, zones B and D); runtime LOS check after
  `world:ready`; `ctx.testHooks.structures`.
- **FR-008** <= 40 draw calls; everything tracked by `ctx.resources.scope('structures')`.

## Success Criteria
AC1-AC8 of the ticket; mapped in `tasks.md`.

## Assumptions
- All perches are free-standing towers (AC4 only requires counts per height; the ticket's "on the
  dock cranes" is optional and skipped).
- Anchor points sit 0.1 m outside the collider surface they belong to (under beams) so
  line-of-sight rays do not start inside geometry.
- Walkable sample = on land, in zone B or D, outside the control-center footprint and outside
  structure footprints built here.
- Slow warning-light animation is skipped (optional in ticket).
