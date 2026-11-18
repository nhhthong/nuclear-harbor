"""
Build public/assets/enemies/samurai.glb: the cyber samurai body and its naginata.

    blender -b --factory-startup --python tools/asset-pipeline/samurai.py -- <robot.glb> <Naginata2.blend> <naginata texture dir> <out.glb>

Sources (see docs/ASSETS.md):
- "Cyberpunk Samurai Robot" by byhoangtran (Sketchfab, CC-BY 4.0), GLB download. Its katana is dropped.
- "Naginata" by Bioxx (OpenGameArt, CC0): Naginata2.blend + Naginata2_Material_{AlbedoTransparency,MetallicRough,Normal}.png.

Output nodes (game frame: +Y up, the robot faces -Z, metres, feet at y = 0):
  samurai_body, samurai_thighL, samurai_thighR, samurai_shinL, samurai_shinR   meshes in the game frame
  samurai_naginata   mesh along +X (blade end), origin at the grip
  joint_hipL, joint_hipR, joint_kneeL, joint_kneeR, joint_grip   empties at the pivots
"""
import math
import os
import sys
import bpy
import mathutils

a = sys.argv[sys.argv.index('--') + 1:]
ROBOT, NAGI_BLEND, NAGI_TEX, OUT = a[0], a[1], a[2], a[3]
HIP_HEIGHT = 1.62          # same hip height as the procedural samurai, so gait numbers stay valid
NAGINATA_LENGTH = 2.7      # metres, tip to butt
GRIP_FROM_BUTT = 0.42      # share of the length behind the grip
TEX = 512

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ROBOT)
bpy.context.view_layer.update()
O = bpy.data.objects

hip_r = O['L thigh006'].matrix_world.translation.copy()   # names in the source are swapped: 006 is the right leg
hip_l = O['L thigh007'].matrix_world.translation.copy()
knee_r = O['L leg006'].matrix_world.translation.copy()
knee_l = O['L leg007'].matrix_world.translation.copy()
centre_y = (hip_r.y + hip_l.y) / 2
s = HIP_HEIGHT / hip_r.z

# source frame: +Z up, faces -X. Game frame before glTF export (Blender, +Z up): face +Y, so that the
# exporter's Y-up conversion turns it into -Z. Rotation -90 deg about Z maps -X to +Y.
rot = mathutils.Matrix.Rotation(-math.pi / 2, 4, 'Z')
to_game = mathutils.Matrix.Scale(s, 4) @ rot @ mathutils.Matrix.Translation((0, -centre_y, 0))


def g(v):
    return to_game @ v


groups = {
    'samurai_thighR': ['L thigh006'],
    'samurai_thighL': ['L thigh007'],
    'samurai_shinR': ['L leg006', 'L foot006'],
    'samurai_shinL': ['L leg007', 'L foot007'],
}
leg_names = {n for v in groups.values() for n in v}
hand_r = O['R hand009']
grip_src = mathutils.Vector([sum(c) / 8 for c in zip(*[hand_r.matrix_world @ mathutils.Vector(b) for b in hand_r.children[0].bound_box])]) if hand_r.children else hand_r.matrix_world.translation
# the hand mesh hangs under the empty: use the mesh bounds centre
hand_mesh = [o for o in O if o.type == 'MESH' and o.parent and o.parent.name.startswith('Object_19')]
if hand_mesh:
    hm = hand_mesh[0]
    pts = [hm.matrix_world @ v.co for v in hm.data.vertices]
    grip_src = mathutils.Vector([sum(p[i] for p in pts) / len(pts) for i in range(3)])

meshes = [o for o in O if o.type == 'MESH']
part_of = {}
for m in meshes:
    p, owner = m, None
    while p is not None:
        if p.name in leg_names:
            owner = p.name
            break
        if p.name.startswith('sword'):
            owner = 'sword'
            break
        p = p.parent
    part_of[m] = owner

# bake world transforms, then the game transform, into each mesh
for m in meshes:
    m.data = m.data.copy()
    m.data.transform(to_game @ m.matrix_world)
    m.parent = None
    m.matrix_world = mathutils.Matrix.Identity(4)
