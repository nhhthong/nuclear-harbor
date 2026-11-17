# specs/: Spec Kit artifacts (HISTORICAL)

These folders were produced by the per-ticket Spec Kit flow while the first version of the game was built
(four towers, grapple, 240 x 220 m map, 30 robots, dinosaur). **They describe that version, not the current game.**
Do not use them as a source of truth. Current state: `docs/PLAN.md` ("Current state"), `docs/DEVIATIONS.md` (last section), `CLAUDE.md`.

The later reworks (sunset quay, scorpion, samurai, area streaming, HUD/radar, gaits, shelters) were done directly
at the owner's request, **without Spec Kit** and without e2e. They have no folder here; see `docs/DEVIATIONS.md`.

| Folder | Original scope | Fate in the current game |
|---|---|---|
| T-01-player-controller | movement, look, camera | kept; gravity is now `PLAYER.gravity` -15 (higher jumps) |
| T-02-weapon | G36C, ammo, reload | kept |
| T-03-world-greybox | 240 x 220 m harbor | replaced: 72 x 122 m quay, seeded irregular yard (`src/world`) |
| T-04-cranes-and-anchors | cranes, perches, grapple anchors | cranes kept (`CRANE_SITES`); anchors/perches unused |
| T-05-enemy-framework-sphere | enemy framework, army mech | kept; framework extended (areaSpawner, gait) |
| T-06-hud-menus | HUD, menus | replaced: redesigned HUD, radar, cinematic menu |
| T-07-audio | procedural audio | kept |
| T-08-objectives | 4 towers, countdown | reduced to 1 tower |
| T-09-pickups | ammo, medkits, drops | kept; counts changed (crates 10+6, medkits 4+2) |
| T-10-vfx | pooled VFX | kept; camera shake added |
| T-11-perf-debug | perf monitor, overlay | kept |
| T-12-grappling-hook | grapple | REMOVED (module deleted; `grappleAnchors` remains in `GameContext` as legacy) |
| T-13-spider-robot | spider | replaced by Spot dog (T-19) |
| T-14-charger-robot | charger | replaced by Bomber Duck (T-19) |
| T-15-boss-titan04 | final boss | kept; half-size, cinematic by T-22 |
| T-16-game-flow-integration | flow, population | partly kept; population replaced by `AreaSpawner` streaming |
| T-17-optimization-offline | perf, offline | partly valid; see `docs/PERFORMANCE.md` banner |
| T-18-weapon-asset-pipeline | MDL to GLB | kept (G36C GLB is the only binary asset) |
| T-19-duck-spot | Bomber Duck, Spot | kept (ids `duck`, `spot`) |
| T-20-army-robot | Vanguard army mech | kept (id `army`) |
| T-21-dinosaur | dinosaur semi-boss | REPLACED by the mecha scorpion STINGER-7 (`src/scorpion`) |
| T-22-final-boss | spherical boss, cinematic | kept |

Folders numbered 24 and above (`24-ads-autoreload-gravity`, `25-world-dressing-and-mood`) are current and describe the game as built.

New work: follow `docs/SPECKIT.md` (current policy) and create a new folder only if the owner requires Spec Kit for it.
