"""Validate a GLB by importing it into headless Blender.

Usage: blender --background --python validate_blender.py -- <file.glb>
Prints armature bone count, action names and mesh dimensions. Exits non-zero when the model has no skeleton/actions.
"""
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])

arm = [o for o in bpy.data.objects if o.type == "ARMATURE"]
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
bones = sum(len(a.data.bones) for a in arm)
actions = sorted(a.name for a in bpy.data.actions)
verts = sum(len(o.data.vertices) for o in meshes)
mn = Vector((1e9, 1e9, 1e9))
mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mn = Vector(map(min, mn, w))
        mx = Vector(map(max, mx, w))
print("BLENDER_VALIDATE armatures=%d bones=%d meshes=%d verts=%d actions=%s" % (len(arm), bones, len(meshes), verts, actions))
print("BLENDER_VALIDATE dims(blender axes, Z up)=%s" % (tuple(round(v, 3) for v in (mx - mn)),))

if not arm or not actions:
    sys.exit(2)
