## Specification Analysis Report (T-20, run via the speckit-analyze skill)

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| F1 | Inconsistency | MEDIUM | spec FR-004 vs research D6 | FR-004 says "heavy footstep cues"; research limits it to dust VFX on foot-down (no sound event exists). | Accepted: spec Assumptions already say sound goes through existing events; report as a limitation. |
| F2 | Inconsistency | MEDIUM | spec FR-002 vs research D1 | Reference animates turbines and gatling barrels; the draw-call budget (<= 6) forces a rigid body. | Accepted deviation, to be stated in the hand-over; glow and body motion keep the mech alive. |
| C1 | Coverage | LOW | tasks T016 | `src/enemies/tunables.ts` (`ENEMY_LOCAL`) is framework-owned; sphere-only keys must only be removed if unused. | T016 reworded: remove only keys no other robot uses, line-local. |
| C2 | Coverage | LOW | SC-002 | Draw-call measurement has no automated check. | T015 e2e reads `renderer.info.render.calls` near/far. |
| D1 | Duplication | LOW | spec US4 / FR-011 | Contract list repeated. | Left as is. |
| K1 | Constitution | none | plan Constitution Check | All 7 principles evaluated; V notes the line-local edits to shared files. | OK |

**Coverage Summary**

| Requirement | Has Task? | Task IDs |
|---|---|---|
| FR-001 | yes | T001, T009, T012 |
| FR-002, FR-003 | yes | T008, T009, T010 |
| FR-004, FR-005 | yes | T001, T006, T011 |
| FR-006 | yes | T003, T011 |
| FR-007 | yes | T006, T011 |
| FR-008, FR-009 | yes | T004, T005, T007, T013 |
| FR-010 | yes | T001, T002, T012, T016 |
| FR-011 | yes | T014, T015, T016 |

**Unmapped tasks**: none (T017 is process).

**Metrics**: requirements 11, tasks 17, coverage 100 %, ambiguity 0, duplication 1 (LOW), critical issues 0.

**Next actions**: no CRITICAL issues; proceed to implement. Edits applied to artifacts: tasks.md T016 wording.

**Post-implementation note**: footfall = dust VFX per foot-down (F1), rigid body without turbine/gatling spin (F2) as analysed. Build, smoke and the full e2e run were skipped per owner instruction.
