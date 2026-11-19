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
| Cabinets, barrier, barrels, tyre, generator, work light (`utility_box_01/02`, `concrete_road_barrier_02`, `Barrel_01`, `barrel_03`, `old_tyre`, `portable_generator`, `flood_lights`) | [Poly Haven](https://polyhaven.com) | CC0 | `props/industrial.glb`, `industrial.py` |
| Water tower, dumpster, AC unit, cable drum, switchgear, street box, gas cylinder, water barrel, light tower, cement mixer, pallet, portable toilet, roadblock, trash bin | [3DModelsCC0](https://3dmodelscc0.itch.io) packs: City Environment 1 and 2, Industrial 1 and 2 | CC0 | `props/terminal.glb`, `terminal.py` |
| Naginata (held by the samurai) | [Naginata](https://opengameart.org/content/naginata) by Bioxx | CC0 | `enemies/samurai.glb` |

CC0 sources need no credit; they are named anyway.

## Generated by this repository

The Bomber Duck, the procedural fallback robots, the containers, the crane, all sounds and the UI are generated by this repository's code.

## Acknowledgements

The reference models in [`docs/reference-models/`](docs/reference-models) inspired the robot designs; they are visual references only. This project was developed with substantial help from AI coding agents ([Claude Code](https://claude.com/claude-code)) under human direction and review.
