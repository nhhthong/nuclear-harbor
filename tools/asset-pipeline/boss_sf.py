"""
Build public/assets/enemies/crab-boss.glb: the Gunslinger Crab Mech final boss.

    blender -b --factory-startup --python tools/asset-pipeline/boss_sf.py -- <model.glb> <out.glb>

Source (see docs/ASSETS.md): "Gunslinger Crab Mech v1.2" by vaportrash (Sketchfab, CC-BY 4.0,
uid 5147619f337a45b0974f349eac27b34a), GLB download. Static model (no armature, no animation).

The source has one mesh for all six legs; it is split into its 1075 loose parts, which are assigned to
a leg by their angle around the body, then each leg is rebuilt as its own object with the origin at
the hip so the game can swing it. The decal "label" meshes are dropped (alpha materials), the normal
and ORM textures are dropped (base colour only), everything is decimated and textures shrunk.

Output nodes (game frame: +Y up, the crab faces -Z, metres, feet at y = 0, centre of the feet at x = z = 0):
  crab_body            hull + rear launcher (2 materials)
  crab_armL, crab_armR gun arms, node origin at the shoulder
  crab_legL0..2, crab_legR0..2  (0 = front, 2 = back) node origin at the hip
  muzzle_L, muzzle_R   empties at the gun tips; mortar: empty on the launcher tubes; bay: empty on the rear hull
"""
import math
import os
import sys
import bmesh
import bpy
import mathutils

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]
SCALE = 1.9
TEX = {'crab_main': 1024}       # px per material (default 512), JPEG
TEX_DEFAULT = 512
TARGET = {'body': 7000, 'launcher': 4500, 'arm': 4500, 'leg': 1100}   # triangles (leg: per leg)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
bpy.context.view_layer.update()
O = bpy.data.objects


def bake_world(o):
    o.data = o.data.copy()
    mirrored = o.matrix_world.determinant() < 0      # the left arm is a mirrored node
    o.data.transform(o.matrix_world)
    if mirrored:
        o.data.free_normals_split()                  # imported custom normals are wrong after a mirror: use smooth shading
        o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    o.parent = None
    o.matrix_world = mathutils.Matrix.Identity(4)


legs_src, main_src, launcher_src = O['Object_16'], O['Object_18'], O['Object_20']
arm_a, arm_b = O['Object_22'], O['Object_24']
decals = ['Object_4', 'Object_6', 'Object_8', 'Object_10', 'Object_12', 'Object_14']
for o in (legs_src, main_src, launcher_src, arm_a, arm_b):
    bake_world(o)
for n in decals:
    bpy.data.objects.remove(O[n], do_unlink=True)
for o in list(O):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

for o in (legs_src, main_src, launcher_src, arm_a, arm_b):
    # keep only the first UV layer
    uvs = o.data.uv_layers
    while len(uvs) > 1:
        uvs.remove(uvs[len(uvs) - 1])

for o in (arm_a, arm_b):
    b = bmesh.new()
    b.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    b.to_mesh(o.data)
    b.free()

# ---- split the legs ----------------------------------------------------------------------------------
BODY_C = mathutils.Vector((0.0, 0.3, 0.0))
bm = bmesh.new()
bm.from_mesh(legs_src.data)
bm.verts.ensure_lookup_table()
seen = set()
comps = []
for v in bm.verts:
    if v.index in seen:
        continue
    stack, comp = [v], []
    seen.add(v.index)
    while stack:
        p = stack.pop()
        comp.append(p.index)
        for e in p.link_edges:
            q = e.other_vert(p)
            if q.index not in seen:
                seen.add(q.index)
                stack.append(q)
    comps.append(comp)
co = [v.co.copy() for v in bm.verts]


def leg_of(idx):
    pts = [co[i] for i in idx]
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    ang = math.degrees(math.atan2(cy - BODY_C.y, abs(cx)))
    band = 0 if ang < -25 else (1 if ang < 15 else 2)     # source frame: -Y is forward, so band 0 = front
    return ('L' if cx > 0 else 'R', band)       # the 180 deg turn below swaps sides: source +X ends up on the crab's left


assign = {}
for idx in comps:
    k = leg_of(idx)
    for i in idx:
        assign[i] = k
# vertex -> leg; faces follow their first vertex
leg_objs = {}
for k in sorted(set(assign.values())):
    b2 = bm.copy()
    b2.verts.ensure_lookup_table()
    dead = [v for v in b2.verts if assign[v.index] != k]
    bmesh.ops.delete(b2, geom=dead, context='VERTS')
    me = bpy.data.meshes.new(f'leg{k[0]}{k[1]}')
    b2.to_mesh(me)
    b2.free()
    me.materials.append(legs_src.data.materials[0])
    ob = bpy.data.objects.new(f'crab_leg{k[0]}{k[1]}', me)
    bpy.context.scene.collection.objects.link(ob)
    leg_objs[k] = ob
