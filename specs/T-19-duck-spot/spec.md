# Feature Specification: Bomber Duck + Spot dog (T-19)

**Feature Branch**: `T-19-duck-spot` (worktree branch; spec dir is explicit)

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Replace the Charger (id `charger`) with the Bomber Duck and the Spider (id `spider`) with the Spot dog, ported from docs/reference-models/bomber_duck.html and spot_robot.html. Source: docs/tickets/ROBOT-REFRESH.md section T-19, GDD 6.2/6.4/13."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bomber Duck forces the player to react (Priority: P1)

A purple rubber-duck robot patrols. When it notices the player it bounces toward them faster than they walk but slower than they sprint. Close up it stops, flashes and beeps a 3-2-1 countdown, then blows up. The player can run away, or shoot it dead first.

**Why this priority**: it is the replacement for the Charger, a protected content item (GDD cut list: Charger must stay), and the key telegraph moment of the pillar "readable enemies".

**Independent Test**: spawn one duck in `?sandbox`, stand 12 m away: it hops closer, arms at about 2.5 m, counts 3-2-1 (one second each) and detonates; HP lost is exactly 15 inside the blast radius and 0 outside.

**Acceptance Scenarios**:

1. **Given** a patrolling duck and the player in view, **When** it detects the player, **Then** it moves toward the player in parabolic hops at a speed between walk (5 m/s) and sprint (7.5 m/s).
2. **Given** the duck is within about 2.5 m, **When** it arms, **Then** a visible flashing light and a ground blast-radius ring show, a beep event fires at 3, 2 and 1, and the explosion happens 3 s after arming.
3. **Given** the countdown reached zero and the player is inside the blast radius, **When** it explodes, **Then** the player loses exactly 15 HP and the duck is destroyed with an explosion effect.
4. **Given** the countdown reached zero and the player is farther than the blast radius, **When** it pops, **Then** no damage is dealt.
5. **Given** the duck is armed, **When** the player kills it before zero, **Then** no explosion damage occurs (small pop only).

---

### User Story 2 - Spot dog dashes and rams (Priority: P1)

A fast yellow quadruped with a rifle prop on its back runs at the player, crouches briefly, then leaps and headbutts for about 10 damage with a short knockback. It then backs off or circles and cannot ram again for about 2.5 s.

**Why this priority**: replaces the Spider and carries the 10 robots of this type in the harbor.

**Independent Test**: spawn one Spot in `?sandbox`, stand 15 m away: it chases, telegraphs, lunges and the player loses 10 HP and receives a knockback impulse; the next lunge starts no sooner than 2.5 s after the previous one.

**Acceptance Scenarios**:

1. **Given** Spot detects the player, **When** within lunge range, **Then** it plays a short crouch telegraph (glowing optics) and then leaps along the locked direction.
2. **Given** the lunge touches the player, **When** contact occurs, **Then** 10 damage and a knockback impulse are applied once per lunge.
3. **Given** a lunge ended, **When** the cooldown (about 2.5 s) runs, **Then** Spot retreats or circles and does not lunge again.
4. **Given** Spot is shot, **When** a critical-zone hit lands (head/sensor nose), **Then** it takes double damage; it has about 70 HP.

---

### User Story 3 - Faithful, cheap models (Priority: P2)

Both robots look like their reference models (duck: pastel purple shell, yellow beak and soles, grey faceplate, cyan eye ring; Spot: yellow chassis, dark visor nose, wheel feet, black rifle prop) and cost very few draw calls so 30 robots still fit the 350 draw-call budget.

**Why this priority**: owner request, plus a hard performance rule.

**Independent Test**: screenshot comparison with the reference pages; renderer draw-call count per robot near (at most 6) and far (1 to 2).

**Acceptance Scenarios**:

1. **Given** a robot within the near LOD distance, **When** rendered, **Then** it uses at most 6 draw calls (at most 5 while idle).
2. **Given** a robot beyond the far LOD distance, **When** rendered, **Then** it uses 1 or 2 draw calls.
3. **Given** the whole harbor with 30 robots, **When** rendered, **Then** the global draw-call budget (350) is respected.

