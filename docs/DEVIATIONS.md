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
