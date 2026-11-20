# Credits and licenses

Project code is released under the [MIT License](LICENSE). Third-party assets and libraries are listed below. The in-game Credits screen (`src/ui/credits.ts`) and [`docs/ASSETS.md`](docs/ASSETS.md) (source ids, build scripts, processing) carry the same entries. Raw source downloads are not committed; only the built GLBs ship, and each build script in `tools/asset-pipeline/` lists its exact sources.

## Not covered by the MIT license

| Asset | Author | License | Notes |
|---|---|---|---|
| G36C view model (`assets-src/weapons/g36c/`, `public/assets/weapons/g36c/`) | **funnky** | **Unclear** | Used with the author's permission as stated by the project owner. No licence text ships with the file: confirm the terms before redistributing or selling the game. |

## Libraries and tools

| Component | License | Use |
|---|---|---|
| [Three.js](https://threejs.org/) | MIT | Rendering |
| [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) | Apache-2.0 | Physics |
| [Vite](https://vite.dev/), [Vitest](https://vitest.dev/) | MIT | Build and unit tests |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 | Language |

## Robots and bosses (Sketchfab, CC-BY 4.0)

| Used for | Model | Author | Changes | Built into |
|---|---|---|---|---|
| Cyber samurai (elite) | [Cyberpunk Samurai Robot](https://sketchfab.com/3d-models/cyberpunk-samurai-robot-6b7c89af7c5b4a17a94f890e0ec3eedf) | byhoangtran | Split at the hips and knees, katana removed | `enemies/samurai.glb`, `samurai.py` |
| Biped robot (infantry) | [Biped robot](https://sketchfab.com/3d-models/801d2a245e4a4405a0c2152b35b5e486) | skudgee (Willy Decarpentrie) | Display base removed, decimated, run, crouch, leap and claw clips authored | `enemies/biped.glb`, `enemies_sf.py` |
| Medium Mech Striker (army robot) | [Medium Mech Striker](https://sketchfab.com/3d-models/27ba717c173a40b7841d2f2c6a89d823) | MSGDI | Decimated, 512 px textures, idle, walk and run clips kept | `enemies/striker.glb`, `enemies_sf.py` |
| Spot dog | [Walking Robotic Dog](https://sketchfab.com/3d-models/cb8157f40d39456d9f37865b4e6e7477) | reececreoplan (CreoPlan Ltd) | Decimated, 512 px textures, leg clips merged | `enemies/spot.glb`, `enemies_sf.py` |
| Semi-boss STINGER-7 | [Scorpion Robot](https://sketchfab.com/3d-models/e44be9a622af4e85b4b10cf59b25de1a) | Mirandanimator | Split into body, four legs and a four-segment tail, decimated to 15.6k triangles, recoloured (dark gunmetal, green emissive accents) | `enemies/scorpion.glb`, `scorpion_sf.py` |
| Final boss | [Gunslinger Crab Mech v1.2](https://sketchfab.com/3d-models/5147619f337a45b0974f349eac27b34a) | vaportrash | Legs split at the hips, decimated, textures resized | `enemies/crab-boss.glb`, `boss_sf.py` |
| Boss drones | [Light Assault Mech](https://sketchfab.com/3d-models/d1ca5065b5184646bc7028597d0ce049) | Lagst | Armature applied, decimated | `enemies/dragonfly-drone.glb`, `drone_sf.py` |

## Warehouse props (spec 29)

| Asset | Source | Author | Licence | Built into |
|---|---|---|---|---|
| Pallet jack | [Low Poly Pallet Jack](https://sketchfab.com/3d-models/5b0b9b7b1e1640cf9804588a763cc9f1) | Monke (cosmiccobra) | CC-BY 4.0 | `props/warehouse.glb`, `warehouse_props.py` (decimated, textures resized) |
| IBC tank | [IBC Tank](https://sketchfab.com/3d-models/55723c0e512242e989dbb996fbef095e) | DartleDyan | CC-BY 4.0 | `props/warehouse.glb`, `warehouse_props.py` (decimated, textures resized) |
| Wooden pallet | [Wooden Pallets](https://sketchfab.com/3d-models/dba5c00928cd400796d9f6fffdd724b3) | YadroGames | CC-BY 4.0 | `props/warehouse.glb`, `warehouse_props.py` (decimated, textures resized) |
| Computer desk set | [Low Poly Computer Desk](https://sketchfab.com/3d-models/c67f61fa444044bcb88ec3e28f0ca7ac) | Glowbox 3D | CC-BY 4.0 | `props/warehouse.glb`, `warehouse_props.py` (decimated, textures resized) |
| Crates, boxes, plastic crates, barrel, jerrycan, propane tank, tool cart, welding cart, tool chest, bench vice, ladder, office desk, drawer cabinet, stool, binder, trash can, fire extinguisher, hanging lamp, wet floor sign, cement bag (`cardboard_box_01`, `wooden_crate_01`, `wooden_crate_02`, `plastic_crate_01`, `Barrel_02`, `metal_jerrycan`, `propane_tank`, `tool_cart`, `portable_welding_cart`, `metal_tool_chest`, `bench_vice_01`, `ladder_sectioned_01`, `metal_office_desk`, `drawer_cabinet`, `metal_stool_01`, `binder_notebook`, `metal_trash_can`, `korean_fire_extinguisher_01`, `hanging_industrial_lamp`, `WetFloorSign_01`, `cement_bag`) | [Poly Haven](https://polyhaven.com) | Poly Haven contributors | CC0 | `props/warehouse.glb`, `warehouse_props.py` |

The pallet racks and the workbench are procedural (`src/structures/warehousePropMeshes.ts`).

## Vehicles (Sketchfab, CC-BY 4.0)

| Vehicle | Model | Author | Changes |
|---|---|---|---|
| Sedan | [Kiri '10](https://sketchfab.com/3d-models/7fd6e15785fa4aa9bfd6e31eb7c97ba6) | Daniel Zhabotinsky | Decimated, 512 px textures, painted per instance |
| Hatchback | [Milano '95](https://sketchfab.com/3d-models/122a22d210234596ad23623588d0d166) | Daniel Zhabotinsky | same |
| SUV | [Urban '10](https://sketchfab.com/3d-models/2866efdfa943484391ef8313768e074d) | Daniel Zhabotinsky | same |
| Van | [Shvan '92](https://sketchfab.com/3d-models/09d718c9cf72401b8534d265a06a803f) | Daniel Zhabotinsky | same |
| Pickup | [Conquer '89 Pickup](https://sketchfab.com/3d-models/6c48c94be8974dc7a5932f697c0ba68f) | Daniel Zhabotinsky | same |
| Box truck | [LCT 3000 '07](https://sketchfab.com/3d-models/3be03b6a43aa41898c9ca806b8787052) | Daniel Zhabotinsky | same |
| Semi-truck | [Yellow semi-truck with trailer](https://sketchfab.com/3d-models/ee0a8763bd8941f1bc546b43332d4001) | Chenzoss | Decimated, 512 px textures |
| Forklift | [Forklift Truck](https://sketchfab.com/3d-models/060f3f8bc7de4e6ca2f348d414702e9d) | louis-muir | 512 px textures |
| Mobile crane truck | [Ural KS3574 / interior](https://sketchfab.com/3d-models/317c5dbcad974d9f99efd079060d4344) | Basic Hsu (Hsu.Pei.Ge) | Interior dropped, decimated, 1024 px textures |

All vehicles are built into `public/assets/props/vehicles.glb` by `tools/asset-pipeline/vehicles_sf.py`.

## Props and weapons (CC0)

| Asset | Source | License | Built into |
|---|---|---|---|
| Outdoor asphalt texture (`asphalt_02`: colour 1k, normal and AO/roughness/metal maps 512 px) | [Poly Haven](https://polyhaven.com/a/asphalt_02) | CC0 | `public/assets/textures/ground/` |
| Warehouse floor and quay slab texture (`concrete_floor_worn_001`: colour, normal, AO/roughness/metal maps at 1k) | [Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001) | CC0 | `public/assets/textures/warehouse-floor/` |
| Cabinets, barrier, barrels, tyre, generator, work light (`utility_box_01/02`, `concrete_road_barrier_02`, `Barrel_01`, `barrel_03`, `old_tyre`, `portable_generator`, `flood_lights`) | [Poly Haven](https://polyhaven.com) | CC0 | `props/industrial.glb`, `industrial.py` |
| Water tower, dumpster, AC unit, cable drum, switchgear, street box, gas cylinder, water barrel, light tower, cement mixer, pallet, portable toilet, roadblock, trash bin | [3DModelsCC0](https://3dmodelscc0.itch.io) packs: City Environment 1 and 2, Industrial 1 and 2 | CC0 | `props/terminal.glb`, `terminal.py` |
| Naginata (held by the samurai) | [Naginata](https://opengameart.org/content/naginata) by Bioxx | CC0 | `enemies/samurai.glb` |

CC0 sources need no credit; they are named anyway.

## Sound effects (spec 32)

Recorded samples converted by `tools/asset-pipeline/audio.sh` (mono Ogg Vorbis, 44.1 kHz, trimmed, normalised; loops crossfaded). BigSoundBank first ("Joseph SARDIN - BigSoundBank.com", every page shows "License CC0 (public domain)", site statement https://bigsoundbank.com/licenses.html); OpenGameArt only where BigSoundBank had no fit. Every sound keeps a procedural fallback (`src/audio/sounds.ts`).

| Sound | File(s) in `public/assets/audio/` | Source | Author | Licence |
|---|---|---|---|---|
| Rifle shot | `rifle_shot_1.ogg` | [BigSoundBank #2853](https://bigsoundbank.com/rifle-shot-1-s2853.html) | Joseph SARDIN | CC0 |
| Rifle shot | `rifle_shot_2.ogg` | [BigSoundBank #2854](https://bigsoundbank.com/rifle-shot-2-s2854.html) | Joseph SARDIN | CC0 |
| Dry fire | `dry_click.ogg` | [BigSoundBank #2003](https://bigsoundbank.com/empty-firecracker-gun-1-s2003.html) | Joseph SARDIN | CC0 |
| Reload: magazine out | `reload_mag_out.ogg` | [BigSoundBank #1988](https://bigsoundbank.com/gun-loading-1-s1988.html) | Joseph SARDIN | CC0 |
| Reload: magazine in | `reload_mag_in.ogg` | [BigSoundBank #1991](https://bigsoundbank.com/gun-loading-4-s1991.html) | Joseph SARDIN | CC0 |
| Reload: bolt | `reload_bolt.ogg` | [BigSoundBank #1990](https://bigsoundbank.com/gun-loading-3-s1990.html) | Joseph SARDIN | CC0 |
| Ammo pickup | `pickup_ammo.ogg` | [BigSoundBank #1989](https://bigsoundbank.com/gun-loading-2-s1989.html) | Joseph SARDIN | CC0 |
| Shell casing | `shell_casing_1.ogg` | [BigSoundBank #1361](https://bigsoundbank.com/bullet-case-5-56mm-on-concrete-1-s1361.html) | Joseph SARDIN | CC0 |
| Shell casing | `shell_casing_2.ogg` | [BigSoundBank #1362](https://bigsoundbank.com/bullet-case-5-56mm-on-concrete-2-s1362.html) | Joseph SARDIN | CC0 |
| Shell casing | `shell_casing_3.ogg` | [BigSoundBank #1363](https://bigsoundbank.com/bullet-case-5-56mm-on-concrete-3-s1363.html) | Joseph SARDIN | CC0 |
| Bullet impact on metal (slices) | `impact_metal_1..4.ogg` | [BigSoundBank #0530](https://bigsoundbank.com/paintball-tirs-impacts-futs-metalliques-s0530.html) | Joseph SARDIN | CC0 |
| Footsteps, concrete/asphalt (slices) | `step_concrete_1..6.ogg` | [BigSoundBank #0514](https://bigsoundbank.com/footsteps-shoe-on-concrete-s0514.html) | Joseph SARDIN | CC0 |
| Jump | `jump.ogg` | [BigSoundBank #1835](https://bigsoundbank.com/jumping-on-concrete-1-s1835.html) | Joseph SARDIN | CC0 |
| Landing | `land.ogg` | [BigSoundBank #1836](https://bigsoundbank.com/jumping-on-concrete-2-s1836.html) | Joseph SARDIN | CC0 |
| Hurt grunt (slices) | `hurt_1..3.ogg` | [BigSoundBank #0486](https://bigsoundbank.com/grunts-s0486.html) | Joseph SARDIN | CC0 |
| Death cry | `death.ogg` | [BigSoundBank #2361](https://bigsoundbank.com/cry-of-pain-s2361.html) | Joseph SARDIN | CC0 |
| Low-health heartbeat loop | `heartbeat_loop.ogg` | [BigSoundBank #0243](https://bigsoundbank.com/heartbeat-1-s0243.html) | Joseph SARDIN | CC0 |
| Low-health breathing loop | `breath_loop.ogg` | [BigSoundBank #1103](https://bigsoundbank.com/breathless-man-s1103.html) | Joseph SARDIN | CC0 |
| Robot alert | `enemy_alert_1.ogg` | [BigSoundBank #1973](https://bigsoundbank.com/robot-1-s1973.html) | Joseph SARDIN | CC0 |
| Robot alert | `enemy_alert_2.ogg` | [BigSoundBank #1975](https://bigsoundbank.com/robot-3-s1975.html) | Joseph SARDIN | CC0 |
| Robot alert beep | `robot_beep.ogg` | [BigSoundBank #0760](https://bigsoundbank.com/electronic-device-beeps-s0760.html) | Joseph SARDIN | CC0 |
| Robot servo (melee robots) | `servo.ogg` | [BigSoundBank #2919](https://bigsoundbank.com/servomotor-2-90-1-s2919.html) | Joseph SARDIN | CC0 |
| Drone propeller buzz | `drone_buzz.ogg` | [BigSoundBank #3545](https://bigsoundbank.com/drone-1-s3545.html) | Joseph SARDIN | CC0 |
| Samurai sword swing | `sword_swing.ogg` | [BigSoundBank #0128](https://bigsoundbank.com/sword-through-the-air-s0128.html) | Joseph SARDIN | CC0 |
| Sword cut | `sword_cut.ogg` | [BigSoundBank #0127](https://bigsoundbank.com/sword-that-cuts-s0127.html) | Joseph SARDIN | CC0 |
| Energy wave whoosh (slices) | `energy_wave_1..2.ogg` | [BigSoundBank #0572](https://bigsoundbank.com/whoosh-1-s0572.html) | Joseph SARDIN | CC0 |
| Scorpion steam hiss | `steam_hiss.ogg` | [BigSoundBank #0227](https://bigsoundbank.com/hiss-of-steam-train-1-s0227.html) | Joseph SARDIN | CC0 |
| Boss laser charge hum | `laser_charge.ogg` | [BigSoundBank #2118](https://bigsoundbank.com/neon-or-transformer-1-s2118.html) | Joseph SARDIN | CC0 |
| Boss electric strike | `electric_strike.ogg` | [BigSoundBank #3442](https://bigsoundbank.com/electric-strike-1-s3442.html) | Joseph SARDIN | CC0 |
| Explosion | `explosion_bang_1.ogg` | [BigSoundBank #1807](https://bigsoundbank.com/explosion-1-s1807.html) | Joseph SARDIN | CC0 |
| Explosion | `explosion_bang_2.ogg` | [BigSoundBank #1808](https://bigsoundbank.com/explosion-2-s1808.html) | Joseph SARDIN | CC0 |
| Explosion (far) | `explosion_bang_3.ogg` | [BigSoundBank #1023](https://bigsoundbank.com/explosion-far-away-s1023.html) | Joseph SARDIN | CC0 |
| Countdown alarm | `alarm.ogg` | [BigSoundBank #3411](https://bigsoundbank.com/evacuation-alarm-1-s3411.html) | Joseph SARDIN | CC0 |
| Countdown beep | `beep.ogg` | [BigSoundBank #2380](https://bigsoundbank.com/aerospace-beep-1-s2380.html) | Joseph SARDIN | CC0 |
| Swing gate | `gate.ogg` | [BigSoundBank #0303](https://bigsoundbank.com/grinding-metal-gate-1-s0303.html) | Joseph SARDIN | CC0 |
| Warehouse metal creak | `metal_creak_1..2.ogg` | [BigSoundBank #0616](https://bigsoundbank.com/creaking-metallic-door-s0616.html) | Joseph SARDIN | CC0 |
| Wind ambience loop | `amb_wind_loop.ogg` | [BigSoundBank #0146](https://bigsoundbank.com/strong-wind-1-s0146.html) | Joseph SARDIN | CC0 |
| Sea ambience loop | `amb_sea_loop.ogg` | [BigSoundBank #0266](https://bigsoundbank.com/sea-waves-s0266.html) | Joseph SARDIN | CC0 |
| Footsteps, metal stair/mezzanine | `step_metal_1..6` | ["Footsteps on different surfaces" by congusbongus (from "fboots on aluminum ladder 01" by Eelke)](https://opengameart.org/content/footsteps-on-different-surfaces) | see source | CC-BY 3.0 |
| Enemy laser, robot explosion, boss defeat | `enemy_laser_1..3, explosion_robot_1..3, boss_defeat` | ["Sci-Fi Sounds" by Kenney](https://opengameart.org/content/sci-fi-sounds) | see source | CC0 |
| Medkit pickup, hit marker | `pickup_medkit, hit_marker` | ["Interface Sounds" by Kenney](https://opengameart.org/content/interface-sounds) | see source | CC0 |
| Armour hit, bullet impact on concrete | `hit_armor_1..3, impact_concrete_1..3` | ["75 CC0 breaking / falling / hit sfx" by rubberduck](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) | see source | CC0 |
| Boss heavy cannon | `boss_cannon_1..2` | ["25 CC0 bang / firework SFX" by rubberduck](https://opengameart.org/content/25-cc0-bang-firework-sfx) | see source | CC0 |
| Boss stomp / slam | `boss_stomp` | ["Mech Stomp / Step Sound" by hc](https://opengameart.org/content/mech-stomp-step-sound) | see source | CC0 |
| Boss laser / drones | `boss_laser` | ["Laser weapon burst fire" by celestialghost8](https://opengameart.org/content/laser-weapon-burst-fire) | see source | CC0 |

## Generated by this repository

The Bomber Duck, the procedural fallback robots, the containers, the crane, the procedural sound fallbacks, the tower hum, the boss telegraphs and the UI are generated by this repository's code.

## Acknowledgements

The reference models in [`docs/reference-models/`](docs/reference-models) inspired the robot designs; they are visual references only. This project was developed with substantial help from AI coding agents ([Claude Code](https://claude.com/claude-code)) under human direction and review.
