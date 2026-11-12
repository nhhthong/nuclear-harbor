# Feature Specification: TITAN-04 Boss Fight

**Feature Branch**: `T-15-boss-titan04` (worktree branch; spec dir is independent)

**Created**: 2026-11-12

**Status**: Draft

**Input**: docs/tickets/T-15-boss-titan04.md with GDD 9, 9.1-9.4, 5.4, 15.1, 15.2, 16 and REVIEW #2, #12.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Boss arrives and must be dismantled (Priority: P1)

When the last tower is activated, a 22 m four-legged robot drops onto the dock. The player must destroy four red weak points (500 HP each) before the core (4,000 HP) opens, then destroy the core to win.

**Why this priority**: It is the climax of the game; without it there is no victory.

**Independent Test**: Start with the boss flag, damage the weak points and core, watch the phase sequence end in defeat.

**Acceptance Scenarios**:

1. **Given** all towers are active (or boss flag set), **When** the event fires, **Then** the boss appears at the arena centre, announces itself, saves a checkpoint, and is invulnerable and passive for the awakening period.
2. **Given** the boss is hunting weak points, **When** the player damages armour or the core, **Then** no damage is dealt and the hit is reported as absorbed.
3. **Given** a weak point reaches 0 HP, **When** all four are destroyed, **Then** the core hatch opens, "core exposed" is announced and the phase changes.
4. **Given** the core is exposed, **When** it reaches 0 HP, **Then** a ~3 s collapse plays and defeat is announced exactly once.

---

### User Story 2 - Readable, avoidable attacks (Priority: P1)

The boss uses Heavy Cannon, Ground Slam and Missile Barrage. Each shows a danger marker for its telegraph time before hitting, and can be dodged.

**Why this priority**: Mandatory by the ticket; defines fight feel and fairness.

**Independent Test**: Force each attack and observe telegraph then impact; stand outside the danger area and take no damage.

**Acceptance Scenarios**:

1. **Given** the player is in range, **When** an attack is chosen, **Then** a telegraph announcement and visible marker precede the impact by the configured duration.
2. **Given** a Ground Slam, **When** the player stands on a perch above 3 m or outside the radius, **Then** the player takes no damage.
3. **Given** a Heavy Cannon shot, **When** world geometry blocks the path, **Then** the projectile detonates on it and cover protects the player.
4. **Given** Missile Barrage, **When** missiles land, **Then** only players inside a missile's splash radius are damaged.

---

### User Story 3 - Destroying weak points weakens the boss (Priority: P2)

Each destroyed weak point removes an ability strength: front slows Heavy Cannon, left/right reduce Missile Barrage count, rear shrinks Ground Slam radius. In core-exposed phase attacks speed up slightly.

**Why this priority**: Gives progress feedback and tactical choice (GDD 9.2).

**Independent Test**: Unit-test the attack scheduler parameters per destroyed weak point.

**Acceptance Scenarios**:

1. **Given** the front weak point is destroyed, **When** Heavy Cannon cooldown is computed, **Then** it is 1.5x the base.
2. **Given** the player moves around, **When** the boss turns slowly to face them, **Then** weak points rotate out of view, encouraging repositioning.

---

### Edge Cases

- Player dies mid-fight: on respawn attack timers reset, boss damage is kept.
- Hits arriving after a weak point is destroyed are ignored, with no events.
- Core damage in the same hit that kills the last weak point: the core does not take it.
- Projectile or missile pool exhausted: new attack projectiles are dropped, never allocated.
- Sandbox: boss is scaled to 0.4 and spawned at the sandbox position.
- Defeat triggered twice (duplicate hits): only one defeat event.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The boss MUST spawn at the boss arena centre on "all towers activated" or the boss query flag, with a 15 m sphere body, four legs and ~22 m overall height, and announce spawn plus a "boss-start" checkpoint.
- **FR-002**: Phases MUST progress dormant, awakening, weak-point hunt, core exposed, destroyed, each change observable as an event.
- **FR-003**: The boss MUST be invulnerable and not attack during the awakening period.
- **FR-004**: Four weak points (front, back, left, right) MUST have 500 HP each, show damage feedback (dimming/flicker), and announce damage and destruction.
- **FR-005**: Armour hits MUST deal zero damage; core hits before all weak points are destroyed MUST deal zero; both report absorbed. Destroyed weak points ignore hits.
- **FR-006**: Destroying all weak points MUST open the core hatch, announce core exposed and change the phase; the core has 4,000 HP and announces each hit.
- **FR-007**: Total boss HP budget MUST equal 2,000 + 4,000 (GDD 5.4).
- **FR-008**: Heavy Cannon, Ground Slam and Missile Barrage MUST each telegraph with a ground or body marker for the configured duration, then announce the attack, damage the player only within the danger area, and be avoidable.
- **FR-009**: Each destroyed weak point MUST weaken a defined ability (front: cannon cooldown x1.5; left/right: missile count -2 each; rear: slam radius -30%); core-exposed phase speeds attacks up slightly.
- **FR-010**: Projectiles and missiles MUST be pooled with a hard cap; the boss MUST stay inside the arena and keep roughly 20-35 m from the player, turning slowly towards them.
- **FR-011**: On defeat the boss MUST stop attacks, release projectiles, collapse for ~3 s, request a big explosion effect and announce defeat once.
- **FR-012**: The boss MUST be shootable (armour, weak point, core zones) through the shared damage contract, and expose test hooks for state, weak-point damage, core damage and forced attacks.
- **FR-013**: The boss MUST cost at most 25 draw calls and release all resources on dispose.
- **FR-014**: The start-with-core-exposed flag and sandbox scaling MUST work; respawn resets attack timers but keeps damage.

### Key Entities

- **Boss model**: pure combat state (phase, four weak-point HPs, core HP) returning events as data.
- **Attack scheduler**: pure cooldown/selection/timeline logic parameterised by destroyed weak points and phase.
- **Danger markers and projectiles**: pooled telegraph decals, cannon shots and missiles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The boss cannot be killed in any order of hits unless all four weak points are destroyed first (unit tests across hit sequences).
- **SC-002**: Each attack's warning is visible for exactly its configured duration before damage lands.
- **SC-003**: A player outside an attack's danger area takes 0 damage from it.
- **SC-004**: A full fight (four weak points then core) ends in exactly one defeat announcement.
- **SC-005**: The boss adds no more than 25 draw calls and the fight causes no growth in pooled objects beyond the cap.
- **SC-006**: Weak-point and attack-scaling rules pass automated unit tests; the full flow passes a browser check.

## Assumptions

- Optional attacks (Shockwave, Target Lock, EMP Pulse) are out of scope (cut list item 3).
- Countdown is already stopped when the boss appears (REVIEW #12); pressure comes from attacks.
- No cinematic camera in v1; controls may be locked up to 1.5 s during awakening.
- Heavy Cannon ground marker uses the player position predicted at telegraph start; weak-point ability mapping follows the ticket's suggestion.
- Boss visuals are procedural primitives; VFX, HUD and audio react via events only, and the boss draws its own danger markers.
- Perches above 3 m protect against Ground Slam (REVIEW #2).
