# T-XX — Title

| | |
|---|---|
| Wave | n |
| Depends on | tickets that must be merged first |
| GDD sections | numbers, plus `docs/DEVIATIONS.md` entries that override them |
| Spec dir | `specs/T-XX-short-name/` |

## Goal
One paragraph: what the player/dev gets when this is done.

## Files owned (exclusive)
Folders/files only this ticket may edit. Shared files: minimal line-local edits; larger needs go to `specs/T-XX-short-name/foundation-requests.md`.

## Interfaces consumed / provided
Events, `GameContext` members, test hooks, tunables.

## How to work
Follow `docs/SPECKIT.md` (specify -> plan -> tasks -> analyze -> implement) and `.specify/memory/constitution.md`.

## Acceptance criteria
- [ ] AC1 ... (each one testable; say how it is verified: unit test, e2e, or manual check)

## Verify
Commands to run (see `CLAUDE.md` for the current e2e policy and the `SMOKE_PORT` rule).

## Out of scope
What this ticket must not touch.
