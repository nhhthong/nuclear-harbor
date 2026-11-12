# Feature Specification: Game flow, level population and vertical slice

**Feature Branch**: `T-16-game-flow-integration` (spec dir only; no branch created)

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "docs/tickets/T-16-game-flow-integration.md plus GDD 3, 4.2, 8.2, 9.3, 6, 6.3, 5.4, 15.1, 16, 17.8 and REVIEW #6, #7."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete a run: start, four towers, boss, victory (Priority: P1)

A player starts a run at the warehouse, activates four towers, which stops the countdown and wakes the boss, destroys the boss weak points and core, and sees a victory result. The best result is remembered for later runs.

**Why this priority**: This is the product. Without a closed loop the modules are only demos.

**Independent Test**: Scripted run in the real harbor: activate towers, damage boss, observe victory and stored best result.

**Acceptance Scenarios**:

1. **Given** a running harbor game, **When** all four towers are activated and the boss is defeated, **Then** about three seconds after the defeat the game shows victory with the time remaining.
2. **Given** a victory, **When** the result is shown, **Then** the best time remaining and a "completed" flag are stored locally and can be read back.
3. **Given** a victory or game over screen, **When** the player asks to restart, **Then** a fresh run begins (tower, robot and boss state reset).

---

### User Story 2 - Die and continue from a checkpoint (Priority: P1)

When the player dies they see Game Over and may respawn at the last checkpoint (last activated tower, boss start, otherwise the level spawn) with full health. The countdown keeps running; destroyed robots, activated towers and boss damage persist.

