# Spec Kit workflow

[Spec Kit](https://github.com/github/spec-kit) is installed in this repo: templates and scripts in `.specify/`, workflow skills in `.claude/skills/speckit-*` (for Claude Code). Without Claude Code, read `.claude/skills/<name>/SKILL.md` and follow the steps by hand.

## When to use it
- **New feature or gameplay system:** use the flow below.
- **Small fix, tuning, refactor, docs, cleanup:** no Spec Kit; a normal commit or PR with a clear description is enough.
- **History:** `specs/T-01..T-22` belong to the first version of the game and are historical (`specs/README.md`). Specs 24 to 27 (ADS, world dressing, enemy models and Biped, crab boss) follow the flow and are current. Earlier reworks (sunset quay, scorpion, samurai, area streaming, HUD/radar, gaits, shelters) were done without Spec Kit and are described in `docs/DEVIATIONS.md` and `docs/PLAN.md` "Current state".

## Flow (one folder per feature: `specs/<id>-<name>/`)
Set the feature directory explicitly before running any `.specify/scripts/bash/*` script (the shell environment does not persist between calls):

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/<id>-<name>   # explicit dir, never auto-numbered
export SPECIFY_FEATURE_NO_PERSIST=1                  # do not write the shared .specify/feature.json
```

1. `speckit-specify`: feature description (a ticket from `docs/tickets/_TEMPLATE.md`, or plain text) + GDD/DEVIATIONS context. Output `spec.md`. Record assumptions; resolve open questions with the defaults in `docs/PLAN.md` and `docs/REVIEW.md`.
2. `speckit-plan`: follow the architecture in `docs/PLAN.md` ("Current state"). Output `plan.md` with a filled Constitution Check.
3. `speckit-tasks`: `tasks.md`, small, ordered, test-first for pure logic.
4. `speckit-analyze` (optional): fix inconsistencies.
5. `speckit-implement`: execute the tasks and tick them off.
6. Verify (below), then commit `specs/<id>-<name>/` together with the code.

Keep each artifact short. A feature is complete when its folder has `spec.md`, `checklists/requirements.md`, `plan.md` and `tasks.md` with every task ticked or marked skipped with a reason.

## Verification
```bash
npx tsc --noEmit && npm test && npm run build
```
- `npm run smoke` / `npm run e2e -- <id>` are optional and slow on machines without a GPU (software GL). **All `tests/e2e/*.mjs` are stale** (old map, four towers, grapple): rewrite a script before relying on it. CI runs typecheck, unit tests and build only.
- Never mark a task done that was not run; write "skipped" with the reason.

## Rules
- Constitution: `.specify/memory/constitution.md`. Read it before planning. Amend it only deliberately, with a version bump.
- Do not edit `.specify/templates`, `.specify/scripts` or `.claude/skills` as part of a feature.
- Spec Kit scripts do not create git branches here; use your own feature branch.
- Never commit `node_modules` or raw third-party archives (`tools/asset-pipeline/input/`).
- Keep prompts and reads small: give file paths instead of pasting whole files.
