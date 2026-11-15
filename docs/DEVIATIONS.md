# Where the game differs from the GDD (v1.2)

`docs/GDD.md` is the original design and is not edited. When this file and the GDD disagree, **this file wins**.
Facts below come from the merged tickets and their reports; "not verified" means no browser/e2e/visual check was done.

## Enemies (GDD 6, 9)
The 30 normal robots keep the 14 / 10 / 6 split, but the types changed (ids in code: `army`, `spot`, `duck`; the old ids were renamed in T-23 phase B).

| Count | Id | Was | Now | Key numbers (tunables, not play-tested) |
|---|---|---|---|---|
| 14 | `army` | sphere robot | Vanguard army mech (orange biped, rockets) | HP 150; patrol 1.5 m/s; rockets 25 m/s, 12 dmg, splash 3 m, salvo 2-3, 3 s cooldown; keeps 18-25 m, retreats under 8 m |
| 10 | `spot` | spider robot | Spot dog | HP 70; chase 6.8 m/s; crouch 0.45 s, lunge 15 m/s; 10 dmg + knockback, 2.5 s cooldown |
| 6 | `duck` | Charger | Bomber Duck | HP 60; hops 6.2 m/s; arms at ~2.5 m, beeps 3-2-1, blast at 3.0 s; 15 dmg inside 4 m, 0 if shot dead first |

New, outside the 30: **Dinosaur semi-boss** (`src/dinosaur`, mecha T-Rex ~9 m, HP 1500, head crit 2x). At run start 2 of the 4 towers are picked with `?seed=N`; it spawns when the player first comes within ~35 m of that tower. Skills: ram (25 dmg), tail spin (20 dmg, 9 m ring), leap + stomp (30 dmg, 8 m radius). Drops 4 ammo crates + 1 medkit. Its fight was never completed in an e2e run: damage/radius/timing are design values only.

## Final boss (GDD 9)
TITAN-04 keeps its name and phases but is now the spherical walker (4 legs, orange eye): **17.7 m tall** (GDD said 22 m; warehouse is 10 m). Damage only through the **4 knee LED lights** (500 HP each; armour absorbs); then the eye core (4000 HP) opens. It appears when the last tower is done (`objectives:allActivated`) with a 6.2 s landing cinematic (falls from the sky onto a free spot of the boss arena, letterbox bars, E skips after 2 s, player locked and invulnerable meanwhile). Heavy Cannon, Ground Slam, Missile Barrage are implemented; the optional attacks are not. 36 draw calls.

## Weapon (GDD 5)
The DesertTech MDR / GameBanana idea was dropped. The owner supplied a GoldSrc view model (`assets-src/weapons/g36c/v_g36c.mdl`, G36C, author credit **funnky**, permission to use stated by the owner, see `docs/ASSETS.md`). `tools/asset-pipeline` converts it with a pure-Python MDL reader to `public/assets/weapons/g36c/g36c.glb` (all 6 animations recovered). The GLB is the default; it falls back to the procedural model on any load error; `?viewmodel=procedural` forces the placeholder. HUD weapon name is "G36C".

## Gameplay rules and numbers
- Towers: ids are **1-based** (1..4); tower 3 stands on a 10 m gantry reachable by grapple only; defend waves reuse existing robots (no extra spawns); passive 5 s hold costs about 12-44 HP depending on the tower (scripted run).
- Death: checkpoint at each activated tower and at the boss start; countdown does not reset; Restart in the UI reloads the page.
- Controls: RMB reload and `R` alias; **no jump**; **P toggles pause** (Esc does not resume, because of pointer lock).
- Ammo: a unit test now computes 372 hits for the 30 reworked robots (the GDD table says 404 in total with the boss); real play was never measured.
- Grappling: perches at 8 / 14 / 20 m are free-standing towers (not on the dock cranes); ends standing on the perch via a landing point.
- Zones: 4, as in GDD v1.2; cargo ship is a static backdrop.

## Engineering decisions that were not in the GDD
Rapier KCC; procedural audio (Web Audio) and procedural models, no asset files except the G36C GLB; shared `src/config/tunables.ts` plus per-module tunables; static sun shadow refreshed at 6 Hz (medium) / 12 Hz (high); global budget 350 draw calls (menu ~213, harbor ~215 before the robot refresh); hand-written service worker for offline; bundle ~5.3 MB (Rapier WASM is 82%); no zone streaming (never built; the whole harbor loads at once); credits screen in the menu.

