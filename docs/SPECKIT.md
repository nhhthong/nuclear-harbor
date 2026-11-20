# Spec Kit workflow

[Spec Kit](https://github.com/github/spec-kit) is installed in this repo: templates and scripts in `.specify/`, workflow skills in `.claude/skills/speckit-*` (for Claude Code). Without Claude Code, read `.claude/skills/<name>/SKILL.md` and follow the steps by hand.

## When to use it
- **New feature or gameplay system:** use the flow below.
- **Small fix, tuning, refactor, docs, cleanup:** no Spec Kit; a normal commit or PR with a clear description is enough.
- **History:** `specs/T-01..T-22` belong to the first version of the game and are historical (`specs/README.md`). Specs 24 to 32 (ADS, world dressing, enemy models and Biped, crab boss, scorpion model, warehouse and L map, fences and gates, samurai crescent wave, recorded audio) are current. They were written by the coordinator with or after the code, not by running the skills in order (spec 29 wrote contract, spec and plan first); `specs/ANALYSIS-2026-11.md` rewrote them to match what shipped. Copy their structure (`specs/27-crab-boss` and `specs/29-warehouse-l-map` are the most complete), but run the skills in order for a new feature. Reworks before spec 24 (sunset quay, scorpion, samurai, area streaming, HUD/radar, gaits, shelters) had no Spec Kit and are described in `docs/DEVIATIONS.md` and `docs/PLAN.md` "Current state".

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
- Constitution: `.specify/memory/constitution.md` (v2.0.1). Read it before planning; the plan's Constitution Check has one row per principle (PASS or JUSTIFIED with the reason). Amend it only deliberately, with a version bump and a dated note, when reality and a principle disagree (as in 2.0.0).
- Do not edit `.specify/templates`, `.specify/scripts` or `.claude/skills` as part of a feature.
- Spec Kit scripts do not create git branches here; use your own feature branch.
- Never commit `node_modules` or raw third-party archives (`tools/asset-pipeline/input/`).
- Keep prompts and reads small: give file paths instead of pasting whole files.

## Continuing the work (handoff)

**Verified by running** (scratch dir, then deleted): with `SPECIFY_FEATURE_DIRECTORY` and `SPECIFY_FEATURE_NO_PERSIST=1`, `check-prerequisites.sh --paths-only`, `setup-plan.sh --json` (copies the plan template with its Constitution Check), `resolve-template.sh spec-template`, `setup-tasks.sh --json` and `check-prerequisites.sh --json --require-tasks --include-tasks` all work and fail with a clear message when the previous artifact is missing. Only `create-new-feature.sh` mis-numbers (above); the scripts and templates stay untouched.

**Next spec number:** `ls specs | grep -E '^[0-9]'`, take the highest and add 1 (spec 32 is the recorded sound effects, so the next is 33; 23 was never used; `specs/README.md` and `CLAUDE.md` say the same). Name: `NN-short-kebab-name`.

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

**Spec quality rules (from the 2026-11 analysis):** give every requirement a check tag (`[U file]` unit test, `[B]` scripted browser check, `[N]` not verified) and a task that names its FR; mark open tasks `- [ ] Tnnn skipped: reason`; keep the Constitution Check at seven rows (I to VII) and list every shared file the feature touches (new events go in the shared `core/events.ts` only when declaration merging is not practical, and the plan says so); put numbers in the spec only if they are in config (re-check them against the code before closing the spec, they changed under several specs: jump height, ammo budget, roster distribution).

**Open follow-ups (state after spec 32, 2026-11-20):**
- **Spec 33 proposal: muzzle flash and enemy bolt VFX rework.** Owner feedback: the rifle muzzle flash looks unrealistic and the robots' bullets look poor. Vetted assets, all CC0: Kenney "Particle Pack" (https://opengameart.org/content/particle-pack-80-sprites, `kenney_particlePack.zip`): `muzzle_01..05` grayscale muzzle-flash shapes, `flare_01` halo, `trace_01..07` streaks, `spark_05/06`, `light_01`. Not yet inspected: Kenney "Smoke Particles" (https://opengameart.org/content/smoke-particle-assets). CC-BY options (credit required): "A lot of impacts" (https://opengameart.org/content/alotofimpacts-5-frame-quick-hit-impacts-muzzle-flashs-4colors-impacts016-019) and "Aech MuzzleFlash". Rejected: toon and pixel-art flashes. The scratch copies of the Kenney pack were lost with the old session: download it again (outside git; only the processed sprite atlas ships). Current code: `src/weapon/effects.ts` (HDR star plus a point light plus tracers and casings), `src/vfx/recipes.ts`, `src/vfx/emitter.ts`, `src/enemies/EnemyProjectiles.ts` (a plain sphere or additive ball). Intended design: per shot a random pick of 5 flash sprites with random rotation and scale; 1 to 2 frame additive flash tinted white-hot core to orange rim; a short alpha smoke puff; a few sparks; a shorter light pop. Robot bolts as stretched additive billboards with a white-hot core, a flare halo and a trace-streak tail, red/orange for enemies (green and cyan options), with an impact flash and sparks. Use the Spec Kit flow, keep a procedural fallback, credit anything CC-BY in `src/ui/credits.ts`, `CREDITS.md`, `docs/ASSETS.md`. Do not create `specs/33-*` before the flow starts.
- **Spec 32 T019 and unsourced sounds:** mix pass on a real device (manifest gains, bus and loop levels, loop seams, footstep and casing loudness, Safari Ogg decode); never listened to. Unsourced: roller door, rain, rocket launch, looping per-drone buzz, tower hum and boss telegraphs (procedural). BigSoundBank (CC0) is reachable from the sandbox; Freesound is blocked. Owner decision pending: amend constitution Principle VI for audio files (T020).
- **Done, remove from lists:** the walls and warehouses idea is built (spec 29). The old "ask before building it" note is obsolete.
- **Playtest on a real GPU:** lag, black screen, balance (Striker about 9 dmg/s on a still player, samurai crescent 32 damage), frame rate with all instances, medium/high presets (bloom on the crescent and the scorpion glow). Nobody has played a full run.
- **Stale tools:** rewrite `tests/e2e/*.mjs` (old coordinates, four towers, grapple) and re-check `scripts/smoke.mjs`; neither is in CI.
- **Known visual and gameplay gaps:** pale orange wash on the crab while skills telegraph (cause not found); samurai (1.8 m) and scorpion (1.9 m) dodge clearances are at or above the double jump (1.8 m); large pale glow when a drone charges a shot very close to the camera; spec 29 contract conflicts (back door 4.5 m vs mezzanine deck 3.4 m; window `win-n1` over the door); `GATE` layer filters (spec 30) and the samurai skill selection and `SPIN_FORWARD`/35 degree literals (spec 31) are untested or not in tunables; drones and the crab pass through containers.
- **Process notes:** merge the dev branch `claude/wizardly-cori-697x6r` into `main` with merge commits, not squash (squashing made the branches diverge and needed "sync the dev branch" commits after PRs #12 to #17). Sub-agents work in their own git worktrees and write code and assets only; the coordinator merges and verifies in the browser: Playwright with software GL on the low preset, and the stepped simulation (`ctx.testHooks`) for speed. Specs in this repo were written by the coordinator, so state in the spec who did what.
- Known limits: bundle about 5.3 MB (Rapier 82%); in-game Restart reloads the page; `docs/PLAN.md` sections 1 to 9 and `docs/GDD.md` are the original design.
