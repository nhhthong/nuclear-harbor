## Specification Analysis Report (T-22 Final boss)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F1 | Inconsistency | MEDIUM | spec.md FR-003 vs src/boss/tunables.ts | Spec calls weak points "knee lights" with no index naming; existing `WEAK_POINT` (front/back/left/right) conflicts | T005 maps indices 0..3 to FL/FR/BL/BR (data-model.md); update tests |
| F2 | Ambiguity | LOW | spec.md SC-001 "about 18 m" | No tolerance | Accept 17..19 m; checked by the e2e/body height |
| F3 | Ambiguity | LOW | spec.md FR-006 "about 6 s" | No tolerance | Timeline total 6.2 s, unit tested |
| C1 | Coverage | MEDIUM | tasks.md | FR-011 (full-run flow keeps working) is covered only by T012/T013 | Acceptable: T-16 e2e run in T013 |
| C2 | Coverage | LOW | SC-003 (100% of tested player positions) | Covered by T003 unit test over a grid of player positions | Keep the grid test |
| D1 | Constitution | none | plan.md | All seven principles checked and PASS; the 18 m height is a local tunable (no shared file edit) | none |

**Coverage Summary**

| Requirement | Task IDs |
|---|---|
| FR-001 | T006, T007 |
| FR-002 | T006, T007, T013 |
| FR-003 | T005, T008 |
| FR-004, FR-009 | T002, T010 |
| FR-005 | T003, T010 |
| FR-006 | T004, T009, T010 |
| FR-007, FR-008 | T010 |
| FR-010 | T011 |
| FR-011 | T012, T013 |

**Unmapped tasks**: none.

**Metrics**: Requirements 11, Tasks 13, Coverage 100%, Ambiguity 3 (all LOW), Duplication 0, Critical 0.

**Next actions**: no CRITICAL issues; proceed to implement. Resolutions F1 to F3 are recorded in plan/data-model/research and applied in implementation.
