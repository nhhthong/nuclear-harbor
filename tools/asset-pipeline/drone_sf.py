"""
Build public/assets/enemies/dragonfly-drone.glb: the boss's dragonfly drone.

    blender -b --factory-startup --python tools/asset-pipeline/drone_sf.py -- <model.glb> <out.glb> [pose: rest|frame0|frameN]

Source (see docs/ASSETS.md): "Light Assault Mech" by Lagst (Sketchfab, CC-BY 4.0, uid
d1ca5065b5184646bc7028597d0ce049), GLB download. Despite its name it is a dragonfly-like flyer.

The source is skinned (332 bones, one clip) and explodes when the armature is simply disabled, so the
armature is applied to the mesh in the chosen pose first (evaluated mesh), then the stray Icosphere is
dropped, the two meshes are joined and decimated, the textures shrunk to 512 px, and the model is scaled
to a 4.2 m wingspan, centred, facing -Z.

Output: one node `drone_body` (mesh, origin at the centre of the body).
"""
import math
import os
import sys
import bpy
import mathutils

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]
POSE = a[2] if len(a) > 2 else 'frame0'
DEFAULT_SCALE = 0.2      # the 21 m wingspan of the source becomes about 4.2 m (body about 0.4 m)
TRIS = 4800
TEX = 512

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
bpy.context.view_layer.update()
O = bpy.data.objects
arm = next(o for o in O if o.type == 'ARMATURE')
if POSE == 'rest':
    arm.data.pose_position = 'REST'
else:
    frame = 1 if POSE == 'frame0' else int(POSE[5:])
    bpy.context.scene.frame_set(frame)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

baked = []
for name in ('Object_339', 'Object_340'):
    o = O[name]
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
    me.transform(o.matrix_world)
    no = bpy.data.objects.new(name + '_baked', me)
    bpy.context.scene.collection.objects.link(no)
    baked.append(no)
for o in list(O):
    if o not in baked:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
for o in baked:
    o.select_set(True)
bpy.context.view_layer.objects.active = baked[0]
bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.name = 'drone_body'
me = ob.data
me.name = 'drone_body'
while len(me.uv_layers) > 1:
    me.uv_layers.remove(me.uv_layers[len(me.uv_layers) - 1])

pts = [v.co for v in me.vertices]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
print('BBOX', tuple(mn), tuple(mx))

# decimate (collapse) to the triangle budget
cur = sum(len(p.vertices) - 2 for p in me.polygons)
m = ob.modifiers.new('d', 'DECIMATE')
m.ratio = min(1.0, TRIS / cur)
bpy.ops.object.modifier_apply(modifier='d')

# materials: base colour (+ emission) only
mat0 = me.materials[0]
base = emi = None
for n in mat0.node_tree.nodes:
    if n.type == 'BSDF_PRINCIPLED':
        if n.inputs['Base Color'].links:
            base = n.inputs['Base Color'].links[0].from_node.image
        if n.inputs['Emission Color'].links:
            emi = n.inputs['Emission Color'].links[0].from_node.image
for img in (base, emi):
    if img:
        img.scale(TEX, TEX)
nm = bpy.data.materials.new('drone')
nm.use_nodes = True
nt = nm.node_tree
bsdf = nt.nodes['Principled BSDF']
if base:
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = base
    nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
if emi:
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = emi
    nt.links.new(t.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
bsdf.inputs['Metallic'].default_value = 0.3
bsdf.inputs['Roughness'].default_value = 0.5
nm.use_backface_culling = False
me.materials.clear()
me.materials.append(nm)

# transform (DRONE_SCALE / DRONE_YAW override the defaults)
S = float(os.environ.get('DRONE_SCALE', DEFAULT_SCALE))
yaw = math.radians(float(os.environ.get('DRONE_YAW', '0')))
rot = mathutils.Matrix.Rotation(yaw, 4, 'Z')
cen = (mn + mx) / 2
me.transform(mathutils.Matrix.Scale(S, 4) @ rot @ mathutils.Matrix.Translation(-cen))
bpy.context.scene.render.image_settings.quality = 70
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='JPEG', export_image_quality=70,
                          export_yup=True, export_materials='EXPORT', use_selection=True)
print('TRIS', sum(len(p.vertices) - 2 for p in me.polygons))
print('SIZE', os.path.getsize(OUT))
