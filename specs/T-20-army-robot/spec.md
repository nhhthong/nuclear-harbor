# Feature Specification: Vanguard Army Mech (T-20)

**Feature Branch**: `worktree-agent-a8fd2a27b34d60b89` (spec dir `specs/T-20-army-robot`)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "T-20 Vanguard army mech (docs/tickets/ROBOT-REFRESH.md): orange heavy assault mech replacing the sphere robot (internal id `sphere` kept, 14 of them, HP ~150). Slow wandering patrol ~1.5 m/s with heavy footsteps; on detect (~30 m) smooth disciplined movement, firing position 18-25 m, strafe, retreat under ~8 m; pooled rockets (~25 m/s, splash ~3 m, ~12 dmg, salvo of 2-3, ~3 s cooldown, telegraphed by missile-cell glow). Faithful port of docs/reference-models/robot_army.html with merged draw calls."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognisable orange mech in the harbor (Priority: P1)

The player sees an orange biped assault mech (armoured torso with missile cells, shoulder turbines, back cannons, two weapon arms, heavy legs) patrolling the harbor instead of the grey ball.

**Why this priority**: The owner asked for the reference robot to replace the placeholder; everything else hangs on it.

**Independent Test**: Spawn one in the sandbox, take a screenshot beside the reference render; read draw-call counts near and far.

**Acceptance Scenarios**:

1. **Given** a mech spawned, **When** viewed up close, **Then** the silhouette and palette (orange armour, gunmetal, chrome, white shield decals, dark sensor glass) match the reference.
2. **Given** 14 mechs plus the other 16 robots in the harbor, **When** the frame is rendered, **Then** the global draw-call budget is not exceeded and a single mech costs at most 6 draw calls near and 2 far.

---

### User Story 2 - Slow wandering patrol, disciplined combat movement (Priority: P1)

Unaware, the mech walks slowly around its waypoints with heavy footsteps and scans. Once it detects the player (about 30 m) it moves like a soldier: accelerates and decelerates smoothly, turns at a limited rate, advances to a firing position 18-25 m from the player, strafes, and backs off if the player gets closer than about 8 m.

**Why this priority**: Core behaviour requested by the ticket.

**Independent Test**: Unit tests of the pure brain and motion functions; browser run measuring speeds and distances.

**Acceptance Scenarios**:

1. **Given** no detection, **When** patrolling, **Then** speed is about 1.5 m/s and never exceeds it.
2. **Given** the player at 30 m with line of sight, **When** detected, **Then** the mech is alerted (existing alert event) and closes to a distance in 18-25 m, with speed ramping up and down rather than snapping.
3. **Given** the player closer than 8 m, **When** deciding, **Then** the mech retreats while facing the player.
4. **Given** a turn demand of 180 degrees, **When** moving, **Then** yaw changes no faster than the turn-rate limit.

---

### User Story 3 - Telegraphed rocket salvos (Priority: P1)

In firing position the mech opens its missile cells (visible glow), then fires a salvo of 2-3 slow rockets, then cools down about 3 s. A rocket that hits the player or the world explodes with a 3 m splash.

**Why this priority**: The mech's only attack; must be readable and fair (pillar 1).

**Independent Test**: Unit test salvo/cooldown/splash maths; browser run counting rockets, damage and cooldown.

**Acceptance Scenarios**:

1. **Given** firing position and line of sight, **When** the telegraph (glow) completes, **Then** 2-3 rockets leave one after another at about 25 m/s.
2. **Given** a rocket explodes within 3 m of the player, **When** splash resolves, **Then** damage is about 12 at the centre and falls off to 0 at the radius.
3. **Given** the salvo ended, **When** within the cooldown, **Then** no new salvo starts.

---

### User Story 4 - Existing contracts keep working (Priority: P2)

Hit zones (head is critical, 2x), HP ~150, pooling, scheduler levels (dormant/simplified), defend-phase move orders, respawn memory reset, events and test hooks, population totals 14 / 10 / 6 all behave as before.

**Why this priority**: Regression safety for the merged game.

**Independent Test**: All existing unit and e2e files stay green.

**Acceptance Scenarios**:

1. **Given** a head shot, **When** damage resolves, **Then** it is doubled.
2. **Given** the mech dies, **When** destroyed, **Then** `enemy:destroyed` fires once and registry/colliders are released.

### Edge Cases

- Player out of sight mid-salvo: remaining rockets still fly; no new salvo until sight is regained.
- Rocket pool exhausted: the shot is skipped, never allocates.
- Player behind cover while mech wants a firing position: it advances along the nav path until line of sight.
- Mech cornered while retreating (blocked nav): it stands and fires instead of jittering.
- Dormant mech: coarse patrol only, no firing, no per-frame animation.
- Two mechs close together: separation still applies; rockets do not splash other robots.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The mech MUST replace the sphere robot under the same internal type id, with about 150 HP and a head critical zone (2x).
- **FR-002**: Visuals MUST reproduce the reference silhouette, palette and glowing parts, with generated textures created once and shared.
- **FR-003**: Static parts MUST be merged per material; a mech MUST cost at most 6 draw calls near and 2 far (LOD), and the global budget MUST hold with all 30 robots.
- **FR-004**: Patrol MUST be slow (~1.5 m/s) over waypoints with idle scanning and heavy footstep cues.
- **FR-005**: Detection range MUST be about 30 m.
- **FR-006**: Combat movement MUST accelerate/decelerate with bounded acceleration and a limited turn rate.
- **FR-007**: The mech MUST advance to a 18-25 m firing band, strafe there, and retreat when the player is under ~8 m.
- **FR-008**: The mech MUST fire salvos of 2-3 rockets (~25 m/s) with ~3 s cooldown, telegraphed by missile-cell glow before firing.
- **FR-009**: Rockets MUST be pooled, visible, and explode with ~3 m splash and ~12 damage at centre with falloff; an exhausted pool drops the shot.
- **FR-010**: The old sphere code, tunables block and tests MUST be removed inside the owned files and replaced by army equivalents; all numbers MUST live in tunables.
- **FR-011**: Existing events, hooks, scheduler levels, defend-phase orders, respawn reset and population counts MUST keep working; no per-frame allocation in AI/animation.

### Key Entities

- **Army mech**: enemy with state (patrol, advance, engage, retreat, destroyed), HP, velocity, yaw, salvo state.
- **Rocket**: pooled projectile with position, velocity, damage, splash radius.
- **Firing band**: preferred distance range to the player.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A mech is identifiable as the reference model in a side-by-side screenshot.
- **SC-002**: Near mech <= 6 draw calls, far <= 2; full harbor stays under the 350 budget.
- **SC-003**: Patrol speed 1.5 m/s (+-10 %); combat speed ramps over at least 0.5 s with no instantaneous velocity or yaw change.
- **SC-004**: After detection the mech settles in 18-25 m within 15 s on open ground and retreats when the player is under 8 m.
- **SC-005**: A salvo is 2-3 rockets, cooldown between salvos is at least 3 s, rocket speed 25 m/s (+-10 %), centre splash damage 12.
- **SC-006**: Typecheck, unit tests, build, smoke and every e2e file pass.

## Assumptions

- Internal id `sphere` is kept (T-23 renames it later); population stays 14.
- Rockets reuse the enemy projectile framework (a rocket kind is added there; it is owned by this ticket).
- Footstep and rocket sounds go through existing events (`enemy:attacked`, `vfx:spawn`); no new audio assets.
- Mech scale follows the reference (about 4 m tall with back cannons).
- Rocket splash hurts only the player.