**Why this priority**: Failure must be recoverable without losing the whole run (REVIEW #7).

**Independent Test**: Kill the player via damage, request respawn, compare position, HP, countdown and persistent state.

**Acceptance Scenarios**:

1. **Given** the player died, **When** respawn is requested, **Then** the player stands at the latest checkpoint with full HP, the game is playing again, and the countdown value did not jump back.
2. **Given** no checkpoint was reached, **When** the player respawns, **Then** they return to the level spawn.
3. **Given** the player is alive and playing, **When** a respawn is requested, **Then** nothing happens.

---

### User Story 3 - Nuclear failure when time runs out (Priority: P1)

If the countdown reaches zero the run ends with a failure and no respawn option; only restart is offered.

**Why this priority**: Gives the run its pressure and a hard fail state (GDD 8.2).

**Independent Test**: Start with a 3-second countdown and observe game over with reason countdown-expired, then confirm respawn requests are ignored.

**Acceptance Scenarios**:

1. **Given** a running countdown, **When** it expires, **Then** the game is over with reason countdown-expired.
2. **Given** that failure, **When** respawn is requested, **Then** it is refused.

---

### User Story 4 - A populated, supplied harbor (Priority: P2)

The harbor holds exactly 14 sphere, 10 spider and 6 charger robots at authored, reachable positions: chargers mostly on the straight yard lanes, nothing within 40 m of the spawn, tower 1 lightly guarded and tower 4 heaviest. Ammo crates (14 in zones, 8 at the boss arena) and medkits (10 and 3) sit near robot areas and towers, several on container tops that need the grapple.

**Why this priority**: Makes the level playable and the ammo economy testable.

**Independent Test**: Unit tests on the placement data plus a browser check of live robot and pickup counts.

**Acceptance Scenarios**:

1. **Given** a harbor boot, **When** robots spawn, **Then** counts are 14/10/6, every spawn and patrol point is walkable, none is within 40 m of the spawn.
2. **Given** the placement data, **When** counted, **Then** crates and medkits match the economy and at least three need the grapple.

---

### User Story 5 - Vertical slice in the sandbox (Priority: P2)

In the sandbox the full loop (move, shoot, grapple, sphere, charger, one tower, crate, boss) can be played and scripted end to end.

**Why this priority**: Gate before content scale-up (GDD 15.1).

**Independent Test**: Scripted sandbox run with zero console errors.

**Acceptance Scenarios**:

1. **Given** the sandbox with a sphere and a charger, **When** the single tower activates and the boss is destroyed, **Then** the game reaches victory with no console errors.

---

### User Story 6 - Honest playtest record (Priority: P3)

A playtest document records measured ammo budget, time to complete, robot counts, problems and proposed tuning changes, with screenshots described honestly.

**Independent Test**: Document exists and its numbers come from measured runs.

**Acceptance Scenarios**:

1. **Given** the finished build, **When** the document is read, **Then** it lists ammo needed vs supplied, completion time, integration issues with owning tickets and tuning proposals.

### Edge Cases

- Death and countdown expiry in the same tick: the first event wins; later events are ignored.
- Boss defeated while the player is dead or the countdown expired earlier: ignored once the run has ended; after a defeat the victory stands: a player death or countdown expiry during the collapse delay is ignored.
- Duplicate or repeated events (second `boss:defeated`, second death) change nothing.
- Respawn request in states other than game over by death is ignored.
- Local storage unavailable: victory still works, storing is skipped.
- A planned spawn point falls on a blocked cell: warn and move it to the nearest walkable cell.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Player death MUST end the run as game over with reason player-died, with respawn allowed.
- **FR-002**: Respawn MUST return the player at the latest checkpoint (default: level spawn) with full health, announce it, resume play, and leave the countdown, robots, towers and boss state untouched.
- **FR-003**: Countdown expiry MUST end the run as game over with reason countdown-expired and MUST refuse respawn.
- **FR-004**: Boss defeat MUST lead to victory after a short collapse delay and report the time remaining.
- **FR-005**: Once the run has ended, further outcome events MUST be ignored.
- **FR-006**: The latest checkpoint announced by other systems MUST be remembered; a restart request MUST begin a fresh run.
- **FR-007**: Victory MUST store the best time remaining and a completed flag locally; failures of storage MUST NOT break the game.
- **FR-008**: The run MUST track time, kills and shots/hits for accuracy, exposed for inspection.
- **FR-009**: The harbor MUST contain exactly 14 spheres, 10 spiders and 6 chargers on reachable cells, honouring the per-zone distribution, with most chargers on yard lanes and none within 40 m of the spawn; tower 1 lightly guarded, tower 4 heaviest.
- **FR-010**: Pickup placements MUST total 14 + 8 crates and 10 + 3 medkits and include at least three elevated spots reachable by grapple.
- **FR-011**: The sandbox slice and the harbor full run (success, death-respawn, countdown failure) MUST be covered by scripted browser checks with no console errors.
- **FR-012**: A playtest document MUST record ammo budget, completion time, counts, issues (with owning ticket) and tuning proposals.

### Key Entities

- **Checkpoint**: id, position, facing; latest one wins; default is the level spawn.
- **Run**: state (in progress, over by death, over by expiry, won), statistics (time, kills, shots, hits).
- **Spawn plan**: robot type, start position, patrol loop.
- **Pickup candidate**: kind, zone, position, elevated flag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A scripted run reaches victory from start through all four towers and the boss in the harbor with zero console errors.
- **SC-002**: After death the respawn happens with full health in 100% of scripted attempts, with the countdown within one second of its pre-death value.
- **SC-003**: A 3-second countdown always ends in a failure screen without a respawn option.
- **SC-004**: Robot counts are exactly 14/10/6 and pickups exactly 22 crates and 13 medkits in every boot.
- **SC-005**: The playtest document contains measured numbers and at least two screenshots described.

## Assumptions

- Restart reloads the page (keeps the query string); in-place restart is deferred to T-17.
- Victory delay after boss defeat is 3 s (ticket default).
- Checkpoint positions are provided by objectives and boss systems; flow only stores them.
- Best result key: `nuclear-harbor.best.v1`; a better result has more time remaining.
- Respawn is allowed only after a death-caused game over (REVIEW #7); the countdown is not reset.
- Foundation and other modules' files are read-only; integration defects are reported, not fixed.
