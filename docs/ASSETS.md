# Asset provenance

## Weapon view model: G36C (`assets-src/weapons/g36c/v_g36c.mdl`)
- Format: GoldSrc MDL v10 (Counter-Strike 1.6 style view model), 4.9 MB, textures and animations embedded.
- Origin: supplied by the project owner in-session (file name `v_aug.mdl`, renamed). Texture names (`g36c_*`) show the weapon is a G36C.
- Author credit: funnky.
- Permission: the project owner states that the author permits use. No readme or licence text is inside the file, so this statement is the only record. Keep this note and the in-game credit.
- Fallback: the procedural placeholder view model (T-02) stays the default and the fallback.

### Conversion and shipping decision (T-18)
- Decision: SHIP the derived model (ticket update: user-stated author permission). The raw `.mdl` stays in `assets-src/` as the source of truth. Derived file: `public/assets/weapons/g36c/g36c.glb` (2.3 MB; textures embedded as one 1024x1840 PNG atlas, the 18 source textures downscaled 2x).
- Pipeline: `bash tools/asset-pipeline/convert.sh`. A pure-Python MDL v10 reader (`mdl.py`) and a direct GLB writer (`glb.py`), no network. Blender 4.0.2 only validates the result by importing the GLB. Reason: Blender has no GoldSrc importer, and writing the GLB directly is deterministic and independent of the Blender version.
- Contents used: 3 body parts (hands, rifle part 1, rifle part 2), 46 bones, one skinned mesh (5954 vertices, 5726 triangles, 1 draw call), attachment 0 (muzzle) and 1 (eject) as nodes `muzzle` and `eject`.
- Animations recovered from the RLE data and checked in Blender (6 actions) and in three.js: `idle` (112 frames at 30), `reload` (133 at 40.3), `draw` (43 at 32), `shoot1..3` (34 at 40). Mapping: draw on start, idle loop, shoot clips round-robin on fire, reload time-scaled to the weapon reload duration. The bind pose of this model lies sideways, so the rest pose is the first `idle` frame.
- Units and axes: inches to metres (0.0254); GoldSrc X-forward/Z-up to -Z forward/+Y up.
- Runtime: `?viewmodel=glb` loads it lazily from the same origin; the procedural model stays the default and the fallback on any load error. Entry point: `createViewModel` in `src/weapon/viewmodel/createViewModel.ts`. `src/weapon/index.ts` calls it (the T-18 foundation request is applied).
- Credit to keep in the game credits: G36C view model by funnky, used with the author's permission as stated by the project owner.

## Props: vehicles and industrial clutter (owner-approved free models)
The constitution asks for procedural content; the owner approved free CC0 and CC-BY models for vehicles and clutter. Raw downloads are NOT in git (they were fetched into a scratch directory); each build script lists the exact source files. Shipped files are in `public/assets/props/`.

| File | Source | Licence | Script | Size |
|---|---|---|---|---|
| `vehicles.glb` | [Free Low Poly Vehicles Pack](https://opengameart.org/content/free-low-poly-vehicles-pack) by Rgsdev (truck, truck with trailer, van, pickup, SUV, sedan, hatchback) | CC0 (the pack ships `License.txt`: public domain, no credit required) | `tools/asset-pipeline/props.py` | 0.3 MB |
| `vehicles.glb` (forklift) | [JUNGHEINRICH DFG 425s forklift](https://opengameart.org/content/forklift-jungheinrich-dfg-425s) by luke1985 | **CC-BY 4.0: credit required** (in-game Credits screen) | `props.py` (decimated to 4.5k triangles, recoloured) | included above |
| `industrial.glb` | [Poly Haven](https://polyhaven.com) by James Ray Cock and contributors: `utility_box_01`, `utility_box_02`, `concrete_road_barrier_02`, `Barrel_01`, `barrel_03`, `old_tyre`, `portable_generator`, `flood_lights` (standing double A only) | CC0 (site-wide) | `tools/asset-pipeline/industrial.py` (1k glTF -> 512 px JPEG, decimated, glass dropped) | 1.8 MB |
| `terminal.glb` | [3DModelsCC0 packs on itch.io](https://3dmodelscc0.itch.io): City Environment Pack 1 and 2, Industrial 3D Models, Industrial Props Pack 2 (listing says "No generative AI was used") | CC0 public domain (listing text) | `tools/asset-pipeline/terminal.py` | 2.2 MB |

Notes:
- The 3DModelsCC0 shop closed; the packs are pay-what-you-want on itch.io and were downloaded at no cost. The licence statement is the one on each itch.io page.
- A hand pallet truck from the Industrial pack was dropped: the FBX has wrong units (173 m tall).
- Poly Haven, Rgsdev and 3DModelsCC0 do not require credit; the README credits them anyway.
- Candidates that were checked and rejected: GameBanana weapon models (CC BY-NC-ND, mostly ports of commercial games), Sketchfab CC-BY models (need an API token), Kenney (blocks bots), CGTrader and RenderHub cranes (paid).

