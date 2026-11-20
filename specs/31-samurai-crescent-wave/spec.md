# Feature Specification: Samurai crescent wave, frontal spin

**Feature**: `31-samurai-crescent-wave` | **Created**: 2026-11-20 | **Status**: Implemented and merged (PR #21 with spec 32); not played on a real GPU
**Input**: owner request 2026-11-20: (1) the spinning naginata (deflect skill) turned in the sagittal plane beside the body, it must spin 90 degrees round, in front of the samurai, facing the player it deflects; (2) a new skill: the armour glows red, a vertical overhead cut releases a bright crescent of sword energy that glides at the player, slower than a bullet, high damage.
**Process**: written by the coordinator with the implementation on the dev branch `claude/wizardly-cori-697x6r`, not by running the skills in order; the coordinator did the browser checks (sandbox, stepped simulation). Two rounds of owner feedback changed the crescent after the first version (see Assumptions). Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (sandbox, low preset, stepped simulation), `[N]` not verified.

## User Scenarios & Testing

### User Story 1 - The deflect spin faces the player (Priority: P1)
The skinned naginata is stood up (pitch +90 degrees) and rolled about the facing axis, held 0.55 m in front of the grip (`SPIN_FORWARD`); the blur disc lies in the frontal plane at the same spot. Deflection numbers are unchanged.
1. With the spin forced, the blur disc and the naginata turn in the frontal plane in front of the samurai (front and side views). [B]
2. No unit test covers the spin orientation. [N]

### User Story 2 - Crescent wave (Priority: P1)
Used from 6 to 26 m with line of sight, when the player is beyond leap range or the leap recharges; cooldown 8.5 s. Charge 0.95 s (blade overhead, armour emissive red, pulsing, peak `chargeGlow` 1.6), overhead cut 0.32 s (release half way), recover 0.55 s. The crescent (2.9 m tall, 0.75 m bulge) stands upright in the vertical plane of its flight and bulges forward: "(" from the side, a vertical blade "|" to the player it flies at. It flies at 12 m/s towards where the player stood (never more than about 35 degrees off the facing), up to 30 m.
1. A samurai 20 m away charges red for about 1 s, cuts, and the crescent flies at 12 m/s and hits the player: 100 -> 68 HP (32 damage) and knockback 6. [B]
2. Hit volume: in the path yes, beside it (past the 0.55 m half width plus capsule) no, behind it no, not yet reached no, double jump (1.8 m) does not clear it, above its 2.9 m height clears it. [U `src/enemies/samurai/logic.test.ts` `crescentHit`]
3. Speed 12 m/s below bullet speed (enemy bolts 24 to 30 m/s); damage 32 above the cut and the leap. [U `logic.test.ts`]
4. Shape: upright from the ground to its height, bulges by the given amount, runs horn to horn. [U `logic.test.ts` `crescentShape`, `crescentRibbon`]
5. Walls stop it (static world ray); gates and chain-link do not. [N]
6. Selection (range band, leap condition, 35 degree limit, cooldown) is in `Samurai.ts` and has no test. [N]

## Requirements
- **FR-001** Frontal spin (User Story 1). [B]
- **FR-002** Skill timing and selection: 6 to 26 m with line of sight, player beyond leap range or leap recharging, cooldown 8.5 s, charge 0.95 s, cut 0.32 s (release at 0.5 of it), recover 0.55 s; states `waveCharge`, `waveSlash`, `waveRecover`. [B timing; no unit test]
- **FR-003** Crescent flight: 12 m/s, range 30 m, one pooled crescent group per samurai (3 small meshes, created once, hidden when idle), one ray per fixed step while flying. [U speed below bullet; B]
- **FR-004** Damage 32 plus knockback 6, hit half width 0.55 m across the flight, half depth 0.45 m (`crescentHit` in `logic.ts`). [U, B]
- **FR-005** Walls stop it, chain-link gates and fences do not. [N]
- **FR-006** Look: shader ribbon (`crescentRibbon`, `CRESCENT_FRAGMENT`: tapered horns, white-hot edge, orange-to-deep-red body, energy fibres, noise edge, dissolve, soft halo layer, three after-images, embers via `vfx:spawn`), orientation as above. All procedural. [U geometry; B low preset; bloom on medium/high N]
- **FR-007** Armour glows red while charging. [B]
- **FR-008** Numbers in `SAMURAI.wave` (`src/enemies/samurai/tunables.ts`). The 0.55 m `SPIN_FORWARD` and the 35 degree aim limit are literals in `Samurai.ts`, not tunables. [review; two literals are a known gap against Principle III]
- **FR-009** `enemy:waveReleased { id, position }` is emitted when the crescent is released; added to `core/events.ts` in PR #21 and routed to the recorded energy-wave sound by spec 32. [B: the spec 32 browser run produced a sample play on it; no unit test]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (615 tests at the time; 655 on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** Browser: charge, cut, hit for 32, spin disc faces front, no console errors. [B, done]

## Assumptions
- Owner feedback loop 1: the first crescent was a flat shape and "looked ugly": reworked into the shader ribbon above.
- Owner feedback loop 2: the first crescent lay across the flight line; it now stands in the vertical plane of its flight and bulges forward ("(" from the side, "|" to the player); hit half width across the flight was cut from 1.05 to 0.55 m (a blade).
- A double jump does not clear it; stepping aside does.
- Not verified: bloom on medium/high, balance (32 damage at 12 m/s), the walls-stop and gates-pass rules, a real GPU, smoke/e2e (skipped).
