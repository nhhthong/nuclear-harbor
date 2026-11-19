"""
Build public/assets/enemies/scorpion.glb: the STINGER-7 semi-boss (mecha scorpion).

    blender -b --factory-startup --python tools/asset-pipeline/scorpion_sf.py -- <model.glb> <out.glb> [debug-colours]

Source (see docs/ASSETS.md): "Scorpion Robot" by Mirandanimator (Sketchfab, CC-BY 4.0,
uid e44be9a622af4e85b4b10cf59b25de1a), GLB download. Static model: no armature, no animation, no
texture, one grey material, 8 meshes (29k triangles). What the source really is (checked on renders):
a four-legged scorpion, NOT six legs and NOT with pincers: a short body, a round "eye" drum for a head,
four big mech legs (two per side) and a long curled tail that arches over the body and ends in a drum
with a cannon nozzle. The game scorpion's claws therefore have no counterpart here.

How it is split (all by loose islands, i.e. connected vertex groups, assigned by their centroid):
  sc_body       rdmobj06 core (|x| < 0.3), rdmobj07 carapace, the head parts (rdmobj00_006/02..05, the head
                shell islands of rdmobj01)
  sc_legL0/1, sc_legR0/1   rdmobj06 islands with |x| >= 0.3, front/rear by y; node origin = the hip
  sc_tail0..3   rdmobj01 islands of the tail, cut by their polar angle about the fitted centre of the arc
                (a chain: tail1 is a child of tail0, ...); node origin = the joint on the centre line
Glowing parts use a second material (sc_glow, emissive green): the iris rings and sensor dots of the head,
a recessed disc in the cannon nozzle, the leg ball joints and a few vent slits. Armour is dark gunmetal.

Output nodes (game frame: +Y up, the scorpion faces -Z, metres, feet at y = 0, centred between the legs):
  sc_body, sc_tail0 > sc_tail1 > sc_tail2 > sc_tail3, sc_legL0, sc_legL1, sc_legR0, sc_legR1
  empties: sc_head (centre of the eye drum), sc_nozzle (child of sc_tail3: the stinger mouth)
Materials: sc_armor, sc_glow.
"""
import math
import os
import sys
import bmesh
import bpy
import mathutils

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]
DEBUG = len(a) > 2
SCALE = 1.6                 # metres per source unit: 6.4 m long (head to tail base), 4.1 m high, 5.2 m wide
DROP_BELOW = 0.035          # loose islands smaller than this (source units, largest bbox side) are dropped
TARGET = {'body': 4400, 'leg': 1450, 'tail': [2300, 1500, 1100, 1700]}     # triangles (leg: per leg)
TAIL_CUTS = [-100, -8, 66, 118, 175]   # polar angles (deg) about the fitted tail circle; the first one is the base
ARMOR = (0.07, 0.08, 0.10, 1.0)
GLOW_EMIT = (0.04, 1.0, 0.07, 1.0)     # 0x38ff4a in linear space

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
bpy.context.view_layer.update()
O = bpy.data.objects


def bake_world(o):
    o.data = o.data.copy()
    mirrored = o.matrix_world.determinant() < 0
    o.data.transform(o.matrix_world)
    if mirrored:
        o.data.flip_normals()
    o.parent = None
    o.matrix_world = mathutils.Matrix.Identity(4)


meshes = {}
for o in list(O):
    if o.type == 'MESH':
        bake_world(o)
        meshes[o.name.split('_')[0]] = o
for o in list(O):
    if o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
for o in meshes.values():
    while len(o.data.uv_layers) > 0:
        o.data.uv_layers.remove(o.data.uv_layers[0])
    o.data.materials.clear()


def comps_of(bm):
    seen = set()
    out = []
    for v in bm.verts:
        if v.index in seen:
            continue
        st = [v]
        seen.add(v.index)
        comp = []
        while st:
            p = st.pop()
            comp.append(p.index)
            for e in p.link_edges:
                q = e.other_vert(p)
                if q.index not in seen:
                    seen.add(q.index)
                    st.append(q)
        out.append(comp)
    return out