## Compact-harbor rework (latest; overrides the sections above where they disagree)
- **Map**: 144 x 152 m (was 240 x 220). Zones keep their roles: C warehouse/start (south), A container yard (west), B crane zone (east), D dock + boss arena (north). Towers: 1 (16, 43) inside the warehouse, 2 (-36, -3), 3 (38, -4) on a 3 m gantry, 4 (32, -56); consecutive objectives are at most ~70 m apart. Boss arena centre (-28, -60), radius 28. Layout constants: `src/config/level.ts`.
- **Blocked points** (`src/world/barriers.ts`): parapet + invisible wall around the whole land (no falling into the sea, no leaving the map); 5 m blast walls seal both passages beside the warehouse, so the spawn forecourt only leads through the warehouse; a blast wall on the yard/dock border leaves two gates (x -46..-10 and 22..50).
- **Movement**: the grappling hook is removed (module, HUD widget, sounds, events). Space = jump, a second press in the air = double jump (1.9 m + 1.7 m; one container or the tower-3 gantry needs both). Walk 6.5 m/s, sprint 10 m/s, air control 0.55, coyote time and jump buffering. Duck hop 8 m/s and Spot chase 8.6 m/s were raised to stay between walk and sprint. No boss perch towers any more; the tower-3 platform is 3 m high.
- **Physics fix**: characters placed exactly on a surface sank into the ground (Rapier skin) and stalled at sprint speed; they are now placed 4 cm higher (`PLACEMENT_LIFT`).
- **Dinosaur**: guards only outdoor towers (2-4); trigger 22 m, leash 24 m, aggro 40 m.
- **Look**: sky dome with drifting clouds and a sun-side warm tint; a prefiltered sky reflection probe as `scene.environment`; corrugated-steel bump + worn roughness on containers and cladding; wet-concrete roughness; more metallic cranes; emissive lamp heads and crane beacons; bloom (medium/high presets, `PERFORMANCE.bloom`); hemisphere light lowered.
- **Effects**: tracers are flying HDR streaks instead of 1 px lines; muzzle flash is brighter and drives one shared point light; impacts add a core flash and dust; explosions add falling embers, more smoke, a stronger light flash and a wider ring.
- **Stale after this rework**: every `tests/e2e/*.mjs` file still contains old-map coordinates and the grapple steps (T-12 e2e was deleted); they were not updated or run. `docs/PLAYTEST.md` numbers and screenshots describe the old map.

## Tiny night quay rework (overrides everything above where they disagree)
Owner brief: keep the scope tiny and push the look as far as code-generated content allows.
- **Level**: one quay, 72 x 86 m (`src/config/level.ts`): gate apron (spawn) -> container yard -> relay court (the only tower, at (0, -14)) -> quay with the boss arena (centre (-8, -35), radius 17) and one gantry crane. The warehouse, control center, three towers, blast walls and five cranes are gone.
- **Enemies**: 8 regular robots (3 army, 3 Spot, 2 Duck). The dinosaur semi-boss module was removed (see git history before this rework). TITAN-04 is half size in the harbor (`BOSS_LOCAL.harborScale` 0.5, about 9 m tall); HP unchanged (4 x 500, core 4000).
- **Economy**: countdown 8 min; 6 + 6 ammo crates, 3 + 2 medkits; demand about 273 hits against 570 rounds.
- **Setting**: night, overcast, rain, lightning. Moon as the only directional light; seven flood-light masts (`src/structures/layout.ts`) as spot lights, four with shadows, each with a volumetric beam mesh; exponential fog.
- **Rendering**: containers are real geometry (`src/world/containerModel.ts`, about 1.6k triangles, instanced) with a weathered-paint shader shared by the crane, kerb and props; the ground is one procedural wet-surface shader with a planar reflection pass (`src/world/ground.ts`, registered through `Renderer.preRender`); rain is two GPU-animated draw calls; post chain = MSAA HDR -> GTAO (high preset) -> bloom -> ACES -> grade (vignette, grain, aberration). Quality presets gate shadows, reflection, bloom and AO.
- **Measured** (software GL, medium preset): 210 to 250 draw calls, about 1.1 M triangles per frame including shadow and reflection passes. No GPU frame-rate measurement exists.
- **Removed code**: `src/dinosaur`, `src/world/buildings.ts`, `src/world/textures.ts`, the old box-based `src/structures` (cranes with LOD, perches, lamp coverage).
- **Stale**: every `tests/e2e/*.mjs`, `docs/PLAYTEST.md`, `docs/PERFORMANCE.md` numbers, `docs/PLAN.md` module table, tickets and specs describe earlier versions of the level.