bm.free()
bpy.data.objects.remove(legs_src, do_unlink=True)

# ---- game transform: scale, face -Z, feet on y = 0, centred ---------------------------------------------
all_pts = [v.co for k, ob in leg_objs.items() for v in ob.data.vertices]
minz = min(p.z for p in all_pts)
cxy = mathutils.Vector(((min(p.x for p in all_pts) + max(p.x for p in all_pts)) / 2, (min(p.y for p in all_pts) + max(p.y for p in all_pts)) / 2, 0))
# Blender: +Z up, we want to face +Y before the exporter's Y-up conversion (-> -Z); the source faces -Y
rot = mathutils.Matrix.Rotation(math.pi, 4, 'Z')
to_game = mathutils.Matrix.Scale(SCALE, 4) @ rot @ mathutils.Matrix.Translation((-cxy.x, -cxy.y, -minz))
parts = list(leg_objs.values()) + [main_src, launcher_src, arm_a, arm_b]
for o in parts:
    o.data.transform(to_game)


def decimate(o, tris):
    cur = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if cur <= tris:
        return
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    m = o.modifiers.new('d', 'DECIMATE')
    m.ratio = tris / cur
    bpy.ops.object.modifier_apply(modifier='d')


for k, ob in leg_objs.items():
    decimate(ob, TARGET['leg'])
decimate(main_src, TARGET['body'])
decimate(launcher_src, TARGET['launcher'])
decimate(arm_a, TARGET['arm'])
decimate(arm_b, TARGET['arm'])

# ---- origins at the pivots ----------------------------------------------------------------------------
def set_origin(o, p):
    o.data.transform(mathutils.Matrix.Translation(-p))
    o.location = p


for k, ob in leg_objs.items():
    pts = sorted((v.co.copy() for v in ob.data.vertices), key=lambda p: math.hypot(p.x, p.y - 0.0))
    near = pts[: max(8, len(pts) // 25)]
    hip = sum(near, mathutils.Vector()) / len(near)
    set_origin(ob, hip)
    ob.name = f'crab_leg{k[0]}{k[1]}'
for o, side in ((arm_a, None), (arm_b, None)):
    xs = [v.co.x for v in o.data.vertices]
    side = 'R' if sum(xs) / len(xs) > 0 else 'L'
    o.name = f'crab_arm{side}'
    # shoulder = the vertex group nearest the hull: lowest-Y end (the arm points to -Z, i.e. +Y in Blender)
    ys = sorted(o.data.vertices, key=lambda v: v.co.y)[:12]
    sh = sum((v.co.copy() for v in ys), mathutils.Vector()) / len(ys)
    set_origin(o, sh)
    tip = max(o.data.vertices, key=lambda v: v.co.y)
    em = bpy.data.objects.new(f'muzzle_{side}', None)
    em.location = o.location + tip.co
    bpy.context.scene.collection.objects.link(em)

lv = [v.co for v in launcher_src.data.vertices]
lc = sum(lv, mathutils.Vector()) / len(lv)
lz = max(p.z for p in lv)
em = bpy.data.objects.new('mortar', None)
em.location = (lc.x, lc.y, lz)
bpy.context.scene.collection.objects.link(em)
em = bpy.data.objects.new('bay', None)
em.location = (lc.x, lc.y, lz - 0.6)
bpy.context.scene.collection.objects.link(em)

# body: join hull + launcher
bpy.ops.object.select_all(action='DESELECT')
main_src.select_set(True)
launcher_src.select_set(True)
bpy.context.view_layer.objects.active = main_src
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'crab_body'
body.data.name = 'crab_body'
# ---- materials: base colour only -----------------------------------------------------------------------
done = {}
for mat in list(bpy.data.materials):
    base = None
    for n in mat.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED' and n.inputs['Base Color'].links:
            src = n.inputs['Base Color'].links[0].from_node
            if src.type == 'TEX_IMAGE':
                base = src.image
    if base is None:
        continue
    px = TEX.get(mat.name.split('.')[0], TEX_DEFAULT)
    base.scale(px, px)                               # always: marks the image dirty so it is re-encoded at the export quality
    nm = bpy.data.materials.new('crab_' + mat.name.split('_')[0] + mat.name.split('_')[1] if '_' in mat.name else mat.name)
    nm.use_nodes = True
    nt = nm.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = base
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = 0.25
    bsdf.inputs['Roughness'].default_value = 0.6
    nm.use_backface_culling = True
    done[mat.name] = nm
for o in bpy.data.objects:
    if o.type == 'MESH':
        for i, m in enumerate(o.data.materials):
            if m and m.name in done:
                o.data.materials[i] = done[m.name]

bpy.context.scene.render.image_settings.quality = 60
# ---- export --------------------------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_image_format='JPEG', export_image_quality=55,
    export_apply=False, export_yup=True, export_materials='EXPORT', use_selection=True,
)
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'}
print('TRIS', tris, sum(tris.values()))
print('SIZE', os.path.getsize(OUT))