for m in meshes:
    if part_of[m] == 'sword':
        bpy.data.objects.remove(m, do_unlink=True)
meshes = [o for o in O if o.type == 'MESH']


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


final = []
for name, srcs in groups.items():
    final.append(join([m for m in meshes if part_of.get(m) in srcs], name))
body = join([m for m in O if m.type == 'MESH' and m not in final], 'samurai_body')
final.append(body)

# keep only the parts and drop the source empties
for o in list(O):
    if o not in final:
        bpy.data.objects.remove(o, do_unlink=True)

# textures: shrink to TEX
for img in bpy.data.images:
    if img.size[0] > TEX:
        img.scale(TEX, TEX)

# ---- naginata ---------------------------------------------------------------------------------
with bpy.data.libraries.load(NAGI_BLEND, link=False) as (src, dst):
    dst.objects = list(src.objects)
nag = [o for o in dst.objects if o is not None and o.type == 'MESH']
for o in nag:
    bpy.context.scene.collection.objects.link(o)
    o.data = o.data.copy()
    o.data.transform(o.matrix_world)
    o.parent = None
    o.matrix_world = mathutils.Matrix.Identity(4)
n = join(nag, 'samurai_naginata')
mat = bpy.data.materials.new('naginata')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']


def img(f, colour):
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(os.path.join(NAGI_TEX, f))
    node.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    if node.image.size[0] > TEX:
        node.image.scale(TEX, TEX)
    return node


nt.links.new(img('Naginata2_Material_AlbedoTransparency.png', True).outputs['Color'], bsdf.inputs['Base Color'])
mr = img('Naginata2_Material_MetallicRough.png', False)
sep = nt.nodes.new('ShaderNodeSeparateColor')
nt.links.new(mr.outputs['Color'], sep.inputs['Color'])
nt.links.new(sep.outputs['Red'], bsdf.inputs['Metallic'])
bsdf.inputs['Roughness'].default_value = 0.38
nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(img('Naginata2_Material_Normal.png', False).outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
n.data.materials.clear()
n.data.materials.append(mat)
# the source lies along X: find the blade end (the wide end), flip so it points to +X, scale, grip at origin
xs = [v.co.x for v in n.data.vertices]
lo, hi = min(xs), max(xs)
L = hi - lo


def width(a, b):
    zs = [v.co.z for v in n.data.vertices if a <= v.co.x <= b] or [0.0]
    ys = [v.co.y for v in n.data.vertices if a <= v.co.x <= b] or [0.0]
    return max(max(zs) - min(zs), max(ys) - min(ys))


blade_at_min = width(lo, lo + 0.15 * L) > width(hi - 0.15 * L, hi)
print('NAGINATA blade end', 'min' if blade_at_min else 'max')
k = NAGINATA_LENGTH / L
if blade_at_min:
    n.data.transform(mathutils.Matrix.Scale(-1, 4, (1, 0, 0)))
    n.data.flip_normals()
    xs = [v.co.x for v in n.data.vertices]
    lo, hi = min(xs), max(xs)
cy = sum(v.co.y for v in n.data.vertices) / len(n.data.vertices)
cz = sum(v.co.z for v in n.data.vertices) / len(n.data.vertices)
grip_x = lo + L * GRIP_FROM_BUTT
n.data.transform(mathutils.Matrix.Scale(k, 4) @ mathutils.Matrix.Translation((-grip_x, -cy, -cz)))
final.append(n)

# ---- joints -----------------------------------------------------------------------------------
for name, src in [('joint_hipL', hip_l), ('joint_hipR', hip_r), ('joint_kneeL', knee_l), ('joint_kneeR', knee_r), ('joint_grip', grip_src)]:
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = g(src)
    final.append(e)
    print('JOINT', name, [round(v, 3) for v in e.location])

bpy.context.view_layer.update()
for o in final:
    if o.type == 'MESH':
        d = o.dimensions
        print(f'PART {o.name} x={d.x:.2f} y={d.y:.2f} z={d.z:.2f} tris={sum(len(p.vertices) - 2 for p in o.data.polygons)}')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
                          export_image_format='JPEG', export_jpeg_quality=80, export_yup=True, export_extras=False)
print('WROTE', OUT)
