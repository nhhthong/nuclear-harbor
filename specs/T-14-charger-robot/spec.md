# Feature Specification: Charger robot (shielded rhino)

**Feature Branch**: `T-14-charger-robot` (spec dir only; no branch created)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "docs/tickets/T-14-charger-robot.md plus GDD 6.3, 5.4, 13.7, 16, 15.2"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dodge a telegraphed charge (Priority: P1)

The player sees a heavy shielded robot turn to face them, flash red lights, and a red strip appears on the ground along its path. One second later it rushes in a straight line. The player sidesteps and it runs past.

**Why this priority**: This is the Charger's core threat and the reason it exists (forces movement).

**Independent Test**: Place the player 15 m in front of a Charger in the sandbox; observe wind-up then charge ~1 s later; step aside and verify the direction did not change and no damage was taken.

**Acceptance Scenarios**:

1. **Given** the player is 8-25 m away with line of sight and the cooldown elapsed, **When** the Charger decides to attack, **Then** it winds up for 1.0 s with red lights, a wind-up event and a red ground strip whose length equals the planned charge distance.
2. **Given** a charge has started, **When** the player moves sideways, **Then** the charge direction stays locked and speed stays within 10-12 m/s for at most 30 m.
3. **Given** the player is hit by the charging robot, **When** contact occurs, **Then** the player takes 20 damage once per charge and is knocked back.

---

### User Story 2 - Lure it into a wall and punish its back (Priority: P1)

The player lets the Charger smash into a wall or container. It is stunned for 2.5 s with its rear exposed, and shots from behind do double damage while frontal shots barely scratch it.

**Why this priority**: The counter-play loop defined by the GDD.

**Independent Test**: Step aside so the charge hits the sandbox wall; verify stunned state ~2.5 s and that a rear hit deals 50 versus 2.5 from the front for a 25-damage shot.

**Acceptance Scenarios**:

1. **Given** a charge, **When** it hits a wall or container, **Then** the Charger stops, is stunned 2.5 s and a stunned event is emitted.
2. **Given** any time, **When** a hit arrives within the frontal arc, **Then** damage is reduced by 90% (armor zone).
3. **Given** any time, **When** a hit arrives from the flanks or rear, **Then** damage is doubled (critical zone).

---

### User Story 3 - Never falls off the harbor (Priority: P2)

A charge aimed towards the dock edge stops before the edge and the robot recovers on land.

**Why this priority**: Prevents broken game states; required safety.

**Independent Test**: Unit-test the planner with edge probes; browser check with a charge towards the slab edge.

**Acceptance Scenarios**:

1. **Given** the planned line crosses missing ground, **When** the charge runs, **Then** it ends before the edge and enters recover.

### Edge Cases

- Player out of the 8-25 m window, without line of sight, or cooldown not elapsed: no charge starts.
- Player dies or leaves during wind-up: the charge still locks and runs its planned course.
- Tower-defence move order during wind-up/charge/stunned is deferred.
- Obstacle right in front at charge start: the plan has near-zero distance and ends immediately.
- Robot destroyed mid-charge: strip hidden, nothing keeps moving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Charger MUST have 200 HP, walk at 3 m/s, patrol waypoints and detect the player within 25 m with line of sight.
- **FR-002**: A charge MUST start only when distance is 8-25 m, line of sight exists and the ~6 s cooldown has elapsed.
- **FR-003**: Each charge MUST be preceded by a 1.0 s telegraph: red lights ramping up, a wind-up event, and a red ground strip of the planned length. The robot keeps turning towards the player during wind-up.
- **FR-004**: The charge direction MUST be locked when the charge starts and never steered; speed MUST be 10-12 m/s; distance at most 30 m.
- **FR-005**: Hitting a wall or container MUST stop the charge, stun for 2.5 s and emit a stunned event with a visual effect request; reaching max distance or the edge MUST enter a recover phase.
- **FR-006**: The Charger MUST never leave land or drop off the dock/slab edge while charging.
- **FR-007**: Contact with the player during a charge MUST deal 20 damage once per charge, apply knockback and emit a hit event; the charge then continues to its planned end.
- **FR-008**: Hits within the frontal arc MUST be reduced by 90% (zone armor); hits from flanks/rear MUST be doubled (zone critical); the final zone is returned to the shooter. The robot does not turn while stunned.
- **FR-009**: While winding up or charging the robot MUST be updated at the high AI rate regardless of distance.
- **FR-010**: Move orders MUST be deferred during wind-up, charge and stunned.
- **FR-011**: The robot MUST be visually distinct: low wide body, angled front shield, glowing rear vent (brighter while stunned), side lights; shared geometry/materials.
- **FR-012**: Charge planning, start conditions and hit-zone selection MUST be pure and unit tested.

### Key Entities

- **Charger robot**: enemy with states patrol, detect, windup, charge, stunned, recover, destroyed.
- **Charge plan**: locked direction, maximum distance, end reason (wall, edge or range).
- **Telegraph strip**: one flat red ground marker per Charger showing the planned path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players always get 1.0 s of visible warning before a charge begins.
- **SC-002**: Across repeated charges at the dock and sandbox, the Charger is never found outside the land area.
- **SC-003**: A frontal 25-damage shot deals 2.5 and a rear one deals 50, every time.
- **SC-004**: A wall impact leaves the Charger stunned for 2.5 s (within one tenth of a second).
- **SC-005**: Dodging sideways at the moment the charge begins avoids all damage.

## Assumptions

- Wind-up wording: track during wind-up, lock at charge start (ticket note).
- Cooldown of ~6 s is folded into recover/detect.
- Frontal arc half-angle 60 degrees; knockback numbers from the shared tunables.
- Depends on the enemy framework (T-05) and shared damage helpers; foundation files stay unchanged.
- Audio and visual effects hook in through existing events; this feature only emits them.
