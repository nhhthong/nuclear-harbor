# Feature Specification: Grappling hook

**Feature Branch**: `worktree-agent-ac78139cf7f3cfab0` (spec dir `T-12-grappling-hook`)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "docs/tickets/T-12-grappling-hook.md: Space fires a hook along the view, 40 m range on grappleable surfaces, cable shown, pulled at 18 m/s with collision, release on Space/arrival/stuck/timeout/death, 1.0 s cooldown, clear failure state, perch anchors land the player on platforms (GDD 4.1, 7.4, REVIEW #2)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pull myself to a marked surface (Priority: P1)

The player aims at a marked grapple surface (pillar, beam, container edge) within range and presses Space. A hook flies out, a cable is drawn, and the player is reeled in at a constant speed, stopping when close.

**Why this priority**: Core traversal pillar; everything else builds on it.

**Independent Test**: In the sandbox, aim at the pillar anchor and press Space; the player rises above 8 m and the grapple releases automatically.

**Acceptance Scenarios**:

1. **Given** a marked surface within 40 m with clear line of sight, **When** Space is pressed, **Then** the hook attaches and the player is pulled at about 18 m/s towards it with a visible cable.
2. **Given** the player is being pulled, **When** the player gets within the release distance, **Then** the grapple releases (arrival) and the player keeps part of the pull momentum.
3. **Given** a wall between player and anchor, **When** pulling, **Then** the player cannot pass through it and the grapple releases as stuck.

---

### User Story 2 - Clear feedback when it cannot work (Priority: P1)

If the player fires at nothing, out of range, at an unmarked surface, or during cooldown, the grapple fails with an explicit reason and no pull.

**Why this priority**: The failure state must be clear (ticket goal, AC1, AC4).

**Independent Test**: Aim at the ground, press Space: `no-target`/`not-grappleable` failure; press again within 1 s of a release: `cooldown`.

**Acceptance Scenarios**:

1. **Given** nothing or only sky/out-of-range in view, **When** Space is pressed, **Then** a failure with reason `no-target` is reported.
2. **Given** an unmarked surface under the crosshair, **When** Space is pressed, **Then** a failure with reason `not-grappleable` is reported.
3. **Given** the grapple is cooling down, **When** Space is pressed, **Then** a failure with reason `cooldown` is reported; cooldown progress is reported at most 10 times per second.

---

### User Story 3 - Release on demand and be safe (Priority: P2)

The player can cancel a pull with a second Space press; death, leaving play, or timeout also release. Control is always handed back cleanly.

**Why this priority**: Prevents lock-in and stuck states.

**Independent Test**: Press Space twice while pulling; the pull stops, cooldown begins. Kill the player mid-pull; no pull velocity remains.

**Acceptance Scenarios**:

1. **Given** pulling, **When** Space is pressed again, **Then** release reason `manual` and the 1.0 s cooldown starts.
2. **Given** pulling for longer than the maximum pull time, **When** the time elapses, **Then** release reason `timeout`.
3. **Given** the player dies or the game leaves the playing state, **When** it happens, **Then** the pull ends and no override velocity remains.

---

### User Story 4 - Land on platforms and roofs (Priority: P2)

Grappling to a perch anchor leaves the player standing on the platform; grappling to the top edge of a container carries the player onto its roof.

**Why this priority**: Verticality (GDD 7.4, REVIEW #2) depends on it.

**Independent Test**: In the sandbox, grapple the perch anchor (player ends standing at about y = 8) and the stacked container (player ends on its roof).

**Acceptance Scenarios**:

1. **Given** a perch anchor with a landing point, **When** the player arrives, **Then** the player is placed standing on the landing point.
2. **Given** an ordinary container edge, **When** the player arrives, **Then** the aim point is slightly above the lip and the carried momentum puts the player on the roof.

---

### Edge Cases

- Centre ray misses or hits unmarked geometry but a registered anchor lies within a ~3 degree cone, in range, with line of sight: that anchor is used (aim assist).
- Robots, water and unmarked objects are never valid targets; walls occlude anchors behind them.
- Fire pressed in a non-playing state, while dead, or with controls locked: ignored.
- Press during an in-flight hook (before attach): treated as manual cancel.
- Module disposed while pulling: override velocity cleared, visuals released.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Pressing Space MUST fire along the view direction; a target is valid only if the first static-world hit is marked grappleable within 40 m.
- **FR-002**: Invalid attempts MUST fail with reason `no-target`, `not-grappleable` or `cooldown`, and report it as an event.
- **FR-003**: While attached the player MUST be pulled at 18 m/s (+-5%) towards the attach point with collision active.
- **FR-004**: The grapple MUST release on second Space press (`manual`), arrival, stuck, timeout and player death, always clearing the override velocity.
- **FR-005**: On arrival at an ordinary surface the player MUST keep a fraction of the pull velocity.
- **FR-006**: After any release (and after a failure, with a shorter allowed cooldown) a 1.0 s cooldown MUST apply, reported at most 10 Hz.
- **FR-007**: Perch anchors MUST leave the player standing on their landing point.
- **FR-008**: A hook head and cable MUST be shown while fired/attached, and a subtle crosshair indicator MUST show when a valid target is under the aim.
- **FR-009**: The state logic MUST be pure and unit-tested for every transition and failure reason.
- **FR-010**: No per-frame allocation while pulling; visuals MUST be disposed with the module.
- **FR-011**: Events `grapple:fired`, `attached`, `released {reason}`, `failed {reason}`, `cooldown {remaining,total}` and a test state accessor MUST be provided.

### Key Entities

- **Grapple state**: phase (ready, pulling, cooldown), cooldown remaining, current target.
- **Target**: attach point, optional anchor id, optional landing point.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Aimed at the sandbox pillar from spawn, the player rises above 8 m within 3 s and is released automatically.
- **SC-002**: Measured pull speed is within 5% of 18 m/s.
- **SC-003**: Every failure reason and release reason is demonstrated by a test.
- **SC-004**: After a perch grapple the player stands on the platform (height about 8 m) and is not falling.
- **SC-005**: The pull never leaves the player with a lingering override after release, death or disposal.

## Assumptions

- Tunables (range, speed, cooldown, release distance, momentum, stuck and timeout values) already exist as shared grapple settings; extra feature-local values live with the feature.
- No swinging or hanging in v1 (REVIEW #2).
- Failure cooldown is shorter than the success cooldown; the exact value is a feature-local setting.
- Visuals are simple (hook mesh, thin cable, DOM crosshair tint); no audio or HUD changes are made here.
- The sandbox pillar, perch and stacked container serve as test beds.
