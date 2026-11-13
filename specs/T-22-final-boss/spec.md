# Feature Specification: Final Boss Refresh (spherical walker)

**Feature Branch**: `T-22-final-boss` (worktree branch; spec dir is independent)

**Created**: 2026-11-13

**Status**: Draft

**Input**: Section "T-22 Final boss" of docs/tickets/ROBOT-REFRESH.md, reference model docs/reference-models/final_boss.html, GDD 9 and 7.4, specs/T-15-boss-titan04.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The boss falls from the sky (Priority: P1)

After the fourth tower is activated, the player loses control for a short cinematic: the camera leaves the player, looks at the sky, follows a glowing giant falling with speed streaks, and watches it crash onto the dock with a shockwave, dust, shaking and a roar, under letterbox bars and a title card. Then control returns and the fight starts.

**Why this priority**: It is the climax introduction and the main new feature.

**Independent Test**: Fire the "all towers activated" event, observe the cinematic state, skip or let it finish, and check the boss stands on the arena and the phase is weak-point hunt.

**Acceptance Scenarios**:

1. **Given** all towers are active, **When** the event fires, **Then** the cinematic starts (about 6 s), the player cannot move, look, shoot or be hurt, and bars plus title card show.
2. **Given** the cinematic runs, **When** the player presses E before 2 s, **Then** nothing happens; after 2 s it ends at once with the boss already landed.
3. **Given** the cinematic ends (by time or skip), **When** control returns, **Then** the boss is standing, the weak-point phase is active and the player is not overlapped by the boss.
4. **Given** the player stands in the arena, **When** the landing spot is chosen, **Then** it is an empty spot clear of the player and of other robots and props.

---

### User Story 2 - A boss taller than the warehouse, hurt only at its lights (Priority: P1)

The boss is a spherical walker with four legs, red and white armour, a glowing orange eye and orange knee lights, about 18 m tall (warehouse is 10 m). Only shots on the four knee lights hurt it (500 HP each); armour gives sparks but no damage. When all four lights are destroyed the eye opens and takes damage (4,000 HP) until defeat.

**Why this priority**: Core fight rule (GDD 9.2, 9.3).

**Independent Test**: Hit armour, eye, then each knee light; check absorbed/dealt values and phase sequence.

**Acceptance Scenarios**:

1. **Given** the hunt phase, **When** armour or the eye is shot, **Then** no damage is dealt and the hit is reported absorbed.
2. **Given** a knee light reaches 0 HP, **When** all four are gone, **Then** the eye opens and core-exposed is announced.
3. **Given** the eye is exposed, **When** it reaches 0 HP, **Then** the boss collapses and defeat is announced exactly once.

---

### User Story 3 - Readable attacks (Priority: P2)

Heavy Cannon, Ground Slam and Missile Barrage keep their telegraph, damage and avoidability; destroyed knee lights weaken abilities as before.

**Independent Test**: Force each attack and check telegraph then impact.

**Acceptance Scenarios**:

1. **Given** the hunt phase, **When** an attack starts, **Then** a marker and telegraph event precede the impact by the configured time.

### Edge Cases

- Player stands near the arena centre: the landing spot moves away so footprints never overlap.
- No clear spot exists: the least-bad spot farthest from the player is used.
- Skip pressed twice or after the end: ignored.
- Pause during the cinematic: it does not advance.
- Player dies/respawns later: timers reset, boss damage kept.
- `?sandbox`: boss scaled down, cinematic still works.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The boss MUST look like the reference spherical walker (shell plates, red stripes, eye, four legs with armour, knee lights, hydraulics) and be about 18 m tall.
- **FR-002**: The boss MUST use at most 40 draw calls and share generated textures (created once).
- **FR-003**: Damage MUST only be possible through the four knee lights (500 HP each) and then the eye (4,000 HP); armour deals zero and shows spark feedback.
- **FR-004**: The boss MUST appear only after all towers are activated (or the `?boss` dev flag).
- **FR-005**: It MUST land on an empty spot inside the boss arena chosen by a pure, testable rule that avoids the player, robots and props.
- **FR-006**: A cinematic of about 6 s MUST show sky, descent with speed streaks and glow, impact shockwave ring, dust, camera shake, roar, letterbox bars and title card.
- **FR-007**: During the cinematic the player input MUST be locked and the player invulnerable; both released afterwards.
- **FR-008**: The cinematic MUST be skippable with E after 2 s and fast-forwardable through a test hook.
- **FR-009**: Weak-point hunt MUST start when the cinematic ends; the boss does not attack before.
- **FR-010**: Heavy Cannon, Ground Slam and Missile Barrage MUST keep telegraphs and ability-loss rules.
- **FR-011**: Existing boss events, test hooks and the full-run flow (four towers, boss, victory) MUST keep working.

### Key Entities

- **Weak point**: knee light, index 0..3, 500 HP.
- **Core**: central eye, 4,000 HP, exposed after four weak points die.
- **Cinematic**: timed sequence with phases (sky, descent, impact, title, release).
- **Landing spot**: ground point in the arena with clearance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Boss stands visibly above the 10 m warehouse (about 18 m).
- **SC-002**: The cinematic lasts about 6 s and ends sooner when skipped after 2 s.
- **SC-003**: The player is never overlapped by the landed boss, in 100% of tested player positions.
- **SC-004**: The boss costs no more than 40 draw calls.
- **SC-005**: A full run from four towers to victory still completes.

## Assumptions

- Internal ids and the name TITAN-04 stay; the HUD boss panel appears at impact.
- Audio roar reuses the existing boss spawn sound, emitted at impact.
- Numbers (height, timings) live in the boss module's tunables.
- "Props" means other robots and static world objects found by a downward probe; the arena is a keep-clear disc.
