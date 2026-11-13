# Specification Analysis Report (T-19)

Run via the Skill tool (`speckit-analyze`), read-only on spec, plan and tasks. Prerequisite script `check-prerequisites.sh --json --require-spec --require-tasks --include-tasks` returned all artifacts.

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| A1 | Ambiguity | MEDIUM | spec.md SC-002 | "in most cases" is not measurable | Measure in a unit test: at walk speed (5 m/s) from 2.5 m the player leaves the 4 m radius in about 0.3 s, so it always escapes within the 3 s fuse; record the number in the report |
| B1 | Inconsistency | LOW | data-model.md vs plan.md | Plan lists a "circle" phase for Spot, data model has only `retreat` | Treat circling as the second half of the `retreat` state (retreat then strafe); no new state |
| C1 | Coverage | MEDIUM | spec.md FR-008 (sim levels), edge cases (defend-phase order deferred, dormant armed duck) | No explicit test task | Cover in T011 and T014 (command deferred while arming/lunging; dormant armed duck pops harmlessly; Spot never leaves walkable ground) |
| C2 | Coverage | LOW | spec.md SC-004 | Far LOD draw calls only measured in T015 | Keep T015 and report near/far numbers |
| D1 | Constitution | none | plan.md Constitution Check | All 7 principles pass; documented deviations: module HP differs from shared config; Spot imports `duck/modelKit` | none |
| E1 | Underspecification | LOW | tasks.md T016 | T-05 and T-16 e2e references to old charger events | Duck still emits `charger:windup`/`chargeStarted`-free flow; T-16 slice step is rewritten to the duck fuse |

**Coverage summary**: FR-001 T001,T003,T010,T013 · FR-002 T004,T010 · FR-003 T005,T010 · FR-004 T005,T011 · FR-005 T011 · FR-006 T007,T013,T014 · FR-007 T003,T007 · FR-008 T010,T013,T011,T014 · FR-009 T003 · FR-010 T002,T009,T012,T015 · FR-011 T001,T016.

**Unmapped tasks**: none.

**Metrics**: requirements 11, success criteria 6, tasks 20, coverage 100%, ambiguity 1, duplication 0, critical 0.

**Next actions**: no CRITICAL issues; proceed to implement and fold A1, B1 and C1 into the tests of T005, T007, T011 and T014.
