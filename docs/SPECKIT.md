# Spec Kit workflow

[Spec Kit](https://github.com/github/spec-kit) is installed in this repo: templates and scripts in `.specify/`, workflow skills in `.claude/skills/speckit-*` (for Claude Code). Without Claude Code, read `.claude/skills/<name>/SKILL.md` and follow the steps by hand.

## When to use it
- **New feature or gameplay system:** use the flow below.
- **Small fix, tuning, refactor, docs, cleanup:** no Spec Kit; a normal commit or PR with a clear description is enough.
- **History:** `specs/T-01..T-22` belong to the first version of the game and are historical (`specs/README.md`). Specs 24 and above (ADS, world dressing, enemy models and Biped, crab boss, scorpion model) follow the flow and are current; they are the examples to copy (`specs/27-crab-boss` is the most complete). Reworks before spec 24 (sunset quay, scorpion, samurai, area streaming, HUD/radar, gaits, shelters) had no Spec Kit and are described in `docs/DEVIATIONS.md` and `docs/PLAN.md` "Current state".

## Flow (one folder per feature: `specs/<id>-<name>/`)
Set the feature directory explicitly before running any `.specify/scripts/bash/*` script (the shell environment does not persist between calls, so repeat it in each Bash call):

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/<NN>-<name>   # explicit dir, never auto-numbered (see below)
export SPECIFY_FEATURE_NO_PERSIST=1                  # do not write the shared .specify/feature.json
```

Why explicit: `create-new-feature.sh` and the skill's auto-numbering count three-digit prefixes only (`001-x`), but this repo uses `T-XX` and two-digit `NN-name` folders, so auto-numbering would restart at 001. Do not run `create-new-feature.sh`; the `speckit-specify` skill creates the folder itself from `SPECIFY_FEATURE_DIRECTORY`. The other scripts only resolve paths and copy templates: `setup-plan.sh --json` (needs `spec.md`; copies the plan template), `setup-tasks.sh --json` (needs `plan.md`), `check-prerequisites.sh --json [--require-tasks --include-tasks]`, `resolve-template.sh <name> --json`. Without the env var they fail unless `.specify/feature.json` exists (git-ignored, written by the skill; harmless). The git branch is never created or switched by them.

1. `speckit-specify`: feature description (a ticket from `docs/tickets/_TEMPLATE.md`, or plain text) + GDD/DEVIATIONS context. Output `spec.md`. Record assumptions; resolve open questions with the defaults in `docs/PLAN.md` and `docs/REVIEW.md`.
2. `speckit-plan`: follow the architecture in `docs/PLAN.md` ("Current state"). Output `plan.md` with a filled Constitution Check.
3. `speckit-tasks`: `tasks.md`, small, ordered, test-first for pure logic.
4. `speckit-analyze` (optional): fix inconsistencies.
5. `speckit-implement`: execute the tasks and tick them off.
6. Verify (below), then commit `specs/<id>-<name>/` together with the code.

Keep each artifact short. Definition of done: see "Continuing the work" below.

## Verification
```bash
npx tsc --noEmit && npm test && npm run build
```
- `npm run smoke` / `npm run e2e -- <id>` are optional and slow on machines without a GPU (software GL). **All `tests/e2e/*.mjs` are stale** (old map, four towers, grapple): rewrite a script before relying on it. CI runs typecheck, unit tests and build only.
- Never mark a task done that was not run; write "skipped" with the reason.

## Rules
- Constitution: `.specify/memory/constitution.md` (v2.0.0). Read it before planning; the plan's Constitution Check has one row per principle (PASS or JUSTIFIED with the reason). Amend it only deliberately, with a version bump and a dated note, when reality and a principle disagree (as in 2.0.0).
- Do not edit `.specify/templates`, `.specify/scripts` or `.claude/skills` as part of a feature.
- Spec Kit scripts do not create git branches here; use your own feature branch.
- Never commit `node_modules` or raw third-party archives (`tools/asset-pipeline/input/`).
- Keep prompts and reads small: give file paths instead of pasting whole files.

## Continuing the work (handoff)

**Verified by running** (scratch dir, then deleted): with `SPECIFY_FEATURE_DIRECTORY` and `SPECIFY_FEATURE_NO_PERSIST=1`, `check-prerequisites.sh --paths-only`, `setup-plan.sh --json` (copies the plan template with its Constitution Check), `resolve-template.sh spec-template`, `setup-tasks.sh --json` and `check-prerequisites.sh --json --require-tasks --include-tasks` all work and fail with a clear message when the previous artifact is missing. Only `create-new-feature.sh` mis-numbers (above); the scripts and templates stay untouched.

**Next spec number:** `ls specs | grep -E '^[0-9]'`, take the highest and add 1 (spec 30 is the fences and gates, so the next is 31; 23 was never used). Name: `NN-short-kebab-name`.

**Order of skills:** `speckit-specify` -> (`speckit-clarify`, optional) -> `speckit-plan` -> `speckit-tasks` -> (`speckit-analyze`, optional) -> `speckit-implement` -> verify -> (`speckit-converge` to append unbuilt work as tasks, `speckit-checklist` for extra checklists, optional).

**Start prompt (copy, fill in the brackets):**
```
Read CLAUDE.md, docs/SPECKIT.md ("Continuing the work"), docs/DEVIATIONS.md and the constitution.
New feature: [one paragraph: what the player sees or does, and why].
Branch: git switch -c feature/[name] from an up-to-date main.
export SPECIFY_FEATURE_DIRECTORY=specs/[NN]-[name]; export SPECIFY_FEATURE_NO_PERSIST=1
Run /speckit-specify, /speckit-plan, /speckit-tasks, /speckit-implement in that order, non-interactively
(assumptions go in the spec). Follow docs/SPECKIT.md "Definition of done". Do not push to main.
```

**Definition of done (feature):**
1. `specs/NN-name/` has `spec.md`, `checklists/requirements.md`, `plan.md` (Constitution Check filled, one row per principle) and `tasks.md` with every task ticked, or marked "skipped" with the reason.
2. Pure rules have Vitest tests written first or with the code; tunables live in config.
3. `npx tsc --noEmit && npm test && npm run build` passes; write what was and was not run (scripted screenshots on the low preset, smoke, e2e) in the last task.
4. Docs updated: a new section in `docs/DEVIATIONS.md` (what changed, `Spec Kit: specs/NN-name`, verified / not verified); `docs/ASSETS.md` plus credits for any third-party asset; `README.md` only when player-visible (controls, roster); credits go in `CREDITS.md`; the CLAUDE.md Status block (latest feature, test count, open limits); `specs/README.md` row/note.
5. Never claim something verified that was not run.

**Git and PR workflow:** work on a feature branch; commit `specs/NN-name/` with the code; open a PR into `main`; CI (`.github/workflows/pages.yml`: typecheck, unit tests, build on every push and PR) must be green, poll it until it is; merging to `main` deploys to GitHub Pages. Never push to `main` directly. Sub-agents work in their own git worktree and do not push; one coordinator merges. Never commit `node_modules`, a symlink to it, or raw archives.

**Asset pipeline:** scripts in `tools/asset-pipeline/` (see its README): `convert.sh` (GoldSrc MDL to GLB, G36C), Blender 4.0 headless scripts `*_sf.py`, `samurai.py`, `industrial.py`, `terminal.py` (run `blender --background --python <script> -- <args>`; each script's docstring lists inputs). Sketchfab models are fetched through the download API (`api.sketchfab.com/v3/models/<uid>`, check the licence per uid first) into a scratch directory outside git. Only CC0 and CC-BY; raw downloads stay out of git, only the built GLB ships in `public/assets/`. Record source, author, licence and script in `docs/ASSETS.md`; credit in `src/ui/credits.ts` (has a unit test) and `CREDITS.md`; keep a procedural fallback.

**Open follow-ups (state at spec 28):**
- Playtest on a real GPU: lag, black screen, balance (Striker about 9 dmg/s on a still player), frame rate with all instances. Nobody has played a full run.
- Rewrite `tests/e2e/*.mjs` (stale: old coordinates, four towers, grapple) and re-check `scripts/smoke.mjs` (not run since the reworks); neither is in CI.
- Pale orange wash on the crab while skills telegraph (seen in screenshots, cause not found).
- Walls and warehouses idea: tall perimeter walls (6 to 8 m) and large warehouses so the sea and ships are not visible. Proposed only; the owner has not decided. Ask before building it.
- Known limits: no ambient audio; bundle about 5.3 MB (Rapier 82%); in-game Restart reloads the page; `docs/PLAN.md` sections 1 to 9 and `docs/GDD.md` are the original design.
