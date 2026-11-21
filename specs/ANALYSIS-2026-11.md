# Spec analysis, November 2026 (specs 24 to 32)

Method: `speckit-analyze` run by hand on each spec folder (`check-prerequisites.sh --json --require-tasks --include-tasks` with `SPECIFY_FEATURE_DIRECTORY` and `SPECIFY_FEATURE_NO_PERSIST=1`; `create-new-feature.sh` is never run, it mis-numbers). The specs were then rewritten to match what was built. Check tags in the specs: `[U file]` unit test, `[B]` scripted browser check (low preset, software GL, stepped simulation), `[N]` not verified. Nothing here was listened to or run on a real GPU.

## Findings: 62 total (1 critical, 14 high, 32 medium, 15 low)

| Spec | C | H | M | L |
|---|---|---|---|---|
| 24 | 0 | 1 | 3 | 2 |
| 25 | 0 | 2 | 4 | 1 |
| 26 | 0 | 2 | 3 | 2 |
| 27 | 0 | 3 | 4 | 1 |
| 28 | 0 | 0 | 3 | 2 |
| 29 | 0 | 3 | 4 | 2 |
| 30 | 0 | 0 | 4 | 2 |
| 31 | 0 | 1 | 3 | 2 |
| 32 | 1 | 2 | 4 | 1 |

Four cross-cutting findings (X-01 to X-04: the "fully ticked" claim in `specs/README.md`, SPECKIT still at constitution v2.0.0 with a stale list, the CLAUDE.md 348/540 line, and the post-hoc process) were fixed and are not counted above.

### Spec 24 (ADS, auto reload, gravity)
- 24-01 HIGH: gravity -22 and "heights stay 3.9 m" were stale (now -30, jump 7.55 / 7.15 m/s, 0.95 m, +0.85, 1.8 m). Fixed.
- 24-02 MED: "0.15 s" ramp vs `ADS.response` 14. Fixed.
- 24-03 MED: the plan omitted the `src/core/ads.ts` helpers. Fixed.
- 24-04 MED: aim cancel rules, walk speed, sprint block and the Settings checkbox have no test or browser check. Left, `[N]`, T012 skipped.
- 24-05 LOW: default bindings not asserted; ADS poses sit outside `ADS`. Documented.
- 24-06 LOW: T010 mixed tests and screenshots; FR-007 had no task. Fixed.

### Spec 25 (world dressing and mood)
- 25-01 HIGH: vehicles were 11, 0.3 MB, vertex-colour, `props.py`; now 12, 5.5 MB, textured PBR, `vehicles_sf.py`. Fixed.
- 25-02 HIGH: "Sketchfab out of scope (needs a token)" is contradicted by PR #13 and specs 26 to 29. Fixed.
- 25-03 MED: supplies and budget stale (now 8 crates, 570 vs 356). Fixed with history.
- 25-04 MED: "about 70 clutter" vs 51 `DRESSING` items now. Fixed; the 70 was not re-derived.
- 25-05 MED: the mood has no test or objective check. Left.
- 25-06 MED: the "22 extra draw calls" claim was unsupported. Removed; precache checked by hand in `dist/sw.js`.
- 25-07 LOW: a history task with no requirement; no task for the PR #13 rework. Fixed.

### Spec 26 (enemy models and Biped)
- 26-01 HIGH: biped clearance 1.8 m, now 1.3 m. Fixed.
- 26-02 HIGH: `ENEMY_DISTRIBUTION` stale after spec 29. Fixed.
- 26-03 MED: budget statements inconsistent. Fixed: 116 / 348 vs 540 / 356 vs 570.
- 26-04 MED: GLB sizes given only as limits (actual 0.90 / 0.92 / 0.93 MB). Fixed.
- 26-05 MED: no test for allocation or "Spot unchanged"; balance and the moving-player leap never played. Left, T013 skipped.
- 26-06 LOW: "no audio assets" outdated. Fixed.
- 26-07 LOW: no requirement traces; test count at merge not recoverable. Fixed except the count.

### Spec 27 (crab boss)
- 27-01 HIGH: spin 2.4 m and "jump the laser" stale (now 1.4 m and 1.3 m, double jump). Fixed.
- 27-02 HIGH: Principle II row said PASS for the `BossPhase` change. Fixed: JUSTIFIED plus a Complexity row.
- 27-03 HIGH: the checklist claimed edge cases the spec did not contain. Fixed: kept those backed by tests or code.
- 27-04 MED: ammo budget stale. Fixed.
- 27-05 MED: no Success Criteria or Edge Cases sections. Added.
- 27-06 MED: drone physics meta, disposal, HUD bar and movement band untested; no full fight played. Left, T013 skipped.
- 27-07 MED: dodge thresholds changed, browser not re-run. Noted in T012.
- 27-08 LOW: "337/348" are ammo hits, not test counts. Fixed.

### Spec 28 (scorpion model)
- 28-01 MED: size limits vs real (15.6k triangles, 0.71 MB). Fixed.
- 28-02 MED: the 1.9 m dodge clearance is above the double jump. Added as a known limit.
- 28-03 MED: "gameplay unchanged", the 5 s timeout and `?colliders` untested. Left, T010 skipped.
- 28-04 LOW: Principle III row PASS for animation constants. Fixed: JUSTIFIED.
- 28-05 LOW: no requirement traces; walk gait seen only mid-charge. Fixed.