# ---- islands: (mesh key, vertex indices, centroid, bbox min, bbox max, face count) ------------------------
bms = {}
isl = []
for key, o in meshes.items():
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    bms[key] = bm
    for comp in comps_of(bm):
        pts = [bm.verts[i].co for i in comp]
        mn = mathutils.Vector([min(p[k] for p in pts) for k in range(3)])
        mx = mathutils.Vector([max(p[k] for p in pts) for k in range(3)])
        c = sum(pts, mathutils.Vector()) / len(pts)
        nf = len(set(f.index for i in comp for f in bm.verts[i].link_faces))
        isl.append({'key': key, 'verts': comp, 'c': c, 'mn': mn, 'mx': mx, 'nf': nf, 'size': max(mx - mn), 'dims': sorted(mx - mn)})

# ---- tail circle fit (Kasa) over the tail islands of rdmobj01 -----------------------------------------------
def is_tail(i):
    return i['key'] == 'rdmobj01' and (i['c'].z > 1.3 or i['c'].y > -0.3)


tail_isl = [i for i in isl if is_tail(i)]
n = len(tail_isl)
# normal equations of  2 y cy + 2 z cz + k = y^2 + z^2
sa = [[0.0] * 3 for _ in range(3)]
sb = [0.0] * 3
for i in tail_isl:
    row = (2 * i['c'].y, 2 * i['c'].z, 1.0)
    rhs = i['c'].y ** 2 + i['c'].z ** 2
    for r in range(3):
        sb[r] += row[r] * rhs
        for cc in range(3):
            sa[r][cc] += row[r] * row[cc]
M = mathutils.Matrix(sa)
sol = M.inverted() @ mathutils.Vector(sb)
CY, CZ = sol[0], sol[1]


def polar(c):
    return math.degrees(math.atan2(c.z - CZ, c.y - CY))


def tail_seg(i):
    ang = polar(i['c'])
    for s in range(4):
        if TAIL_CUTS[s] <= ang < TAIL_CUTS[s + 1]:
            return s
    return 0 if ang < TAIL_CUTS[0] else 3


# ---- classification ----------------------------------------------------------------------------------------
def group_of(i):
    key, c = i['key'], i['c']
    if key == 'rdmobj06':
        if abs(c.x) >= 0.3:
            return 'leg' + ('L' if c.x > 0 else 'R') + ('0' if c.y < -0.62 else '1')
        return 'body'
    if key == 'rdmobj01':
        return 'tail%d' % tail_seg(i) if is_tail(i) else 'body'
    return 'body'


# ---- vent slits: thin, long, flat islands on the carapace and the tail ------------------------------------
def is_slit(i):
    d = i['dims']
    return i['key'] == 'rdmobj07' and i['nf'] <= 14 and d[0] < 0.012 and d[2] > 0.1


def is_ring(i):
    """Thin round plates on the legs (hip rings, knee discs, foot discs): the glowing joints."""
    d = i['dims']
    return i['key'] == 'rdmobj06' and abs(i['c'].x) >= 0.3 and i['nf'] in (24, 32) and d[0] < 0.06 and d[1] > 0.8 * d[2] and 0.12 <= d[2] <= 0.2


glow_pick = []
for i in isl:
    i['group'] = group_of(i)
    i['glow'] = False
    if i['key'] in ('rdmobj05', 'rdmobj00_006', 'rdmobj02'):
        i['glow'] = True
    elif is_ring(i):
        i['glow'] = True
    elif is_slit(i):
        i['glow'] = True
    i['drop'] = i['size'] < DROP_BELOW and not i['glow'] and i['key'] != 'rdmobj00_006'

if DEBUG:
    from collections import Counter
    print('CIRCLE', CY, CZ, 'tail islands', n)
    print('GROUPS', Counter(i['group'] for i in isl))
    print('GLOW', Counter((i['key'], i['group']) for i in isl if i['glow']))
    print('DROP', sum(1 for i in isl if i['drop']), 'faces', sum(i['nf'] for i in isl if i['drop']), 'of', sum(i['nf'] for i in isl))

# ---- build pieces ------------------------------------------------------------------------------------------
GROUPS = ['body', 'legL0', 'legL1', 'legR0', 'legR1', 'tail0', 'tail1', 'tail2', 'tail3']


