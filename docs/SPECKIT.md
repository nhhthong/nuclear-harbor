# Spec Kit workflow (for developers and sub-agents)

Spec Kit (github/spec-kit, CLI `specify` 1.4.1.dev0) is installed: `.specify/` (templates, scripts) and `.claude/skills/speckit-*` (workflow skills).
If the `speckit-*` skills are not in your skill list, `Read` `.claude/skills/<name>/SKILL.md` and follow it manually.

## Per-ticket flow (the default for every feature ticket)
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

## Enforcement (wave 2 onward)
Wave 1 (T-01..T-11) wrote spec/plan/tasks by hand; accepted as-is, not redone.
From wave 2, a ticket is NOT done unless `specs/T-XX-name/` contains all of:
`spec.md`, `checklists/requirements.md` (made by `speckit-specify`), `plan.md` with a filled Constitution Check, `tasks.md` with every task ticked.
Run each phase through the Skill tool (`speckit-specify`, `speckit-plan`, `speckit-tasks`, `speckit-analyze`, `speckit-implement`). If the Skill tool is unavailable, `Read` `.claude/skills/<name>/SKILL.md` and execute its steps literally, including the `.specify/scripts/bash/*` calls. Hand-writing the artifacts from memory is not allowed.
The final report must state, per phase, how it was run (Skill tool / SKILL.md steps) and list any step skipped and why.

## Current policy (owner decisions, latest wins)
- **Spec Kit stays required for feature tickets, including the upcoming UI work.** Cleanup/rename tickets (T-23) are exempt and keep a deletion log instead (`docs/CLEANUP-LOG.md`).
- **Models:** Sonnet 5.5 writes both the Spec Kit artifacts and the code, inside the same agent. Do not delegate Spec Kit to Haiku.
- **Tests:** the owner asked for code only: do NOT run `npm run smoke` / `npm run e2e` unless the owner asks. Always run `npx tsc --noEmit`, the unit tests of the files you own, and `npm run build` when types alone are not enough. If you skip a verification, write "skipped per owner" in `tasks.md` and say so in the report; never tick a task you did not run.
- **Cost control:** read only the ticket, `docs/PLAN.md`, this file, the constitution and the code you change. Do not paste large files into prompts; give repo paths. At most two agents at the same time (the sandbox has 4 CPUs and software GL, software rendering makes e2e slow and flaky when loaded).
- **Hygiene:** each agent works in its own git worktree; never commit `node_modules` (a symlink once overwrote the real directory on merge); use a unique `SMOKE_PORT` when you do run smoke/e2e; push nothing, the coordinator merges.
- **How the skills really run:** the Skill tool only loads the instructions; the agent then runs the `.specify/scripts/bash/*` steps and writes the files itself. That is accepted. Wave 1 (T-01..T-11) wrote its artifacts by hand and was not redone.
- New ticket? Copy `docs/tickets/_TEMPLATE.md`, add it to `docs/tickets/README.md`.
