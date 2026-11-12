# T-12 — Grappling hook

| | |
|---|---|
| Wave | 2 |
| Depends on | T-01 (hard). Soft: T-04/T-03 for in-level anchors (the sandbox pillar and perch are enough to build and test) |
| GDD sections | 4.1, 7.4, 2 (traversal pillar), 16 Player; REVIEW #2 |
| Spec dir | `specs/T-12-grappling-hook/` |

## Goal

Implement the grapple: Space fires along the view, a ray finds a `grappleable` surface within 40 m, a cable is shown and the player is pulled at 18 m/s with collision, releasing on Space, on arrival, or when stuck; 1.0 s cooldown and a clear failure state. Perch anchors land the player on top of platforms.

## Files owned (exclusive)

- `src/grapple/**` (replace `src/grapple/index.ts`; keep `createGrappleModule` and id `grapple`)
- `tests/e2e/T-12-grappling-hook.e2e.mjs` (browser check, optional but recommended)
- `specs/T-12-grappling-hook/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ctx.player`: `getEyePosition`, `getLookDirection`, `position`, `velocity`, `alive`, `controlsLocked`; you set/clear `externalVelocity` and may call `addImpulse` on release
- `ctx.physics.raycast(eye, dir, GRAPPLE.maxRange, { groups: QueryGroups.grapple })` → `hit.meta.grappleable`, `hit.meta.anchorId`
- `ctx.grappleAnchors.get(anchorId)` / `nearest()` for `landing` points of `perch` anchors
- `ctx.input.wasPressed('grapple')` (read in `update`), `GRAPPLE` tunables
- Events in: `player:died`, `game:respawn`, `game:stateChanged`

## Interfaces provided

- Events out: `grapple:fired`, `grapple:attached`, `grapple:released { reason }`, `grapple:failed { reason }`, `grapple:cooldown { remaining, total }` (≤ 10 Hz while cooling)
- Cable + hook visuals; `ctx.testHooks.grapple = { getState(): { phase, cooldown, target } }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-12-grappling-hook
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-12-grappling-hook/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-12-grappling-hook/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure state machine first with tests (`src/grapple/GrappleState.ts`): phases `ready → (fire) → pulling → cooldown → ready`, plus immediate `failed` results; inputs per step: `firePressed`, ray result `{ hit, grappleable, distance, point }`, player eye position, displacement since last step; outputs: desired `externalVelocity` (or null), events to emit. Covers: out of range/no hit → `no-target`; hit non-grappleable → `not-grappleable`; press during cooldown → `cooldown`; arrival within `releaseDistance`; manual release; stuck detection (`stuckDistance` in `stuckWindow`); timeout `maxPullDuration`; cooldown starts on release AND on failure (shorter failure cooldown allowed, put it in `src/grapple/tunables.ts`).
2. Targeting: one ray against all static world (so walls occlude). Valid only if the first hit has `meta.grappleable` (GDD 4.1: never robots, water or unmarked objects — enemies are not in the query groups).
3. Aim assist (small, optional but recommended): if the centre ray misses or hits non-grappleable geometry, test registered anchors within a ~3° cone and in range with line of sight, and use the best one.
4. Pull: each fixed tick set `ctx.player.externalVelocity = normalize(target − eye) * GRAPPLE.pullSpeed`. The controller (T-01) moves the capsule with collision, so the player cannot pass through geometry. Stuck/timeout rules release automatically.
5. Arrival and perches (REVIEW #2): for an ordinary surface, release at `releaseDistance` from the attach point and keep `releaseMomentum` of the pull velocity via `addImpulse` (lets the player crest container edges). For a `perch` anchor with `landing`, pull to the anchor point, then on arrival place the player on `landing` (short guided move or `teleport` if within 3 m and unobstructed) so they end up standing on the platform.
6. Container tops: the attach point is on the top edge/side face; aim the pull at a point ~0.5 m above the top edge so the capsule clears the lip, then the momentum carries the player onto the roof. Verify on the sandbox stacked container.
7. Release: Space again (edge), arrival, stuck, timeout, death; always clear `externalVelocity`. Never leave it set when the module is disposed or the game leaves `playing`.
8. Visuals: hook head flies from a hand/muzzle offset to the target at `hookTravelSpeed` (visual only; the pull starts when it lands, at most ~0.4 s), cable as a thin stretched cylinder or `Line` updated each frame from the view-model offset to the attach point, slight sag optional; a subtle reticle change when a valid target is under the crosshair (emit nothing; draw a small DOM/mesh indicator in your own module).
9. e2e: `?sandbox&autostart`: aim at the pillar (compute yaw/pitch to its anchor), press `Space` → `grapple:attached`, player rises above 8 m and auto-releases; aim at the ground → `grapple:failed`; press during cooldown → `cooldown`; grapple to the perch anchor → player ends standing on the platform (y ≈ 8).

## Acceptance criteria

- [ ] **AC1** Pressing Space fires along the view direction; a valid target is a collider flagged `grappleable` within 40 m with a clear line; robots, sea and unflagged geometry are rejected with `grapple:failed` and the correct reason.
- [ ] **AC2** While attached a cable is rendered and the player is pulled at 18 m/s (±5%) towards the attach point with collision active (cannot pass through a wall placed between player and anchor; auto-releases as `stuck`).
- [ ] **AC3** The grapple releases on a second Space press, on arrival, on timeout and on player death, always clearing `externalVelocity`.
- [ ] **AC4** After any release there is a 1.0 s cooldown during which firing fails with reason `cooldown`; `grapple:cooldown` events report the remaining time.
- [ ] **AC5** Grappling to a `perch` anchor leaves the player standing on the platform (`landing`), verified on the sandbox perch.
- [ ] **AC6** Grappling to the top of the stacked sandbox container lets the player end up on its roof.
- [ ] **AC7** The state machine is pure and unit tested for every transition and failure reason.
- [ ] **AC8** No per-frame allocations while pulling; visuals are disposed with the module.

## Notes

There is no swinging and no hanging in v1 (REVIEW #2). If T-04 is merged, also verify crane beams and boss perches in `/?autostart&anchors`.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-12
# manual: npm run dev → http://localhost:5173/?sandbox   (yellow pillar, perch platform, stacked container)
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
