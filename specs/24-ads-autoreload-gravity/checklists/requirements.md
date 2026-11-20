# Specification Quality Checklist: ADS, auto reload, gravity

**Created**: 2026-11-15 | **Analysed**: 2026-11-20 | **Feature**: [spec.md](../spec.md)

- [x] No [NEEDS CLARIFICATION] or TODO markers remain
- [x] Requirements are testable; each carries a check tag (unit, browser, not verified)
- [x] Success criteria are measurable (SC-001, SC-002)
- [x] Acceptance scenarios exist for each story
- [x] Edge cases and assumptions recorded (reload cancels aim, old saved bindings, GLB sight alignment, no scope overlay, no touch)
- [x] Scope bounded
- [x] Numbers in the spec match the code (gravity -30, jump 7.55 / 7.15, `ADS` values) as of 2026-11-20
- [ ] FR-008 (cancel rules, speed, sprint) and the Settings checkbox have a test or browser check: no, marked [N] in the spec
- [x] Constitution Check has one row per principle (7)