## Sunset rework, Crimson Rex, area streaming (latest; overrides everything above where they disagree)
Owner feedback from a real machine: lag and a black screen when turning; asked for sunset without rain (surfaces stay wet), better robots, pickups, combat effects and menu, the dinosaur semi-boss back, and robots that spawn per area.
- **Setting**: sunset after rain. Rain, splashes, ripples and lightning are removed (`src/world/rain.ts` deleted). The low sun is the only real light and the only shadow map; all nine spot lights and the volumetric beams are gone (lamp heads are emissive). Planar reflection scale and refresh rate are per preset (`reflectionScale`, `reflectionEvery`).
- **Black screen**: a NaN or infinite pixel is spread over the whole frame by the bloom. `SANITIZE_SHADER` in `src/core/Renderer.ts` now clears such pixels before the bloom, and the wet-ground fresnel is clamped. One reproduction was found and fixed in the cloud (a telegraph shader); whether this was the cause on the owner's GPU is **not confirmed**.
- **Robots**: object-space weathered metal (`createVertexColorMaterial(..., weather)`), Spot "Hound" and Duck "Bomber" palettes and kits, extra parts on the army mech.
- **Area streaming** (`src/enemies/areaSpawner.ts`, `ENEMY_LOCAL.area`): roster of 18 (5 army, 8 Spot, 5 Duck; yard 10, court 4, quay 4, apron 0). Nothing is alive at load. An area wakes when the player is within 5 m of it; one robot appears every 0.25 s, never closer than 13 m, 10 alive at most. After the player has been more than 12 m outside for 3 s, robots farther than 28 m are removed and return when the area wakes again; killed robots stay dead. Shaders of the three robot types are compiled at load.
- **Crimson Rex** (`src/dinosaur`, restored from history and reworked): 6 m, 1300 HP, guards the single tower, rises on its far side when the player comes within 15 m. Skills as before (charge, leap stomp, tail spin) with numbers scaled to the small map, new war kit on the model, pose channels (lean, leg tuck, tail lash, glow flicker), shader telegraphs, tail trail, staged death, enrage below 40% HP. It is not part of `ctx.enemies`. The tower can still be activated while it lives (unchanged rule).
- **Economy**: 9 + 6 ammo crates, 4 + 2 medkits; demand about 309 hits against 660 rounds, not counting the Rex (it drops 4 crates and 1 medkit).
- **Pickups, VFX, menu**: modelled ammo case and trauma kit with light columns; shrapnel, dust skirt, embers, muzzle smoke, scorch marks, smouldering wrecks and camera shake (`VFX.shake`); cinematic main menu with a crane shot of the level.
- **Measured** (software GL, medium): about 100 to 180 draw calls and 0.45 to 0.56 M triangles per frame. No GPU frame-rate measurement exists.
- **Not verified**: a full run, balance with 18 robots and the Rex, the Rex inside the court next to containers, frame rate on a real GPU.
- **HUD** (`src/ui/hud.ts`, `src/ui/styles.ts`): segmented HP bar with a lagging damage ghost, magazine bar with reload progress, countdown with a remaining-time bar, heading tape, gap crosshair, X hit marker, lower-third toasts; a **radar** in the top-left corner (42 m, up = view direction) shows robots, the relay tower, the Rex (read through `testHooks.dinosaur`) and the boss spawn point.
- **Rex model**: chest, skull, jaw, feet and tail are lofted superellipse shells (`loft()` in `src/dinosaur/DinoModel.ts`) instead of boxes; the hit volumes are unchanged.
- **Scorpion replaces the dinosaur** (owner request, model after `docs/reference-models/cyborg_scorpion.html`): `src/dinosaur` became `src/scorpion`, events are `scorpion:*`, the HUD name is STINGER-7. Same spawn rule, HP, states, drops and enrage. Model: 13 pivots, about 21 draw calls; the tail arches forward over the body (the showcase curls it backwards). Skills: **charge** (knockback 22 along the charge, stun on a wall), **venom shot** (glob with a 0.8 s arc, burst up to 14, pool radius 4.5 m for 5 s at 5 damage per 0.5 s) and **tail slam** (fan of 9 m and about 34 degrees each side, 28 damage, nine blasts running outwards). The Rex notes above describe the removed model. Forced skills were checked by screenshots; damage numbers are unplaytested.