### Spec 29 (warehouse, L map, drones, props)
- 29-01 HIGH: status "in progress" on a merged feature. Fixed.
- 29-02 HIGH: T041 claimed mezzanine shots and props were browser-checked; the record shows neither. Fixed: T043 skipped, shooting through a window is `[N]`.
- 29-03 HIGH: the checklist had 6 items and none verified anything. Rewritten.
- 29-04 MED: verification notes were unticked prose. Converted to ticked sub-items and skipped items.
- 29-05 MED: "draw calls to be measured" (measured 56 to 151); Principle V missed `PhysicsWorld.ts` and `bakeNav.ts`. Fixed.
- 29-06 MED: the back door (4.5 m) vs mezzanine deck (3.4 m) and `win-n1` over the door conflicts are unresolved. Left for an owner decision.
- 29-07 MED: interior look, robots in aisles and drone glow near the camera unverified. Left, T045 skipped.
- 29-08 LOW: owner feedback loops not recorded. Added.
- 29-09 LOW: stream notes say "no browser check". Kept as records.

### Spec 30 (fences and gates)
- 30-01 MED: audio route `hitArmor`, now the `gate` sample. Fixed.
- 30-02 MED: `GATE` layer filters (bullets, sight, nav, drones) untested. Left, T009 skipped.
- 30-03 MED: spec not in template structure. Rewritten.
- 30-04 MED: Principle V missed `core/events.ts` and `physics/groups.ts`. Fixed.
- 30-05 LOW: no Technical Context; livery had no requirement. Fixed.
- 30-06 LOW: test count 612 stale. Fixed.

### Spec 31 (samurai crescent wave)
- 31-01 HIGH: the plan said "no new events" and "samurai module only", but `enemy:waveReleased` is in `core/events.ts` and `audio/eventMap.ts`. Fixed.
- 31-02 MED: the two owner feedback rounds were not recorded. Added.
- 31-03 MED: skill selection, spin orientation and wall/gate rules untested; walls and gates not browser-checked. Left, T010 skipped.
- 31-04 MED: literals `SPIN_FORWARD` 0.55 and the 35 degree clamp are not in tunables. Plan JUSTIFIED; T011 skipped.
- 31-05 LOW: no FR/SC ids, thin checklist. Fixed.
- 31-06 LOW: `crescentShape` / `crescentRibbon` live in `Samurai.ts` (imports three). Left.

### Spec 32 (recorded audio)
- 32-01 CRITICAL: Principle VI forbids audio files without maintainer approval; the plan said PASS and the constitution is unchanged. The row is now JUSTIFIED and the owner's request is recorded as the approval. The amendment itself is left to the owner (T020).
- 32-02 HIGH: "spec 31 on another branch" and the boss shockwave playing the energy wave are stale. Fixed.
- 32-03 HIGH: T014 and T019 open without the skipped convention. Fixed.
- 32-04 MED: the plan said "no new events". Fixed.
- 32-05 MED: budget wording blurred. Fixed: 1,268,320 B, test cap 3 MB, owner cap 6 MB.
- 32-06 MED: nothing audibly verified; impacts not browser-run. Stated `[N]`, T019 skipped.
- 32-07 MED: sample gains live in the manifest, not tunables. JUSTIFIED.
- 32-08 LOW: unsourced sounds scattered. Consolidated.

## Coverage (requirements with a task / a unit test / a browser check)

| Spec | FR | Task | Unit test | Browser |
|---|---|---|---|---|
| 24 | 9 | 100% | 44% | 22% |
| 25 | 8 | 100% | 75% | 38% |
| 26 | 10 | 100% | 80% | 60% |
| 27 | 7 | 100% | 86% | 43% |
| 28 | 8 | 100% | 88% | 25% |
| 29 | 12 | 100% | 83% | 50% |
| 30 | 8 | 100% | 50% | 38% |
| 31 | 9 | 100% | 33% | 78% |
| 32 | 11 | 100% | 91% | 73% |
| All | 82 | 100% | 71% (58) | 49% (40) |

## Constitution issues
- **VI (spec 32, was critical): RESOLVED 2026-11-20.** The owner approved and the constitution was amended to 2.1.0: audio files are allowed (CC0/CC-BY, built by `tools/asset-pipeline/audio.sh`, procedural fallback per sound id).
- **II:** the spec 27 phase-enum change is JUSTIFIED. Specs 30, 31 and 32 added events to the shared `core/events.ts` instead of declaring them by merging; additive, and now declared in their plans.
- **III:** literals `SPIN_FORWARD` and 35 degrees (spec 31), animation constants (spec 28) and manifest gains (spec 32) are JUSTIFIED in the plans. Only the spec 31 pair is worth moving into tunables.

## Could not verify
- Anything heard (audio output, mix, Safari Ogg).
- Real-GPU frame rate and medium/high presets.
- Balance and full runs.
- Smoke and e2e (stale, not run).
- Spec 29: shooting through a window, the interior look, robots in the aisles.
- Spec 30: `GATE` layer filters. Spec 31: selection logic, walls/gates rule, spin orientation.
- Test counts at merge for specs 26, 27 and 28.
- `DRESSING` is 51 items in the code now; the "about 70" at spec 25 time was not re-derived.

## Owner decisions
1. ~~Amend constitution Principle VI for audio files.~~ Done (2.1.0, 2026-11-20). Still open: 2, 3, 4 below.
2. Spec 29 contract conflicts: back door 4.5 m vs mezzanine deck 3.4 m, and `win-n1` over the door. Change the contract or accept.
3. Samurai (1.8 m) and scorpion (1.9 m) dodge clearances sit at or above the double jump (1.8 m): lower them, or raise the jump.
4. ~~Move `SPIN_FORWARD` and the 35 degree limit into `SAMURAI` tunables.~~ Done 2026-11-21 (`SAMURAI.spin.fanForward`, `SAMURAI.wave.aimMinCos`).
