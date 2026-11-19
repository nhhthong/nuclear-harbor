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

Folders numbered 24 and above are current and describe the game as built: `24-ads-autoreload-gravity`, `25-world-dressing-and-mood`, `26-enemy-models-and-biped` (Biped, Striker, Spot model; roster 22) and `27-crab-boss` (Gunslinger Crab Mech, dragonfly drones; ammo budget 348 hits). Each has `spec.md`, `checklists/requirements.md`, `plan.md` and a fully ticked `tasks.md`.

New work: follow `docs/SPECKIT.md` (new features use Spec Kit; small fixes and tuning do not).
