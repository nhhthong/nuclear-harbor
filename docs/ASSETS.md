# Asset provenance

## Weapon view model: G36C (`assets-src/weapons/g36c/v_g36c.mdl`)
- Format: GoldSrc MDL v10 (Counter-Strike 1.6 style view model), 4.9 MB, textures and animations embedded.
- Origin: supplied by the project owner in-session (file name `v_aug.mdl`, renamed). Texture names (`g36c_*`) show the weapon is a G36C.
- Author credit: funnky.
- Permission: the project owner states that the author permits use. No readme or licence text is inside the file, so this statement is the only record. Keep this note and the in-game credit.
- Replaces: the GDD's DesertTech MDR candidate (not used) and a previously supplied SG552/MSBS model (discarded).
- Fallback: the procedural placeholder view model (T-02) stays the default and the fallback.

### Conversion and shipping decision (T-18)
- Decision: SHIP the derived model (ticket update: user-stated author permission). The raw `.mdl` stays in `assets-src/` as the source of truth. Derived file: `public/assets/weapons/g36c/g36c.glb` (2.3 MB; textures embedded as one 1024x1840 PNG atlas, the 18 source textures downscaled 2x).
- Pipeline: `bash tools/asset-pipeline/convert.sh`. A pure-Python MDL v10 reader (`mdl.py`) and a direct GLB writer (`glb.py`), no network. Blender 4.0.2 only validates the result by importing the GLB. Reason: Blender has no GoldSrc importer, and writing the GLB directly is deterministic and independent of the Blender version.
- Contents used: 3 body parts (hands, rifle part 1, rifle part 2), 46 bones, one skinned mesh (5954 vertices, 5726 triangles, 1 draw call), attachment 0 (muzzle) and 1 (eject) as nodes `muzzle` and `eject`.
- Animations recovered from the RLE data and checked in Blender (6 actions) and in three.js: `idle` (112 frames at 30), `reload` (133 at 40.3), `draw` (43 at 32), `shoot1..3` (34 at 40). Mapping: draw on start, idle loop, shoot clips round-robin on fire, reload time-scaled to the weapon reload duration. The bind pose of this model lies sideways, so the rest pose is the first `idle` frame.
- Units and axes: inches to metres (0.0254); GoldSrc X-forward/Z-up to -Z forward/+Y up.
- Runtime: `?viewmodel=glb` loads it lazily from the same origin; the procedural model stays the default and the fallback on any load error. Entry point: `createViewModel` in `src/weapon/viewmodel/createViewModel.ts`. Hooking it into `src/weapon/index.ts` is a foundation request (`specs/T-18-weapon-asset-pipeline/foundation-requests.md`).
- Credit to keep in the game credits: G36C view model by funnky, used with the author's permission as stated by the project owner.
