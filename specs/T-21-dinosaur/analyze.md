# Specification Analysis Report: T-21 Dinosaur semi-boss

Run via the Skill tool (`speckit-analyze`), read-only, after `speckit-tasks`. Prerequisite script `check-prerequisites.sh --require-spec --require-tasks` passed.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Ambiguity | MEDIUM | data-model.md skills table | Distance bands overlap (ram 14..40, leap 8..30, tail < 10): which skill wins at 14..30 m is unspecified | Brain picks by priority tail spin (< 10) > leap (10..22) > ram (>= 22); encode in `brain.ts` and tests; data-model bands are a starting point |
| A2 | Inconsistency | LOW | research.md drop decision | Text trails off ("ECONOMY.ammoCrateAmount each... see tunables") | Clarify: 4 ammo crates of ECONOMY.ammoCrateAmount, 1 medkit of ECONOMY.medkitHeal (edited) |
| A3 | Underspecification | MEDIUM | spec.md SC-003 | "drops compensate" is not measured | T-15 e2e records HP vs supply; ammo math reported in hand-over (docs/PLAYTEST.md budget) |
| A4 | Coverage | LOW | spec.md edge case "player dies and respawns" | No task explicitly covers it | Handle `game:respawn` in `index.ts` (T008), assert in e2e (T012) |
| A5 | Underspecification | LOW | tasks.md T009 | One task carries chase + three skills | Acceptable; implement in sub-steps, unit tests cover the logic (T003-T005) |
| A6 | Constitution | none | plan.md | Principles I-V pass; shared edit limited to the ticket-authorised `src/modules.ts` line | none |

## Coverage Summary

| Requirement | Has task? | Tasks |
|---|---|---|
| FR-001 | yes | T003, T008, T012 |
| FR-002 | yes | T007, T008, T012 |
| FR-003 | yes | T007, T009, T008 |
| FR-004 | yes | T001, T006, T007, T012 |
| FR-005 | yes | T005, T009, T012 |
| FR-006 | yes | T004, T009 |
| FR-007 | yes | T010, T012 |
| FR-008 | yes | T006, T012, T014 |
| FR-009 | yes | T001 |
| FR-010 | yes | T013 |

**Constitution alignment issues**: none. **Unmapped tasks**: none.

**Metrics**: 10 requirements, 15 tasks, coverage 100%, ambiguity 2, duplication 0, critical 0.

## Next actions

No CRITICAL issues: proceed to implement. A1 and A2 are resolved during implementation (priority order in `brain.ts`; research.md wording fixed).
