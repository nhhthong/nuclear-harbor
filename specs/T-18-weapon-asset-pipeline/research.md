# Research

- **Decision**: write GLB directly from Python (no bpy). Rationale: deterministic, runs anywhere; Blender 4.0.2 is used by `convert.sh` only to validate (import the GLB, count armature bones and actions). Alternative: build the mesh in bpy and export (heavier, version dependent).
- **Decision**: skinned mesh with one joint per MDL bone, each vertex bound to one bone with weight 1 (GoldSrc vertices carry one bone). Clips are glTF animations with per-bone TRS keyframes sampled from the RLE data at the sequence frame rate.
- **Decision**: choose the body part submodels by parse report (hands plus weapon); skip empty and duplicate alternates.
- **Decision**: textures converted from palette to PNG, downscaled to at most 256 px, merged into a small number of materials to stay within 6 draw calls (atlas if needed).
- **Decision**: axis conversion GoldSrc (X forward, Y left, Z up, inches) to glTF (-Z forward, +Y up, metres) with `(x, y, z) -> (-y, z, -x) * 0.0254`, checked against bounds.
- **Decision**: runtime fallback: `createViewModel` returns a wrapper around the procedural model; on GLB success it swaps to the GLB model, on any failure it logs once and keeps procedural. Materials are replaced by unlit-friendly basic materials with the base texture.
