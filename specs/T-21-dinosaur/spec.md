# Feature Specification: Dinosaur semi-boss (Mecha T-Rex)

**Feature Branch**: `worktree-agent-a0e6d6ab0bcf8412c` (spec dir `specs/T-21-dinosaur`)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "T-21 Dinosaur semi-boss: ~9 m Mecha T-Rex (docs/reference-models/dinosaur_semi_boss.html), HP ~1500, not part of the 30-robot count; guards 2 random towers (seeded, ?seed=); spawns when the player first comes within ~35 m; 3 telegraphed skills (ram, tail spin, leap + stomp); drops ammo and medkit; draw calls <= 25."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Meet a guardian at a tower (Priority: P1)

At the start of a run two of the four towers are secretly picked. When the player first walks within about 35 m of one of them, a giant red mecha T-Rex materialises with a roar and a camera shake, and from then on it guards that tower until it is killed.

**Why this priority**: it is the feature's whole identity; without it nothing else matters.

**Independent Test**: boot with a fixed seed, teleport the player near each tower, check that exactly the two seeded towers produce a dinosaur and that the other two do not.

**Acceptance Scenarios**:

1. **Given** a run with seed S, **When** the same seed is used again, **Then** the same two distinct towers are chosen.
2. **Given** a chosen tower, **When** the player is farther than 35 m, **Then** no dinosaur exists; **When** the player first comes within 35 m, **Then** a dinosaur spawns once, with roar, shake and a spawn-in effect.
3. **Given** a spawned dinosaur, **When** the player leaves, **Then** it stays near its tower and persists until killed.
4. **Given** an unchosen tower, **When** the player stands next to it, **Then** nothing spawns.

---

### User Story 2 - Fight it (Priority: P1)

The dinosaur is about 9 m tall with about 1500 HP. Any hit hurts it; the head takes double damage. It uses three clearly telegraphed skills chosen by distance and cooldown, so a careful player can dodge each.

**Why this priority**: the fight is the gameplay value.

**Independent Test**: unit tests for skill choice, damage falloff and timings; e2e drives each skill and measures telegraph time, damage and radius.

**Acceptance Scenarios**:

1. **Given** the player far away, **When** the dinosaur picks a skill, **Then** it rams: a locked-direction charge (about 25 damage), stunned if it hits a wall.
2. **Given** the player at mid range, **Then** it leaps to the player's position and its landing shockwave hurts within about 8 m (about 30 damage, falling off with distance) and briefly stuns the dinosaur.
3. **Given** the player close, **Then** it spins its tail through a ring of about 9 m (about 20 damage, brief window).
4. **Given** any skill, **Then** a visible and audible telegraph of at least 0.8 s precedes the damage.
5. **Given** a shot on the head, **Then** damage is 2x; a shot anywhere else registers as normal damage.

---

### User Story 3 - Reward (Priority: P2)

Killing the dinosaur drops ammo and a medkit where it fell, which the player can collect.

**Why this priority**: keeps the ammo budget fair (GDD 5.4) and rewards the risk.

**Independent Test**: kill it via damage; pickups appear and can be collected.

**Acceptance Scenarios**:

1. **Given** the dinosaur dies, **Then** ammo and a medkit appear near its body and collecting them grants ammo and health.

### Edge Cases

- The player dies and respawns: a spawned dinosaur keeps its HP and returns to guard its tower; an unspawned one stays unspawned.
- The player stands on tower 3's elevated gantry (y = 10): distance is measured horizontally.
- Both dinosaurs alive at once must not exceed the draw-call budget.
- The charge hits a wall or container: dinosaur stunned; leap lands on blocked ground: it lands at the nearest free spot.
- Sandbox: a fixture can spawn one for testing; the normal 30-robot population and the full-run flow are unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST choose 2 distinct towers out of 4 at run start with a seeded random generator, honouring a `?seed=` query parameter, deterministic for a given seed.
- **FR-002**: A dinosaur MUST spawn once, the first time the player is within the trigger radius (about 35 m, horizontal) of a chosen tower, with roar, camera-shake event and a short spawn-in effect.
- **FR-003**: The dinosaur MUST guard its tower (stay within a leash radius), persist until killed, and never be counted in the 30-robot population totals.
- **FR-004**: The dinosaur MUST be about 9 m tall, have about 1500 HP, take damage from hits anywhere, and take 2x damage on the head.
- **FR-005**: The dinosaur MUST have three skills, each telegraphed for at least 0.8 s: ram/charge (about 25 damage, locked direction, stun on wall hit), tail spin (about 9 m radius, about 20 damage, brief window), leap + stomp (about 8 m radius, about 30 damage with falloff, dust, brief dinosaur stun).
- **FR-006**: Skill choice MUST depend on distance and cooldowns: ram far, leap mid, tail spin close.
- **FR-007**: On death the dinosaur MUST drop ammo and a medkit.
- **FR-008**: The look MUST follow the reference model (red armour, dark metal, glowing orange core/eyes/tail spines, 11-segment tail, small arms, toothed jaw), built from merged geometry with at most 25 draw calls per dinosaur, shared materials, no per-instance textures.
- **FR-009**: All damage, radius, timing and range numbers MUST be tunables in the module's own tunables file.
- **FR-010**: Existing contracts (events, damage interfaces, hit zones, resource scope disposal, fixed 60 Hz step) MUST be preserved and no existing test or end-to-end flow may break.

### Key Entities

- **Dinosaur**: guardian with HP, state (spawning, guard, chase, telegraph, executing, stunned, dead), assigned tower.
- **Guard assignment**: the seeded choice of 2 towers.
- **Skill**: ram, tail spin or leap stomp, with telegraph time, damage, radius, cooldown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The same seed yields the same two guarded towers in 100% of runs; different seeds produce varied pairs.
- **SC-002**: Players always get at least 0.8 s of visible warning before any dinosaur damage.
- **SC-003**: A kill requires about 60 body hits (about 30 with all-head hits), and drops compensate the ammo spent at the GDD's assumed accuracy.
- **SC-004**: One dinosaur adds at most 25 draw calls and the scene stays under the global 350 limit.
- **SC-005**: The 30-robot totals and the full-run test pass unchanged.

## Assumptions

- Towers are the four in the level contract; the seed is random when `?seed=` is absent.
- The dinosaur is a separate gameplay module and does not register as one of the three existing robot types.
- Drops are spawned by the dinosaur module itself because the pickups module has no guaranteed-drop request (foundation request recorded).
- Camera shake is applied by the dinosaur module as a small camera offset, as no shared shake service exists.
- Balance numbers are starting values to be playtested.
