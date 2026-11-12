# Data model

- **MdlModel**: header, bones (name, parent, bind pos/rot, animation scales), bodyparts, submodels, meshes (tri commands, skin ref, vertex bone), textures (name, size, indexed pixels, palette), skin families, sequences (name, fps, frame count, per-bone RLE offsets), attachments (bone, origin).
- **Converted GLB**: one skin (joints = bones), one mesh per material, animations `idle`, `reload`, `draw`, `shoot1..3`, empty nodes `muzzle` and `eject` from attachments.
- **ClipMap**: state to clip: idle, draw, reload, fire = round-robin of shoot clips.