---

### Edge Cases

- Duck shot while hopping or while armed: dies, no blast damage, destroyed event emitted once.
- Player teleports or dies during arming: detonation still resolves; dead player takes no further damage.
- Robot becomes simplified or dormant while hopping or armed: state stays consistent; a dormant armed duck pops harmlessly.
- Defend-phase move order arrives while armed or lunging: deferred until the action ends.
- Lunge blocked by wall or edge: the lunge ends there, Spot never leaves walkable ground.
- Respawn: robots forget the player and return to patrol.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `charger` robot type MUST become the Bomber Duck with about 60 HP; the `spider` type MUST become the Spot dog with about 70 HP; internal type ids stay unchanged; population counts (6 and 10) stay unchanged.
- **FR-002**: The duck MUST patrol, and on detection hop toward the player at a speed above walk (5 m/s) and below sprint (7.5 m/s) with a parabolic vertical arc.
- **FR-003**: Within about 2.5 m of the player the duck MUST stop and arm a 3-2-1 countdown of 1 s per count, with a flashing light, a ground radius indicator and a beep event per count.
- **FR-004**: At zero the duck MUST deal a fixed 15 damage to the player if within the blast radius (about 4 m, tunable) and nothing otherwise, then be destroyed.
- **FR-005**: A duck killed before zero MUST NOT deal blast damage.
- **FR-006**: Spot MUST chase on detection, telegraph, then lunge along a locked direction, dealing about 10 damage plus a short knockback once per lunge, then retreat or circle with a cooldown of about 2.5 s.
- **FR-007**: Spot's speeds and ranges MUST start from GDD 6.2 (speed 5, detection 30) and be tunable; it is the fast robot.
- **FR-008**: Both robots MUST keep all framework contracts: events, `Enemy`/`Damageable`, scheduler sim levels (dormant/simplified/active), pooling, test hooks, hit zones with critical x2, VFX and audio event hooks.
- **FR-009**: All new numbers MUST live in each module's own tunables file.
- **FR-010**: Geometry MUST be procedural, merged per material or vertex colour, with shared geometry and materials, disposed through the resource scope; LOD near <= 6 draw calls and far 1-2.
- **FR-011**: The old charger and spider code, tunables and tests inside their folders MUST be removed; affected unit and e2e tests MUST be updated; all existing e2e files MUST stay green.

### Key Entities

- **Bomber Duck**: suicide robot; states patrol, hop, arming, destroyed; attributes fuse, hop speed, blast radius, blast damage.
- **Spot dog**: rammer; states patrol, chase, telegraph, lunge, retreat; attributes lunge speed and range, damage, knockback, cooldown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The duck explosion happens 3.0 s (within one tick) after arming and always costs the player exactly 15 HP inside the radius.
- **SC-002**: A player who walks away from an armed duck at walk speed ends outside the radius before zero in most cases; sprinting always escapes.
- **SC-003**: Spot lunges are never closer together than 2.5 s and each connects for exactly 10 HP.
- **SC-004**: A near robot costs at most 6 draw calls, a far robot at most 2.
- **SC-005**: Both robots are recognisable next to their reference model in side-by-side screenshots.
- **SC-006**: Typecheck, unit tests, build, smoke and every e2e file pass.

## Assumptions

- Robots keep the internal ids `charger` and `spider` until the cleanup ticket renames them.
- Shared config blocks `CHARGER_ROBOT` and `SPIDER_ROBOT` stay untouched (HP lives in the module tunables) because the shared ammo-budget test depends on them; stale entries are reported to the Tech Lead.
- Duck beeps are emitted as a new event; mapping it to audio is a foundation request. The existing windup and hit events are reused so a growl and a thump are already audible.
- The brushed-metal canvas texture of the reference is replaced by flat colours to keep draw calls low.
- Models are scaled down (duck about 1.5 m, Spot about 1.5 m) to suit the harbor.
