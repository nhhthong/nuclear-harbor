# Spec Kit workflow (for developer sub-agents)

Spec Kit (github/spec-kit, CLI `specify` 1.4.1.dev0) is installed: `.specify/` (templates, scripts) and `.claude/skills/speckit-*` (workflow skills).
If the `speckit-*` skills are not in your skill list, `Read` `.claude/skills/<name>/SKILL.md` and follow it manually.

## Per-ticket flow (mandatory)
Ticket `docs/tickets/T-XX-name.md` → spec dir `specs/T-XX-name/`.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-XX-name   # explicit dir, never auto-numbered
export SPECIFY_FEATURE_NO_PERSIST=1                 # parallel agents: do not write shared .specify/feature.json
```
Set these in every Bash call that runs `.specify/scripts/bash/*` (shell env does not persist between calls).

1. `speckit-specify` — input: ticket file + referenced GDD sections. Output `spec.md`. Non-interactive: do not ask the user; record assumptions in spec, resolve `[NEEDS CLARIFICATION]` with the ticket/PLAN/REVIEW defaults.
2. `speckit-plan` — must follow `docs/PLAN.md` interfaces and file ownership. Output `plan.md` (+ research/data-model/contracts if useful).
3. `speckit-tasks` — `tasks.md`, small, ordered, test-first for pure logic.
4. `speckit-analyze` (optional, quick) — fix inconsistencies.
5. `speckit-implement` — execute tasks, tick them off.
6. Verify: `npm run typecheck && npm test && npm run build` (+ `npm run smoke` if ticket touches runtime).

Keep spec artifacts short (one screen each where possible). Commit `specs/T-XX-name/` with the code.

## Rules
- Constitution: `.specify/memory/constitution.md` (owned by Tech Lead). Do not edit.
- Spec Kit scripts do not create git branches here; stay on the branch you were given.
- Do not edit `.specify/templates`, `.specify/scripts`, `.claude/skills`.
