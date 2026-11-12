# Feature Specification: Spider Robot

**Feature Branch**: `T-13-spider-robot` (spec dir is independent of branch)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "docs/tickets/T-13-spider-robot.md: replace the spider placeholder with a six-legged walker with procedural leg animation that patrols, flanks the player, chases, attacks at close range and hops low obstacles (GDD 6.2, 6.4, 13.7, 16 Enemies)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flanking attacker (Priority: P1)

As a player, I meet spider robots that spot me from far away, circle to my side rather than running straight at me, then close in and shoot at short range, so that fights with several spiders force me to move and watch multiple angles.

**Why this priority**: This is the core combat identity of the enemy (GDD 6.2) and the reason it differs from the sphere robot.

**Independent Test**: Spawn one spider in the sandbox, place the player within 30 m with line of sight; observe the spider alert, enter the flank behaviour, then the attack behaviour, and reduce the player's health in 12-point hits.

**Acceptance Scenarios**:

1. **Given** a patrolling spider and a player 30 m or closer with line of sight, **When** the spider notices the player, **Then** it announces an alert and starts moving to a point at the player's side.
2. **Given** two spiders alerted by the same player, **When** they choose flank sides, **Then** they choose opposite sides.
3. **Given** a spider within 12 m of the player with line of sight, **When** it attacks, **Then** it strafes slowly and fires bursts at a fixed interval, each hit costing the player 12 health.
4. **Given** a spider that has lost sight of the player for the lose-target time, **When** that time elapses, **Then** it stops attacking and returns to chasing the last known position or patrolling.

---

### User Story 2 - Terrain-aware movement (Priority: P2)

As a player, I see spiders walk around containers and hop over low obstacles, never stepping off the land, so they feel like physical machines in the harbor.

**Why this priority**: Believable navigation prevents exploits and visual breakage but follows after combat behaviour.

**Independent Test**: Place a spider behind an obstacle of at most 1 m with a walkable landing; verify it hops (state `hop`) and lands on walkable ground; verify taller obstacles are routed around.

**Acceptance Scenarios**:

1. **Given** a path segment blocked only by an obstacle lower than 1 m with a walkable landing cell, **When** the spider reaches it, **Then** it performs a short arc jump (about half a second) and continues.
2. **Given** an obstacle taller than 1 m or no walkable landing, **When** the spider navigates, **Then** it paths around and never hops.
3. **Given** any movement, **Then** the spider never ends up over non-walkable (water) cells.

---

### User Story 3 - Legged look and cheap animation (Priority: P3)

As a player, I see six two-segment legs stepping in an alternating gait while the spider moves and resting when it is idle; distant spiders cost almost nothing.

**Why this priority**: Visual polish and performance budget.

**Independent Test**: Move a spider and verify feet alternate in two groups; set far simulation levels and verify legs are static or skipped while health and state persist.

**Acceptance Scenarios**:

1. **Given** a moving spider at full simulation level, **Then** its six feet step in two alternating groups of three.
2. **Given** an idle spider, **Then** its feet are at rest.
3. **Given** a spider at reduced or dormant simulation level, **Then** leg animation is simplified or skipped while HP and behaviour state are preserved.
4. **Given** many spiders, **Then** they share geometry and materials and the gait update causes no per-frame allocations.

---

### User Story 4 - Destructible with weak point (Priority: P2)

As a player, shooting the sensor dome deals double damage; killing a spider announces its destruction and frees its resources.

**Why this priority**: Required for weapon feedback and wave/objective counting.

**Independent Test**: Damage the dome and body with equal damage and compare; destroy and check event and cleanup.

**Acceptance Scenarios**:

1. **Given** a spider with 150 health, **When** the dome is hit, **Then** damage is doubled relative to a body hit.
2. **Given** lethal damage, **Then** the destruction event is emitted once, the spider is removed from the registry and its visuals and colliders are released.

### Edge Cases

- Flank point lands on a blocked or water cell: snap to the nearest walkable cell.
- Player moves far from the flank point while flanking: switch to chase.
- Player dies: spiders stop attacking and return to patrol.
- Spider has no patrol waypoints: stands idle with legs at rest.
- Spiders crowd the same place: separation from the framework applies.
- Defend-phase move orders from the framework: spider walks to the target, still engages the player.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Spider MUST have 150 HP, move at 5 m/s when chasing/flanking (reduced speed when patrolling), detect the player within 30 m with line of sight, and attack within 12 m for 12 damage per hit through the shared enemy projectile pool.
- **FR-002**: Spider MUST expose states `patrol`, `flank`, `chase`, `attack`, `hop`, `destroyed` and the type `spider`.
- **FR-003**: On detection the spider MUST emit an alert once and choose a flank side, alternating sides between spiders; the flank point lies at the flank distance from the player at the flank angle off the player's facing, snapped to a walkable cell.
- **FR-004**: Flank ends in chase when the flank point is reached or the player moves far from where it was computed; chase becomes attack within attack range with line of sight; losing sight for the lose-target time returns to chase/patrol.
- **FR-005**: Spider MUST follow nav paths and perform a short hop only when the direct segment is blocked solely by an obstacle below the hop height limit and the landing cell is walkable.
- **FR-006**: Spider MUST show a flat body with a sensor dome and six two-segment legs animated in two alternating groups of three; legs have no colliders.
- **FR-007**: Leg animation MUST run fully at active simulation level, be simplified at simplified level and skipped at dormant level, without losing HP or state.
- **FR-008**: Body hits are normal damage; sensor dome hits are critical (2x). Destruction emits the standard destroyed event and frees resources.
- **FR-009**: Decision logic and flank-point computation MUST be pure functions covered by unit tests.
- **FR-010**: All spiders MUST share geometry and materials; the gait update MUST not allocate per frame.
- **FR-011**: The spider MUST keep the existing factory export so the framework spawns it unchanged.

### Key Entities

- **Spider robot**: enemy with HP, state, flank side, patrol loop, six legs.
- **Leg**: two segments, home offset, foot target, stepping flag, tripod group.
- **Flank point**: walkable ground point beside the player.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the sandbox, a spider with the player within range reaches flank then attack and lowers player health in multiples of 12 within 20 seconds.
- **SC-002**: Two spiders alerted together pick opposite sides in 100% of trials.
- **SC-003**: Obstacles up to 1 m with landing are crossed; taller ones never; zero off-land positions across a long patrol soak.
- **SC-004**: Six legs visibly alternate while moving and rest when idle; far spiders add no leg animation cost.
- **SC-005**: Dome hits deal exactly double body hits; destruction leaves zero enemies registered and no console errors.
- **SC-006**: Pure logic tests pass and the full build, smoke and browser checks stay green.

## Assumptions

- Foundation enemy framework (base class, nav grid, projectile pool, scheduler, shared assets) is available and unchanged; missing hooks are recorded in foundation-requests.md.
- Hop-height probing uses short world rays; patrol speed is 60% of full speed (proposed).
- Flank side alternates through a module-level counter so groups split.
- Tuning numbers come from the shared spider tunables; extra local numbers live in the spider folder.
- Only files in the spider folder, its e2e test and this spec folder are changed.
