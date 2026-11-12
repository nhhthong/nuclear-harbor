# Asset pipeline: GoldSrc MDL v10 to GLB (T-18)

```bash
bash tools/asset-pipeline/convert.sh                     # assets-src/weapons/g36c/v_g36c.mdl -> public/assets/weapons/g36c/g36c.glb
bash tools/asset-pipeline/convert.sh other.mdl out.glb   # custom paths
```

- `mdl.py`: bounds-checked MDL v10 reader (bones, body parts, tri strips/fans, 8-bit textures, RLE animation, attachments). The input is untrusted data; always run with `python3 -I`.
- `glb.py`: GLB and PNG writers (standard library only).
- `convert.py`: merges all body parts into one skinned mesh with one texture atlas, converts units and axes, samples every sequence into per-bone clips, writes `report.json`.
- `validate_blender.py`: optional check; `blender --background` imports the GLB and prints bones and actions (Blender's Python needs `python3-numpy`).
- Choice: direct GLB writer instead of building the mesh through `bpy` (deterministic, Blender not needed to convert).
- `input/` is git-ignored: never commit raw third-party archives.