def build_piece(name, picks):
    """New object holding the islands in `picks`, grouped by source mesh."""
    objs = []
    for key in meshes:
        mine = [i for i in picks if i['key'] == key]
        if not mine:
            continue
        keep = set()
        for i in mine:
            keep.update(i['verts'])
        b2 = bms[key].copy()
        b2.verts.ensure_lookup_table()
        dead = [v for v in b2.verts if v.index not in keep]
        bmesh.ops.delete(b2, geom=dead, context='VERTS')
        me = bpy.data.meshes.new(name)
        b2.to_mesh(me)
        b2.free()
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        objs.append(ob)
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def tris_of(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def decimate(o, tris):
    cur = tris_of(o)
    if cur <= tris:
        return
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    m = o.modifiers.new('d', 'DECIMATE')
    m.ratio = tris / cur
    bpy.ops.object.modifier_apply(modifier='d')


pieces = {}
for g in GROUPS:
    armor = build_piece(g + '_armor', [i for i in isl if i['group'] == g and not i['glow'] and not i['drop']])
    glow = build_piece(g + '_glow', [i for i in isl if i['group'] == g and i['glow']])
    tgt = TARGET['body'] if g == 'body' else TARGET['leg'] if g.startswith('leg') else TARGET['tail'][int(g[-1])]
    if armor is not None:
        if DEBUG:
            print('PRE', g, tris_of(armor), 'glow', tris_of(glow) if glow else 0)
        decimate(armor, tgt)
    pieces[g] = (armor, glow)

# ---- the nozzle: mouth of the cannon at the tip of the tail ---------------------------------------------------
tip_pts = [bms['rdmobj01'].verts[v].co for i in isl if i['group'] == 'tail3' for v in i['verts']]
ang_tip = math.radians(150)
tdir = mathutils.Vector((0.0, -math.sin(ang_tip), math.cos(ang_tip)))     # the tangent (barrel axis, pointing out of the mouth)
tip_sorted = sorted(tip_pts, key=lambda p: p.dot(tdir), reverse=True)
mouth_pts = tip_sorted[: max(30, len(tip_sorted) // 60)]
mouth = sum(mouth_pts, mathutils.Vector()) / len(mouth_pts)
if DEBUG:
    print('MOUTH', mouth, 'axis', tdir, 'extent', max(p.dot(tdir) for p in tip_pts))

# ---- pivots (source space) -----------------------------------------------------------------------------------
pivot = {'body': mathutils.Vector((0, 0, 0))}
for g in GROUPS:
    if g.startswith('leg'):
        pts = [bms['rdmobj06'].verts[v].co for i in isl if i['group'] == g for v in i['verts']]
        pts.sort(key=lambda p: abs(p.x))
        near = pts[: max(12, len(pts) // 30)]
        h = sum(near, mathutils.Vector()) / len(near)
        pivot[g] = h
rad_at = {}
for s in range(4):
    cs = [i['c'] for i in tail_isl if abs(polar(i['c']) - TAIL_CUTS[s]) < 7]
    ang = math.radians(TAIL_CUTS[s])
    rr = (sum(math.hypot(c.y - CY, c.z - CZ) for c in cs) / len(cs)) if cs else 1.0
    pivot['tail%d' % s] = mathutils.Vector((0, CY + rr * math.cos(ang), CZ + rr * math.sin(ang)))

# ---- game transform: scale, face -Z, feet on y = 0, centred ----------------------------------------------------
leg_pts = [bms['rdmobj06'].verts[v].co for i in isl if i['group'].startswith('leg') for v in i['verts']]
minz = min(p.z for p in leg_pts)
cy_legs = sum(i['c'].y for i in isl if i['group'].startswith('leg')) / max(1, sum(1 for i in isl if i['group'].startswith('leg')))
rot = mathutils.Matrix.Rotation(math.pi, 4, 'Z')
to_game = mathutils.Matrix.Scale(SCALE, 4) @ rot @ mathutils.Matrix.Translation((0.0, -cy_legs, -minz))
# (the rotation turns the head from source -Y to +Y; glTF export maps Blender +Y to -Z)


def world(p):
    return to_game @ p


for g, (armor, glow) in pieces.items():
    for ob in (armor, glow):
        if ob is not None:
            ob.data.transform(to_game)

# nozzle glow disc (new geometry, recessed in the barrel), in game space
mouth_g = world(mouth)
axis_g = (to_game.to_3x3() @ tdir).normalized()
bmn = bmesh.new()
rad_nozzle = 0.07 * SCALE
bmesh.ops.create_cone(bmn, cap_ends=True, cap_tris=False, segments=14, radius1=rad_nozzle, radius2=rad_nozzle * 0.75, depth=0.05 * SCALE)
me = bpy.data.meshes.new('nozzle_glow')
bmn.to_mesh(me)
bmn.free()
nozzle_obj = bpy.data.objects.new('nozzle_glow', me)
bpy.context.scene.collection.objects.link(nozzle_obj)
q = axis_g.to_track_quat('Z', 'Y')
nozzle_obj.matrix_world = mathutils.Matrix.Translation(mouth_g - axis_g * 0.09 * SCALE) @ q.to_matrix().to_4x4()
bpy.context.view_layer.update()
nozzle_obj.data.transform(nozzle_obj.matrix_world)
nozzle_obj.matrix_world = mathutils.Matrix.Identity(4)
glow3 = pieces['tail3'][1]
pieces['tail3'] = (pieces['tail3'][0], nozzle_obj if glow3 is None else glow3)
if glow3 is not None:
    bpy.ops.object.select_all(action='DESELECT')
    nozzle_obj.select_set(True)
    glow3.select_set(True)
    bpy.context.view_layer.objects.active = glow3
    bpy.ops.object.join()
    pieces['tail3'] = (pieces['tail3'][0], bpy.context.view_layer.objects.active)

# ---- materials --------------------------------------------------------------------------------------------------
mat_armor = bpy.data.materials.new('sc_armor')
mat_armor.use_nodes = True
b = mat_armor.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = ARMOR
b.inputs['Metallic'].default_value = 0.85
b.inputs['Roughness'].default_value = 0.4
mat_glow = bpy.data.materials.new('sc_glow')
mat_glow.use_nodes = True
b = mat_glow.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.02, 0.06, 0.03, 1.0)
b.inputs['Metallic'].default_value = 0.2
b.inputs['Roughness'].default_value = 0.35
b.inputs['Emission Color'].default_value = GLOW_EMIT
b.inputs['Emission Strength'].default_value = 1.0
if DEBUG:
    mat_armor.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.3, 0.32, 1)

# ---- final objects: armour + glow joined into one object per node, origin at the pivot ----------------------------
final = {}
for g in GROUPS:
    armor, glow = pieces[g]
    parts = []
    for p, idx in ((armor, 0), (glow, 1)):
        if p is None:
            continue
        p.data.materials.clear()
        p.data.materials.append(mat_armor)
        p.data.materials.append(mat_glow)
        for poly in p.data.polygons:
            poly.material_index = idx
        parts.append(p)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = 'sc_' + g
    ob.data.name = 'mesh_' + g   # a name different from the node's: three.js would rename one of the two
    final[g] = ob


def set_origin(ob, p):
    ob.data.transform(mathutils.Matrix.Translation(-p))
    ob.location = p


NODE = {'body': 'sc_body', 'legL0': 'sc_legL0', 'legL1': 'sc_legL1', 'legR0': 'sc_legR0', 'legR1': 'sc_legR1',
        'tail0': 'sc_tail0', 'tail1': 'sc_tail1', 'tail2': 'sc_tail2', 'tail3': 'sc_tail3'}
for g in GROUPS:
    if g == 'body':
        continue
    set_origin(final[g], world(pivot[g]))
bpy.context.view_layer.update()
# the chain: tail3 under tail2 under tail1 under tail0 (world transforms are kept)
for child, par in (('tail3', 'tail2'), ('tail2', 'tail1'), ('tail1', 'tail0')):
    c, p = final[child], final[par]
    mw = c.matrix_world.copy()
    c.parent = p
    c.matrix_parent_inverse = p.matrix_world.inverted()
    c.matrix_world = mw


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
        e.matrix_parent_inverse = parent.matrix_world.inverted()
    return e


# the eye drum: the centroid of the head glow islands (rdmobj05 + rdmobj02)
eye = [i['c'] for i in isl if i['key'] in ('rdmobj05', 'rdmobj02')]
eye_c = sum(eye, mathutils.Vector()) / len(eye)
empty('sc_head', world(eye_c))
empty('sc_nozzle', mouth_g, final['tail3'])
bpy.context.view_layer.update()

for o in list(meshes.values()):
    bpy.data.objects.remove(o, do_unlink=True)
print('FINAL', {g: tris_of(final[g]) for g in GROUPS}, 'total', sum(tris_of(o) for o in final.values()))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_apply=False, export_yup=True, export_materials='EXPORT',
    export_texcoords=False, use_selection=True,
)
print('SIZE', os.path.getsize(OUT))
