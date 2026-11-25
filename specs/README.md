# specs/: Spec Kit artifacts

- `T-01..T-22`: **historical.** Per-ticket flow of the first version of the game (four towers, grapple, 240 x 220 m map, 30 robots, dinosaur). They describe that version, not the current game; the table below maps each to its fate.
- `24` and above: **current**, describe the game as built, one folder per feature (`spec.md`, `checklists/requirements.md`, `plan.md`, `tasks.md`). Number 23 was never used.
- Reworks between T-22 and 24 (sunset quay, scorpion, samurai, area streaming, HUD/radar, gaits, shelters) have no folder; see `docs/DEVIATIONS.md`.
- Process, next number and definition of done: `docs/SPECKIT.md`. Current state: `docs/PLAN.md` ("Current state"), `docs/DEVIATIONS.md`, `CLAUDE.md`.

| Folder | Original scope | Fate in the current game |
|---|---|---|
| T-01-player-controller | movement, look, camera | kept; gravity is now `PLAYER.gravity` -15 (higher jumps) |
| T-02-weapon | G36C, ammo, reload | kept |
| T-03-world-greybox | 240 x 220 m harbor | replaced: 72 x 122 m quay, seeded irregular yard (`src/world`) |
| T-04-cranes-and-anchors | cranes, perches, grapple anchors | cranes kept (`CRANE_SITES`); anchors/perches unused |
| T-05-enemy-framework-sphere | enemy framework, army mech | kept; framework extended (areaSpawner, gait, authored clips) |
| T-06-hud-menus | HUD, menus | replaced: redesigned HUD, radar, cinematic menu |
| T-07-audio | procedural audio | kept |
| T-08-objectives | 4 towers, countdown | reduced to 1 tower |
| T-09-pickups | ammo, medkits, drops | kept; counts changed (crates 10+6, medkits 4+2) |
| T-10-vfx | pooled VFX | kept; camera shake added |
| T-11-perf-debug | perf monitor, overlay | kept |
| T-12-grappling-hook | grapple | REMOVED (module deleted; `grappleAnchors` remains in `GameContext` as legacy) |
| T-13-spider-robot | spider | replaced by Spot dog (T-19) |
| T-14-charger-robot | charger | replaced by Bomber Duck (T-19) |
| T-15-boss-titan04 | final boss | REPLACED by the Gunslinger Crab Mech (`27-crab-boss`): no weak points, one HP pool, four skills |
| T-16-game-flow-integration | flow, population | partly kept; population replaced by `AreaSpawner` streaming |
| T-17-optimization-offline | perf, offline | partly valid; see `docs/PERFORMANCE.md` banner |
| T-18-weapon-asset-pipeline | MDL to GLB | kept (G36C GLB is the only binary asset) |
| T-19-duck-spot | Bomber Duck, Spot | Duck kept; Spot has the Walking Robotic Dog model (`26-enemy-models-and-biped`) |
| T-20-army-robot | Vanguard army mech | REPLACED by the Medium Mech Striker (id `army` kept; bursts and AOE rockets, `26-enemy-models-and-biped`) |
| T-21-dinosaur | dinosaur semi-boss | REPLACED by the mecha scorpion STINGER-7 (`src/scorpion`) |
| T-22-final-boss | spherical boss, cinematic | landing cinematic kept for the crab; boss body replaced (`27-crab-boss`) |

Folders numbered 24 and above are current and describe the game as built (rewritten against the code on 2026-11-20, see `ANALYSIS-2026-11.md`; PRs are the squashed or merge PRs into `main`):

| Folder | What it is | PR |
|---|---|---|
| `24-ads-autoreload-gravity` | aim down sights, auto reload, gravity (now a natural jump 0.95 m) | #11 |
| `25-world-dressing-and-mood` | 12 vehicles, 51 clutter items, scarce supplies, cold overcast mood | #11, #13 |
| `26-enemy-models-and-biped` | Biped, Striker, Spot model; roster 22 | #15 |
| `27-crab-boss` | Gunslinger Crab Mech (5800 HP, 4 skills), dragonfly drones | #15 |
| `28-scorpion-model` | STINGER-7 look and animation from an authored GLB; gameplay unchanged | #17 |
| `29-warehouse-l-map` | L map, warehouse, flying drone enemy (4 + call-ins), interior props; ammo budget 356 hits vs supply 570 | #18, #19, #20 |
| `30-fences-and-gates` | two fences, five swing gates, `GATE` layer | #20 |
| `31-samurai-crescent-wave` | frontal spin, red-charge crescent wave (32 damage, 12 m/s) | #21 |
| `32-recorded-audio` | 75 OGG samples (1.27 MB), procedural fallbacks; mix pass open | #21 |
| `33-boss-solo-jump-gates-ammo` | double jump to about 3.2 m, quay emptied of robots, locked quay gates until the tower, +4 crates (supply 690), scorpion unstuck | #25 |
| `34-boss-phase-two-and-drops` | boss: spin removed, claw grab and claw quake below 50% HP, no quay shelters, dragonfly drops | #26 |
| `35-claw-grab-cutscene` | claw grab arm animation, cutscene camera, bars, flashes and shakes | #26 |

Each has `spec.md`, `checklists/requirements.md`, `plan.md` and `tasks.md`. Every requirement carries a check tag (unit test, browser check, or not verified) and every task is ticked or marked "skipped: reason"; open items are the skipped ones (spec 24 T012, 25 T011, 26 T013, 27 T013, 28 T010, 29 T043/T045, 30 T009, 31 T010, 32 T014/T019, 33 T009, 34 T010, 35 T008). Next free number: **36** (highest folder plus 1; 23 was never used).

New work: follow `docs/SPECKIT.md` (new features use Spec Kit; small fixes and tuning do not).
